// ============================================
// KANSALAISUUDET KAUDEN PELAAJILLE
//
// Ensisijainen lähde on Veikkausliiga.com, koska:
//   - pelaajan profiili-ID tulee suoraan tilastotaulukon linkistä, joten
//     nimihakua ei tarvita eikä väärää osumaa voi syntyä haun kautta
//   - nimet ovat samasta lähteestä kuin Excel-vienti
//   - profiilissa on syntymäaika, jolla ikä voidaan varmentaa
// Transfermarkt on varalähde (ks. haeTransfermarkt.ts).
//
// TÄSMÄYTYS: nimi normalisoituina nimiosien joukkoina (pienet kirjaimet,
// ei välimerkkejä, järjestys ei ratkaise) JA seura JA ikä. Kaikki kolme
// ovat pakollisia. Epävarma tai puuttuva on "ei tietoa", ei arvausta.
//
// vlKansalaisuus = Veikkausliigan ilmoittama YKSI koodi. Emme tiedä varmasti,
// mitä kenttä kertoo: Jalloh on VL:n mukaan DNK, tosiasiassa Sierra Leone
// (laina Tanskasta). Siksi kentän nimi ei väitä sen olevan kansalaisuus.
//
// Luokittelu: suomalainen = kyllä | ei | ei tietoa, varmuus = kaksi lähdettä |
// yksi lähde. Yksi lähde ei riitä kieltävään päätelmään, koska VL ei osaa
// kertoa kaksoiskansalaisuutta. Ristiriita → ei tietoa + tarkistuslista.
// Aggregaatit luetaan välinä: alaraja = kyllä, yläraja = kyllä + ei tietoa.
// Kenttä EI ole maajoukkuekelpoisuus — ks. raportti FIFA:n säännöistä.
//
// Välimuisti: profiili haetaan kerran per Veikkausliiga-ID. Uusintaan
// tarvitaan --paivita.
//
// Käyttö:
//   node lib/scripts/haeKansalaisuudet.js --kausi 2026            (kuivaharjoitus)
//   node lib/scripts/haeKansalaisuudet.js --kausi 2026 --vahvista
// ============================================
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as admin from 'firebase-admin';
import * as https from 'https';
import * as tls from 'tls';
import { execFileSync } from 'child_process';
import { lueKausi } from '../services/kausiData';

const BASE_URL = 'https://www.veikkausliiga.com';

/**
 * veikkausliiga.com lähettää vain lehtisertifikaatin ilman välisertifikaattia.
 * Selain ja curl hakevat puuttuvan palan sertifikaatin AIA-laajennuksesta,
 * Node ei. Haetaan se samoin ajon alussa.
 *
 * Tämä ei heikennä varmennusta: haettu välisertifikaatti joutuu silti
 * ketjuttumaan Noden luottamaan juureen, joten väärennetty ei kelpaa.
 */
const AIA_URL = 'http://crt.sectigo.com/ZeroSSLECCDVSSLCA2.crt';

/**
 * Veikkausliiga sekoittaa ISO 3166-1 alpha-2- ja alpha-3-koodeja samassa
 * kentässä: uudemmissa profiileissa "FIN", vanhemmissa "FI". Molemmat
 * tarkoittavat samaa. Ilman normalisointia alpha-2-pelaajat putoaisivat
 * kokonaan pois, ja juuri niitä on vanhoilla kausilla eniten.
 */
const ALPHA2_ALPHA3: Record<string, string> = {
  FI: 'FIN', SE: 'SWE', NO: 'NOR', DK: 'DNK', EE: 'EST', LV: 'LVA',
  LT: 'LTU', RU: 'RUS', PL: 'POL', DE: 'DEU', NL: 'NLD', BE: 'BEL',
  FR: 'FRA', ES: 'ESP', PT: 'PRT', IT: 'ITA', GB: 'GBR', IE: 'IRL',
  IS: 'ISL', US: 'USA', BR: 'BRA', AR: 'ARG', CO: 'COL', CL: 'CHL',
  NG: 'NGA', GH: 'GHA', CI: 'CIV', SN: 'SEN', GM: 'GMB', CM: 'CMR',
  ML: 'MLI', ZM: 'ZMB', ZW: 'ZWE', SL: 'SLE', KE: 'KEN', MA: 'MAR',
  SK: 'SVK', CZ: 'CZE', HU: 'HUN', HR: 'HRV', RS: 'SRB', BA: 'BIH',
  XK: 'XKX', AL: 'ALB', TR: 'TUR', UA: 'UKR', AU: 'AUS', JP: 'JPN',
  CA: 'CAN', CH: 'CHE', AT: 'AUT', GR: 'GRC', RO: 'ROU', BG: 'BGR',
};

/** Normalisoi maakoodin kolmikirjaimiseksi. Tuntematon palautetaan isoin. */
function normalisoiMaakoodi(koodi: string): string {
  const iso = koodi.trim().toUpperCase();
  if (iso.length === 2) return ALPHA2_ALPHA3[iso] ?? iso;
  return iso;
}

async function luoAgent(): Promise<https.Agent> {
  const res = await axios.get<ArrayBuffer>(AIA_URL, {
    responseType: 'arraybuffer',
    timeout: 20000,
  });
  // DER → PEM. openssl on käytettävissä samassa ympäristössä kuin ajo.
  const pem = execFileSync(
    'openssl',
    ['x509', '-inform', 'DER', '-outform', 'PEM'],
    { input: Buffer.from(res.data) },
  ).toString();
  return new https.Agent({ ca: [...tls.rootCertificates, pem] });
}

let agent: https.Agent | undefined;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
};

function argumentti(nimi: string): string | undefined {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Nimiosien joukko: pienet kirjaimet, ei diakriittejä, ei välimerkkejä. */
function nimiOsat(s: string): Set<string> {
  const puhdas = (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return new Set(puhdas.split(' ').filter(Boolean));
}

/**
 * Nimivertailu joukkoina: järjestys ei ratkaise, joten "Sukunimi, Etunimi"
 * ja "Etunimi Sukunimi" täsmäävät. Vaaditaan että pienempi joukko sisältyy
 * suurempaan — lisänimet (toinen etunimi) eivät kaada osumaa.
 */
function nimetTasmaavat(a: string, b: string): boolean {
  const A = nimiOsat(a);
  const B = nimiOsat(b);
  if (A.size === 0 || B.size === 0) return false;
  const [pieni, suuri] = A.size <= B.size ? [A, B] : [B, A];
  for (const osa of pieni) if (!suuri.has(osa)) return false;
  return true;
}

/** Seuranimet normalisoidaan kevyesti — lähteissä on pieniä eroja. */
function seuraAvain(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

interface ListaRivi {
  nimi: string;
  seura: string;
  vlId: string;
  polku: string;
}

/** Tilastotaulukko: nimi, seura ja profiililinkki samalta riviltä. */
async function haeLista(kausi: string): Promise<ListaRivi[]> {
  const url =
    BASE_URL + '/tilastot/' + kausi + '/veikkausliiga/pelaajat/?sort-v=A&sort=A';
  const res = await axios.get<string>(url, {
    timeout: 25000,
    headers: HEADERS,
    httpsAgent: agent,
  });
  const $ = cheerio.load(res.data);
  const rivit: ListaRivi[] = [];
  $('tr').each((_, tr) => {
    const linkki = $(tr).find('a[href*="/pelaajat/"]').first();
    const href = linkki.attr('href') || '';
    const m = href.match(/^\/pelaajat\/(\d+)\//);
    if (!m) return;
    const solut = $(tr).find('td');
    const nimi = linkki.text().trim();
    // Seura on nimeä seuraava solu; haetaan ensimmäinen ei-tyhjä teksti.
    let seura = '';
    solut.each((i, td) => {
      const t = $(td).text().trim();
      if (!seura && t && t !== nimi && !/^\d+$/.test(t)) seura = t;
    });
    if (nimi) rivit.push({ nimi, seura, vlId: m[1], polku: href });
  });
  return rivit;
}

interface Profiili {
  vlId: string;
  nimi: string;
  /**
   * Kauden tilastorivit profiilista: kausi -> seurat joissa pelasi.
   * Tama on oikea kentta seuran varmentamiseen. Tilastolistan
   * seura-sarake nayttaa PAATTYNEELLA kaudella kauden seuran, mutta
   * KULUVALLA kaudella nykyisen seuran - ja viivan pelaajalle joka on
   * lahtenyt. Profiilin kauden rivi ei muutu jalkikateen.
   */
  kaudenSeurat?: Record<string, string[]>;
  syntynyt: string | null;
  syntymavuosi: number | null;
  kansalaisuudet: string[];
  pelipaikka: string | null;
  haettu: string;
}

/**
 * Jasentaa profiilisivun HTML:n. Eriytetty verkkohausta, jotta sen voi
 * testata tallennetuilla sivuilla ilman pyyntoja.
 */
export function parsiProfiili(html: string, vlId: string): Profiili {
  const $ = cheerio.load(html);
  const teksti = $('body').text().replace(/\s+/g, ' ');

  const nimiM = teksti.match(/#?\d+\s+([A-Za-zÀ-ÿ'\-. ]+?)\s+\d+\s+Joukkue/);
  const syntM = teksti.match(/Syntynyt\s*(\d{1,2}\.\d{1,2}\.(\d{4}))/);
  // Koodi voi olla alpha-2 tai alpha-3, ja kirjainkoko vaihtelee ("Fi").
  const kansM = teksti.match(
    /Kansalaisuus\s*([A-Za-z]{2,3}(?:\s*[/,]\s*[A-Za-z]{2,3})*)\s*(?:Paino|Pituus|Pelipaikka|$)/,
  );
  const paikkaM = teksti.match(/Pelipaikka\s*([A-Za-zÀ-ÿ]+)/);

  // Kauden tilastorivit: "2026 AC Oulu 25 2250 ...". Parsinta ankkuroidaan
  // taulukon viimeisen otsikon (RPM) jalkeen, jottei syntymavuosi tai
  // otsikkoteksti osu kaavaan. Seuranimi voi sisaltaa valilyonteja, joten
  // se luetaan ei-ahneesti kahteen perakkaiseen kokonaislukuun asti.
  const kaudenSeurat: Record<string, string[]> = {};
  const otsikko = teksti.lastIndexOf(' RPM ');
  const taulukko = otsikko >= 0 ? teksti.slice(otsikko + 5) : teksti;
  const riviRe =
    /(20\d{2})\s+([A-ZÅÄÖ][A-Za-zÅÄÖåäö.'\-]*(?:\s+[A-Za-zÅÄÖåäö.'\-]+){0,3}?)\s+(?=\d+\s+\d+\s)/g;
  let rm: RegExpExecArray | null;
  while ((rm = riviRe.exec(taulukko)) !== null) {
    const kausi = rm[1];
    const seura = rm[2].trim();
    if (!seura) continue;
    if (!kaudenSeurat[kausi]) kaudenSeurat[kausi] = [];
    if (!kaudenSeurat[kausi].includes(seura)) kaudenSeurat[kausi].push(seura);
  }

  return {
    vlId,
    nimi: nimiM ? nimiM[1].trim() : '',
    syntynyt: syntM ? syntM[1] : null,
    syntymavuosi: syntM ? parseInt(syntM[2], 10) : null,
    kansalaisuudet: kansM
      ? kansM[1]
          .split(/[/,]/)
          .map((x) => normalisoiMaakoodi(x))
          .filter(Boolean)
      : [],
    pelipaikka: paikkaM ? paikkaM[1] : null,
    kaudenSeurat,
    haettu: new Date().toISOString(),
  };
}

async function haeProfiili(polku: string, vlId: string): Promise<Profiili> {
  const res = await axios.get<string>(BASE_URL + polku, {
    timeout: 25000,
    headers: HEADERS,
    httpsAgent: agent,
  });
  return parsiProfiili(res.data, vlId);

}

async function main(): Promise<void> {
  const kausi = argumentti('kausi') || '2026';
  const vahvista = lippu('vahvista');
  const paivita = lippu('paivita');
  // Raporttitila: profiilivalimuisti taytetaan, mutta
  // seasons/{kausi}/kansalaisuudet -dataa EI kirjoiteta.
  const vainRaportti = lippu('vain-raportti');
  // CLAUDE.md 3.5: tuotantoon kirjoitetaan vain kahden lipun skriptilla.
  // Pelkka --vahvista ei riita; kohde on kerrottava erikseen.
  const tuotanto = lippu('tuotanto');
  const viiveMs = parseInt(argumentti('viive') || '3000', 10);
  const rajaRaaka = argumentti('raja');
  const raja = rajaRaaka ? parseInt(rajaRaaka, 10) : Infinity;

  if (vahvista && !vainRaportti && !tuotanto) {
    console.error(
      'Kirjoitus tuotantoon vaatii seka --vahvista etta --tuotanto ' +
        '(CLAUDE.md 3.5). Ilman --tuotanto aja --vain-raportti.',
    );
    process.exit(1);
  }

  agent = await luoAgent();

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi' });
  const db = admin.firestore();

  const snap = await db
    .collection('seasons')
    .doc(kausi)
    .collection('players')
    .get();
  const pelaajat = snap.docs
    .filter((d) => d.data().vanhentunut !== true)
    .map((d) => {
      const x = d.data();
      return {
        slug: d.id,
        nimi: ((x.etunimi as string) + ' ' + (x.sukunimi as string)).trim(),
        joukkue: (x.joukkue as string) || '',
        joukkueet: (x.joukkueet as string[]) || [],
        ika: (x.ika as number) || 0,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  console.log('='.repeat(70));
  console.log('KANSALAISUUDET — ' + (vahvista ? 'KIRJOITUS' : 'KUIVAHARJOITUS'));
  console.log('Kausi ' + kausi + ', pelaajia ' + pelaajat.length);
  console.log('Lähde: Veikkausliiga.com · viive ' + viiveMs + ' ms');
  console.log('='.repeat(70));

  const lista = await haeLista(kausi);
  console.log('Tilastotaulukossa ' + lista.length + ' riviä.');
  console.log('');

  const valimuisti = db.collection('veikkausliiga_profiilit');
  let valimuistista = 0;

  /**
   * Profiili valimuistista tai haku. Samaa vlId:ta ei haeta kahdesti.
   * Palauttaa null jos haku epaonnistuu.
   */
  async function haeProfiiliValimuistista(
    rivi: ListaRivi,
  ): Promise<Profiili | null> {
    const ref = valimuisti.doc(rivi.vlId);
    const cached = await ref.get();
    if (cached.exists && !paivita) {
      valimuistista++;
      return cached.data() as Profiili;
    }
    try {
      const prof = await haeProfiili(rivi.polku, rivi.vlId);
      if (vahvista || vainRaportti) await ref.set(prof);
      await sleep(viiveMs);
      return prof;
    } catch {
      await sleep(viiveMs * 2);
      return null;
    }
  }
  let varma = 0;
  let epavarma = 0;
  let eiTietoa = 0;
  let kaksiLahdetta = 0;
  const luokat = { kylla: 0, ei: 0, 'ei tietoa': 0 } as Record<string, number>;
  const epavarmat: string[] = [];
  const eiOsumaa: string[] = [];
  const tarkistuslista: string[] = [];
  const kansalaisuusJakauma = new Map<string, number>();
  // Minuuttiraportin kolme joukkoa. Jako tehdaan REKISTEROIDYN koodin ja
  // varmennuksen mukaan, ei suomalainen-kentan mukaan:
  //   FIN            = koodi FIN ja seura vahvistettu
  //   ulkomaa        = muu koodi ja seura vahvistettu
  //   ei tietoa      = profiilia ei loydy, koodi puuttuu, tai seura
  //                    vahvistamatta
  // Nama kolme kattavat kaikki pelaajat, joten osuudet summautuvat
  // ikaryhman kokonaisosuudeksi.
  const finSlugit = new Set<string>();
  const ulkomaaSlugit = new Set<string>();
  const eiTietoaSlugit = new Set<string>();

  // Toiset lähteet. Rakenne on avoin: Palloliiton nuorten maajoukkue-
  // valinnat liitetään tähän samalla muodolla, kun speksi on valmis.
  // --toinen-lahde tm käyttää jo haettua transfermarkt_players-dataa;
  // Transfermarktiin EI tehdä uusia pyyntöjä (403 ja käyttöehdot).
  interface ToinenLahde {
    lahde: string;
    id: string | null;
    arvo: string;
    suomi: boolean;
  }
  const toisetLahteet = new Map<string, ToinenLahde[]>();
  if (argumentti('toinen-lahde') === 'tm') {
    const tmSnap = await db.collection('transfermarkt_players').get();
    for (const p of pelaajat) {
      const osuma = tmSnap.docs.find((d) =>
        nimetTasmaavat(p.nimi, (d.data().name as string) || ''),
      );
      if (!osuma) continue;
      const kansat = (osuma.data().nationality as string[]) || [];
      if (kansat.length === 0) continue;
      toisetLahteet.set(p.slug, [
        {
          lahde: 'transfermarkt (talletettu)',
          id: osuma.id,
          arvo: kansat.join('/'),
          suomi: kansat.includes('Finland'),
        },
      ]);
    }
    console.log('Toinen lähde: talletettu Transfermarkt-data, ' +
      toisetLahteet.size + ' osumaa (ei uusia pyyntöjä).');
  }

  const kohteet = pelaajat.slice(0, raja === Infinity ? undefined : raja);

  for (let i = 0; i < kohteet.length; i++) {
    const p = kohteet[i];

    // 1) Nimi + seura listasivulta. Seura on pakollinen.
    const omatSeurat = new Set(
      [p.joukkue, ...p.joukkueet].filter(Boolean).map(seuraAvain),
    );
    const nimiOsumat = lista.filter((r) => nimetTasmaavat(p.nimi, r.nimi));

    if (nimiOsumat.length === 0) {
      eiTietoa++;
      eiTietoaSlugit.add(p.slug);
      eiOsumaa.push(
        p.nimi + ' (' + p.joukkue + ', ' + p.ika + ' v) — ei nimiosumaa',
      );
      continue;
    }

    // Seura varmennetaan profiilin KAUDEN RIVILTA, ei tilastolistan
    // seura-sarakkeesta. Lista nayttaa paattyneella kaudella kauden seuran,
    // mutta kuluvalla kaudella nykyisen seuran - ja viivan pelaajalle joka
    // on lahtenyt. Kauden rivi ei muutu jalkikateen, joten sama saanto
    // toimii kaikille kausille.
    //
    // Jos pelaajalla on samalla kaudella rivi useassa seurassa, riittaa
    // etta datan seura loytyy joltain rivilta.
    const ehdokkaat: typeof nimiOsumat = [];
    let seuraTuntematon = false;
    for (const ehdokas of nimiOsumat) {
      const prof = await haeProfiiliValimuistista(ehdokas);
      if (prof === null) continue;
      const profiilinSeurat = (prof.kaudenSeurat?.[kausi] ?? []).map(seuraAvain);
      if (profiilinSeurat.length === 0) {
        // Profiilissa ei ole kauden rivia lainkaan - seuraa ei voi varmentaa.
        seuraTuntematon = true;
        ehdokkaat.push(ehdokas);
        continue;
      }
      if (profiilinSeurat.some((x) => omatSeurat.has(x))) {
        ehdokkaat.push(ehdokas);
        seuraTuntematon = false;
        break;
      }
    }

    if (ehdokkaat.length === 0) {
      eiTietoa++;
      eiTietoaSlugit.add(p.slug);
      eiOsumaa.push(
        p.nimi + ' (' + p.joukkue + ', ' + p.ika + ' v) — seura ei täsmää ' +
          'profiilin kauden riviin',
      );
      continue;
    }

    const rivi = ehdokkaat[0];
    const profiili = await haeProfiiliValimuistista(rivi);
    if (profiili === null) {
      eiTietoa++;
      eiTietoaSlugit.add(p.slug);
      eiOsumaa.push(p.nimi + ' — profiilin haku epäonnistui');
      continue;
    }

    // 3) Ikä on pakollinen varmenne: kausi − syntymävuosi = ikä kaudella.
    const ikaProfiilista =
      profiili.syntymavuosi !== null
        ? parseInt(kausi, 10) - profiili.syntymavuosi
        : null;
    if (ikaProfiilista === null || ikaProfiilista !== p.ika) {
      epavarma++;
      eiTietoaSlugit.add(p.slug);
      epavarmat.push(
        p.nimi +
          ' (' + p.joukkue + ') — ikä ei täsmää: Excel ' + p.ika +
          ', profiili ' + (ikaProfiilista === null ? 'ei syntymäaikaa' : ikaProfiilista) +
          ' (synt. ' + (profiili.syntynyt ?? '?') + ')',
      );
      continue;
    }

    if (profiili.kansalaisuudet.length === 0) {
      eiTietoa++;
      eiTietoaSlugit.add(p.slug);
      eiOsumaa.push(p.nimi + ' — profiilissa ei kansalaisuutta');
      continue;
    }

    // ---------- Luokittelu ----------
    // vlKansalaisuus = Veikkausliigan ilmoittama yksi koodi. Emme tieda
    // varmasti mita kentta kertoo (Jalloh: VL sanoo DNK, tosiasiassa Sierra
    // Leone), joten nimi ei vaita enempaa kuin lahde antaa.
    const vlKansalaisuus = profiili.kansalaisuudet[0];
    const vlSuomi = vlKansalaisuus === 'FIN';

    // Toinen lahde. Lista on tarkoituksella avoin: Palloliiton nuorten
    // maajoukkuevalinnat lisataan tahan myohemmin ilman uudelleensuunnittelua.
    const muutLahteet = toisetLahteet.get(p.slug) ?? [];
    const toinenSuomi = muutLahteet.some((l) => l.suomi === true);
    const toinenMuu = muutLahteet.some((l) => l.suomi === false);
    const toinenOnOlemassa = muutLahteet.length > 0;

    let suomalainen: 'kylla' | 'ei' | 'ei tietoa';
    let varmuus: 'kaksi lahdetta' | 'yksi lahde';
    let ristiriita = false;

    if (vlSuomi && toinenSuomi) {
      suomalainen = 'kylla';
      varmuus = 'kaksi lahdetta';
    } else if (vlSuomi && !toinenOnOlemassa) {
      suomalainen = 'kylla';
      varmuus = 'yksi lahde';
    } else if (!vlSuomi && toinenMuu && !toinenSuomi) {
      suomalainen = 'ei';
      varmuus = 'kaksi lahdetta';
    } else if (!vlSuomi && !toinenOnOlemassa) {
      // Yksi lahde ei riita kieltavaan paatelmaan: VL ei osaa kertoa
      // kaksoiskansalaisuutta, joten "muu kuin FIN" ei sulje Suomea pois.
      suomalainen = 'ei tietoa';
      varmuus = 'yksi lahde';
    } else {
      // vlSuomi && toinenMuu, tai !vlSuomi && toinenSuomi
      suomalainen = 'ei tietoa';
      varmuus = 'kaksi lahdetta';
      ristiriita = true;
    }

    // Seuraa ei voitu varmentaa: Veikkausliiga nayttaa viivan pelaajalle
    // joka on lahtenyt. Havainto kirjataan, mutta sen varmuutta ei vaiteta
    // - seura_vahvistettu: false kertoo mita jai varmentamatta.
    if (seuraTuntematon) {
      epavarma++;
      epavarmat.push(
        p.nimi + ' (' + p.joukkue + ', ' + p.ika + ' v) - seura tuntematon ' +
          'lahteessa (pelaaja lahtenyt); nimi ja ika tasmaavat, VL sanoo ' +
          vlKansalaisuus,
      );
    }

    if (ristiriita) {
      tarkistuslista.push(
        p.nimi + ' (' + p.joukkue + ') - VL=' + vlKansalaisuus +
          ', muut lahteet=' +
          muutLahteet.map((l) => l.lahde + ':' + (l.suomi ? 'FIN' : 'muu')).join(', '),
      );
    }

    // Seura vahvistamatta -> ei tietoa, kunnes seura on vahvistettu.
    if (seuraTuntematon) {
      eiTietoaSlugit.add(p.slug);
    } else if (vlKansalaisuus === 'FIN') {
      finSlugit.add(p.slug);
    } else {
      ulkomaaSlugit.add(p.slug);
    }
    luokat[suomalainen]++;
    if (varmuus === 'kaksi lahdetta') kaksiLahdetta++;
    kansalaisuusJakauma.set(
      vlKansalaisuus,
      (kansalaisuusJakauma.get(vlKansalaisuus) || 0) + 1,
    );
    varma++;

    if (vahvista && !vainRaportti) {
      // Oma kokoelma, EI seasons/{kausi}/players - projektio ylikirjoitetaan
      // jokaisessa tuonnissa, ja johdettu tieto katoaisi sen mukana.
      await db
        .collection('seasons')
        .doc(kausi)
        .collection('kansalaisuudet')
        .doc(p.slug)
        .set({
          slug: p.slug,
          nimi: p.nimi,
          joukkue: p.joukkue,
          ika: p.ika,
          /** Veikkausliigan ilmoittama yksi koodi. Ei valttamatta kansalaisuus. */
          vlKansalaisuus,
          suomalainen,
          varmuus,
          ristiriita,
          /** Avoin lista: uusi lahde lisataan tahan ilman mallimuutosta. */
          lahteet: [
            { lahde: 'veikkausliiga.com', id: rivi.vlId, arvo: vlKansalaisuus },
            ...muutLahteet.map((l) => ({
              lahde: l.lahde,
              id: l.id ?? null,
              arvo: l.arvo,
            })),
          ],
          /** false = seura jai varmentamatta (VL nayttaa viivan). */
          seura_vahvistettu: !seuraTuntematon,
          varmennus: seuraTuntematon ? 'nimi+ika' : 'nimi+seura+ika',
          syntynyt: profiili.syntynyt,
          paivitetty: new Date().toISOString(),
        });
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('YHTEENVETO — kausi ' + kausi);
  console.log('  varmennettu (nimi+seura+ikä): ' + varma + ' / ' + kohteet.length);
  console.log('    joista kahdesta lähteestä:  ' + kaksiLahdetta);
  console.log('    joista seura vahvistamatta: ' + epavarma);
  console.log('  ei osumaa:                    ' + eiTietoa);
  console.log('  välimuistista:                ' + valimuistista);
  console.log('');
  console.log('SUOMALAISUUS');
  console.log('  kyllä:     ' + luokat['kylla']);
  console.log('  ei:        ' + luokat['ei']);
  console.log('  ei tietoa: ' + luokat['ei tietoa']);
  console.log('');
  const alaraja = luokat['kylla'];
  const ylaraja = luokat['kylla'] + luokat['ei tietoa'];
  console.log('  VÄLI: Suomen kansalaisia ' + alaraja + '–' + ylaraja +
    ' (alaraja = kyllä, yläraja = kyllä + ei tietoa)');
  console.log('  Ei yhtä pistelukua: yksi lähde ei kerro kaksoiskansalaisuutta.');

  if (kansalaisuusJakauma.size > 0) {
    console.log('');
    console.log('VL:N ILMOITTAMA KOODI (ei välttämättä kansalaisuus):');
    for (const [k, n] of Array.from(kansalaisuusJakauma.entries()).sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log('  ' + k + ': ' + n);
    }
  }
  if (tarkistuslista.length > 0) {
    console.log('');
    console.log('TARKISTUSLISTA — lähteet ristiriidassa:');
    for (const e of tarkistuslista) console.log('  · ' + e);
  }
  if (epavarmat.length > 0) {
    console.log('');
    console.log('SEURA VAHVISTAMATTA (tallennettu, seura_vahvistettu: false):');
    for (const e of epavarmat) console.log('  · ' + e);
  }
  if (eiOsumaa.length > 0) {
    console.log('');
    console.log('EI OSUMAA (' + eiOsumaa.length + '):');
    for (const e of eiOsumaa) console.log('  · ' + e);
  }
  // ---------- Minuuteilla painotettu, kolme osaa samassa yksikossa ----------
  // Kaikki osuudet ovat % LIIGAN MINUUTTIKAPASITEETISTA, jotta osat
  // summautuvat ikaryhman kokonaisosuudeksi eika eri nimittajia sekoiteta.
  const { suoritukset, nimittajat } = await lueKausi(db, parseInt(kausi, 10));
  const kapasiteetti = nimittajat.reduce((a, n) => a + n.kapasiteetti_min, 0);
  const minJoukossa = (ikaRaja: number, joukko: Set<string>): number =>
    suoritukset
      .filter((x) => x.ika <= ikaRaja && joukko.has(x.slug))
      .reduce((a, x) => a + x.minuutit, 0);
  const minKaikki = (ikaRaja: number): number =>
    suoritukset.filter((x) => x.ika <= ikaRaja).reduce((a, x) => a + x.minuutit, 0);
  const pr = (osa: number): string =>
    kapasiteetti > 0
      ? (osa / kapasiteetti * 100).toFixed(1).replace('.', ',') + ' %'
      : '-';

  console.log('');
  console.log('MINUUTIT % LIIGAN KAPASITEETISTA — kausi ' + kausi);
  for (const [otsikko, raja] of [
    ['17–21-vuotiaat', 21],
    ['alle 21-vuotiaat', 20],
  ] as [string, number][]) {
    const yht = minKaikki(raja);
    const fin = minJoukossa(raja, finSlugit);
    const ulk = minJoukossa(raja, ulkomaaSlugit);
    const eiT = minJoukossa(raja, eiTietoaSlugit);
    console.log('  ' + otsikko + ' yhteensa ' + pr(yht));
    console.log('    FIN (Suomen kansalaisuus):    ' + pr(fin));
    console.log('    ulkomaan koodi:               ' + pr(ulk));
    console.log('    ei tietoa:                    ' + pr(eiT));
    console.log('    summa tarkistus:              ' + pr(fin + ulk + eiT) +
      (Math.abs(fin + ulk + eiT - yht) < 1 ? '  ✓' : '  ✗ EI TASMAA'));
  }
  const a = 20;
  console.log('  RIVI\t' + kausi + '\t' +
    pr(minKaikki(21)) + '\t' + pr(minJoukossa(21, finSlugit)) + '\t' +
    pr(minJoukossa(21, ulkomaaSlugit)) + '\t' + pr(minJoukossa(21, eiTietoaSlugit)) + '\t' +
    pr(minKaikki(a)) + '\t' + pr(minJoukossa(a, finSlugit)) + '\t' +
    pr(minJoukossa(a, ulkomaaSlugit)) + '\t' + pr(minJoukossa(a, eiTietoaSlugit)));

  if (!vahvista) {
    console.log('');
    console.log('Kuivaharjoitus — mitään ei tallennettu. Kirjoitus vaatii --vahvista.');
  } else if (vainRaportti) {
    console.log('');
    console.log('Raporttitila — kansalaisuusdataa EI kirjoitettu, vain profiilivälimuisti.');
  }
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
