// ============================================
// KANSALAISUUSHAKU — jaettu moduuli
//
// Sama koodi palvelee komentoriviskriptia (haeKansalaisuudet.ts) ja
// admin-tuonnin vahvistusreittia. Ei toista toteutusta: jos jasennys tai
// tasmaytyssaanto muuttuu, se muuttuu molemmille kerralla.
//
// Lahde on Veikkausliiga.com. Seura varmennetaan profiilin KAUDEN
// RIVILTA, koska tilastolistan seura-sarake tarkoittaa eri asiaa
// paattyneella ja kuluvalla kaudella.
// ============================================
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as tls from 'tls';
import { execFileSync } from 'child_process';

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
 *
 * Taulukko on täydellinen ISO 3166-1 (249 koodia), ei käsin koottu otos:
 * käsin kootusta puuttui esimerkiksi NE (Niger), jolloin koodi jäi
 * normalisoimatta. Tunnistamaton koodi EI mene läpi arvauksena vaan
 * raportoidaan ja pelaaja päätyy "ei tietoa" -luokkaan.
 */
const ALPHA2_ALPHA3: Record<string, string> = {
  AD: 'AND', AE: 'ARE', AF: 'AFG', AG: 'ATG', AI: 'AIA', AL: 'ALB', AM: 'ARM', AO: 'AGO',
  AQ: 'ATA', AR: 'ARG', AS: 'ASM', AT: 'AUT', AU: 'AUS', AW: 'ABW', AX: 'ALA', AZ: 'AZE',
  BA: 'BIH', BB: 'BRB', BD: 'BGD', BE: 'BEL', BF: 'BFA', BG: 'BGR', BH: 'BHR', BI: 'BDI',
  BJ: 'BEN', BL: 'BLM', BM: 'BMU', BN: 'BRN', BO: 'BOL', BQ: 'BES', BR: 'BRA', BS: 'BHS',
  BT: 'BTN', BV: 'BVT', BW: 'BWA', BY: 'BLR', BZ: 'BLZ', CA: 'CAN', CC: 'CCK', CD: 'COD',
  CF: 'CAF', CG: 'COG', CH: 'CHE', CI: 'CIV', CK: 'COK', CL: 'CHL', CM: 'CMR', CN: 'CHN',
  CO: 'COL', CR: 'CRI', CU: 'CUB', CV: 'CPV', CW: 'CUW', CX: 'CXR', CY: 'CYP', CZ: 'CZE',
  DE: 'DEU', DJ: 'DJI', DK: 'DNK', DM: 'DMA', DO: 'DOM', DZ: 'DZA', EC: 'ECU', EE: 'EST',
  EG: 'EGY', EH: 'ESH', ER: 'ERI', ES: 'ESP', ET: 'ETH', FI: 'FIN', FJ: 'FJI', FK: 'FLK',
  FM: 'FSM', FO: 'FRO', FR: 'FRA', GA: 'GAB', GB: 'GBR', GD: 'GRD', GE: 'GEO', GF: 'GUF',
  GG: 'GGY', GH: 'GHA', GI: 'GIB', GL: 'GRL', GM: 'GMB', GN: 'GIN', GP: 'GLP', GQ: 'GNQ',
  GR: 'GRC', GS: 'SGS', GT: 'GTM', GU: 'GUM', GW: 'GNB', GY: 'GUY', HK: 'HKG', HM: 'HMD',
  HN: 'HND', HR: 'HRV', HT: 'HTI', HU: 'HUN', ID: 'IDN', IE: 'IRL', IL: 'ISR', IM: 'IMN',
  IN: 'IND', IO: 'IOT', IQ: 'IRQ', IR: 'IRN', IS: 'ISL', IT: 'ITA', JE: 'JEY', JM: 'JAM',
  JO: 'JOR', JP: 'JPN', KE: 'KEN', KG: 'KGZ', KH: 'KHM', KI: 'KIR', KM: 'COM', KN: 'KNA',
  KP: 'PRK', KR: 'KOR', KW: 'KWT', KY: 'CYM', KZ: 'KAZ', LA: 'LAO', LB: 'LBN', LC: 'LCA',
  LI: 'LIE', LK: 'LKA', LR: 'LBR', LS: 'LSO', LT: 'LTU', LU: 'LUX', LV: 'LVA', LY: 'LBY',
  MA: 'MAR', MC: 'MCO', MD: 'MDA', ME: 'MNE', MF: 'MAF', MG: 'MDG', MH: 'MHL', MK: 'MKD',
  ML: 'MLI', MM: 'MMR', MN: 'MNG', MO: 'MAC', MP: 'MNP', MQ: 'MTQ', MR: 'MRT', MS: 'MSR',
  MT: 'MLT', MU: 'MUS', MV: 'MDV', MW: 'MWI', MX: 'MEX', MY: 'MYS', MZ: 'MOZ', NA: 'NAM',
  NC: 'NCL', NE: 'NER', NF: 'NFK', NG: 'NGA', NI: 'NIC', NL: 'NLD', NO: 'NOR', NP: 'NPL',
  NR: 'NRU', NU: 'NIU', NZ: 'NZL', OM: 'OMN', PA: 'PAN', PE: 'PER', PF: 'PYF', PG: 'PNG',
  PH: 'PHL', PK: 'PAK', PL: 'POL', PM: 'SPM', PN: 'PCN', PR: 'PRI', PS: 'PSE', PT: 'PRT',
  PW: 'PLW', PY: 'PRY', QA: 'QAT', RE: 'REU', RO: 'ROU', RS: 'SRB', RU: 'RUS', RW: 'RWA',
  SA: 'SAU', SB: 'SLB', SC: 'SYC', SD: 'SDN', SE: 'SWE', SG: 'SGP', SH: 'SHN', SI: 'SVN',
  SJ: 'SJM', SK: 'SVK', SL: 'SLE', SM: 'SMR', SN: 'SEN', SO: 'SOM', SR: 'SUR', SS: 'SSD',
  ST: 'STP', SV: 'SLV', SX: 'SXM', SY: 'SYR', SZ: 'SWZ', TC: 'TCA', TD: 'TCD', TF: 'ATF',
  TG: 'TGO', TH: 'THA', TJ: 'TJK', TK: 'TKL', TL: 'TLS', TM: 'TKM', TN: 'TUN', TO: 'TON',
  TR: 'TUR', TT: 'TTO', TV: 'TUV', TW: 'TWN', TZ: 'TZA', UA: 'UKR', UG: 'UGA', UM: 'UMI',
  US: 'USA', UY: 'URY', UZ: 'UZB', VA: 'VAT', VC: 'VCT', VE: 'VEN', VG: 'VGB', VI: 'VIR',
  VN: 'VNM', VU: 'VUT', WF: 'WLF', WS: 'WSM', YE: 'YEM', YT: 'MYT', ZA: 'ZAF', ZM: 'ZMB',
  ZW: 'ZWE',
};

/** Tunnistamattomat koodit kerätään raportoitavaksi ajon lopussa. */
const tuntemattomatKoodit = new Map<string, number>();

/**
 * Normalisoi maakoodin kolmikirjaimiseksi.
 *
 * Palauttaa null jos koodia ei tunnisteta: kaksikirjaiminen jota ei ole
 * ISO-taulukossa, tai muu kuin 2–3 merkkiä. Kutsuja tulkitsee nullin
 * "ei tietoa" -tilaksi — koodia ei arvata.
 */
function normalisoiMaakoodi(koodi: string): string | null {
  const iso = koodi.trim().toUpperCase();
  if (iso.length === 2) {
    const kolme = ALPHA2_ALPHA3[iso];
    if (kolme === undefined) {
      tuntemattomatKoodit.set(iso, (tuntemattomatKoodit.get(iso) || 0) + 1);
      return null;
    }
    return kolme;
  }
  if (iso.length === 3) {
    // Alpha-3 kelpaa sellaisenaan jos se esiintyy taulukon arvoissa.
    if (Object.values(ALPHA2_ALPHA3).includes(iso)) return iso;
    tuntemattomatKoodit.set(iso, (tuntemattomatKoodit.get(iso) || 0) + 1);
    return null;
  }
  tuntemattomatKoodit.set(iso, (tuntemattomatKoodit.get(iso) || 0) + 1);
  return null;
}

/** Testejä varten: tyhjennä tunnistamattomien lista. */
export function nollaaTuntemattomat(): void {
  tuntemattomatKoodit.clear();
}

/** Testejä varten: tunnistamattomat koodit ja niiden määrät. */
export function haeTuntemattomat(): Array<[string, number]> {
  return Array.from(tuntemattomatKoodit.entries()).sort((a, b) => b[1] - a[1]);
}

export { normalisoiMaakoodi };


export async function luoAgent(): Promise<https.Agent> {
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

/** Asetetaan kerran ajon alussa; molemmat kutsujat tekevat sen itse. */
export function asetaAgent(a: https.Agent): void {
  agent = a;
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
};

/** Nimiosien joukko: pienet kirjaimet, ei diakriittejä, ei välimerkkejä. */
export function nimiOsat(s: string): Set<string> {
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
export function nimetTasmaavat(a: string, b: string): boolean {
  const A = nimiOsat(a);
  const B = nimiOsat(b);
  if (A.size === 0 || B.size === 0) return false;
  const [pieni, suuri] = A.size <= B.size ? [A, B] : [B, A];
  for (const osa of pieni) if (!suuri.has(osa)) return false;
  return true;
}

/** Seuranimet normalisoidaan kevyesti — lähteissä on pieniä eroja. */
export function seuraAvain(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface ListaRivi {
  nimi: string;
  seura: string;
  vlId: string;
  polku: string;
}

/** Tilastotaulukko: nimi, seura ja profiililinkki samalta riviltä. */
export async function haeLista(kausi: string): Promise<ListaRivi[]> {
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

export interface Profiili {
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
          .filter((x): x is string => x !== null)
      : [],
    pelipaikka: paikkaM ? paikkaM[1] : null,
    kaudenSeurat,
    haettu: new Date().toISOString(),
  };
}

export async function haeProfiili(polku: string, vlId: string): Promise<Profiili> {
  const res = await axios.get<string>(BASE_URL + polku, {
    timeout: 25000,
    headers: HEADERS,
    httpsAgent: agent,
  });
  return parsiProfiili(res.data, vlId);

}


// ============================================
// SEURAN VAHVISTUS — yksi saanto, kaksi lahdetta
// ============================================

export interface SeuraVahvistus {
  vahvistettu: boolean;
  /** Kumpi lahde vahvisti. null = kumpikaan ei vahvistanut. */
  lahde: 'lista' | 'profiili' | null;
}

/**
 * Vahvistaa, pelasiko pelaaja datan mukaisessa seurassa kyseisella kaudella.
 *
 * Kaksi lahdetta, joista kumpikin pettaa eri tilanteessa:
 *
 *   Tilastolistan seurasarake toimii PAATTYNEELLA kaudella (kauden 2020
 *   listassa 0 viivaa ja seuroina RoPS, FC Honka, HIFK), mutta KULUVALLA
 *   kaudella se nayttaa NYKYISEN seuran ja viivan lahteneille.
 *
 *   Profiilin kauden rivi toimii kuluvalla kaudella, mutta vanhoilla
 *   kausilla se PUUTTUU noin puolelta: Veikkausliigan profiilitaulukko ei
 *   sisalla kaikkia pelaajan kausia. Kun rivi on, se on tarkka (otos 20
 *   pelaajaa kaudelta 2020: rivi 10:lla, ja kaikilla 10 seura tasmasi).
 *
 * Siksi lista tarkistetaan ensin, ja profiilin rivia kaytetaan aina kun
 * lista ei vahvista - oli syyna viiva tai eri seura. Jalkimmainen kattaa
 * kesken kauden Suomessa seuraa vaihtaneet.
 *
 * Parametrit ovat normalisoimattomia; normalisointi tehdaan taalla.
 */
export function vahvistaSeura(
  datanSeurat: string[],
  listanSeura: string,
  profiilinKaudenSeurat: string[],
): SeuraVahvistus {
  const omat = new Set(datanSeurat.filter(Boolean).map(seuraAvain));
  if (omat.size === 0) return { vahvistettu: false, lahde: null };

  const lista = seuraAvain(listanSeura);
  if (lista && omat.has(lista)) {
    return { vahvistettu: true, lahde: 'lista' };
  }

  const profiili = (profiilinKaudenSeurat || []).map(seuraAvain);
  if (profiili.some((x) => omat.has(x))) {
    return { vahvistettu: true, lahde: 'profiili' };
  }

  return { vahvistettu: false, lahde: null };
}
