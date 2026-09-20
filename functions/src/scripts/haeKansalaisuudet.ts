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
import * as admin from 'firebase-admin';
import {
  luoAgent,
  asetaAgent,
  haeLista,
  haeProfiili,
  parsiProfiili,
  normalisoiMaakoodi,
  nollaaTuntemattomat,
  haeTuntemattomat,
  nimetTasmaavat,
  seuraAvain,
  vahvistaSeura,
  type ListaRivi,
  type Profiili,
} from '../services/kansalaisuus';
import { lueKausi } from '../services/kausiData';

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

  asetaAgent(await luoAgent());

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

    // Seura vahvistetaan hybridisaannolla (services/kansalaisuus.ts):
    // tilastolistan sarake ensin, profiilin kauden rivi aina kun lista ei
    // vahvista. Kumpikin lahde pettaa eri kausilla, eivatka paallekkain.
    //
    // Samannimisia pelaajia on: ehdokkaista valitaan se joka tayttaa SEKA
    // seuran ETTA ian. Pelkan seuran perusteella valittu ensimmainen osuma
    // voi olla eri henkilo, jolloin ikatarkistus hylkaisi koko pelaajan.
    const ehdokkaat: typeof nimiOsumat = [];
    let seuraTuntematon = false;
    let vahvistusLahde: 'lista' | 'profiili' | null = null;
    let paras: { rivi: ListaRivi; lahde: 'lista' | 'profiili' } | null = null;
    let varalla: { rivi: ListaRivi; lahde: 'lista' | 'profiili' } | null = null;

    for (const ehdokas of nimiOsumat) {
      const prof = await haeProfiiliValimuistista(ehdokas);
      if (prof === null) continue;
      const v = vahvistaSeura(
        [p.joukkue, ...(p.joukkueet || [])],
        ehdokas.seura,
        prof.kaudenSeurat?.[kausi] ?? [],
      );
      const ikaProf =
        prof.syntymavuosi !== null
          ? parseInt(kausi, 10) - prof.syntymavuosi
          : null;
      if (v.vahvistettu && ikaProf === p.ika) {
        paras = { rivi: ehdokas, lahde: v.lahde! };
        break;
      }
      if (v.vahvistettu && varalla === null) {
        varalla = { rivi: ehdokas, lahde: v.lahde! };
      }
    }

    if (paras !== null) {
      ehdokkaat.push(paras.rivi);
      vahvistusLahde = paras.lahde;
    } else if (varalla !== null) {
      ehdokkaat.push(varalla.rivi);
      vahvistusLahde = varalla.lahde;
    } else if (nimiOsumat.length > 0) {
      // Nimi osui, mutta seura ei vahvistunut yhdellakaan ehdokkaalla.
      ehdokkaat.push(nimiOsumat[0]);
      seuraTuntematon = true;
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
          seura_vahvistus_lahde: vahvistusLahde,
          varmennus: seuraTuntematon ? 'nimi+ika' : 'nimi+seura+ika',
          // Pelipaikka on NYKYTIETO, ei kauden aikainen. Puuttuva arvo on
          // null, ei arvaus: pelipaikkaa ei paatella tilastoista.
          pelipaikka: profiili.pelipaikka ?? null,
          pelipaikka_lahde:
            profiili.pelipaikka !== null ? 'veikkausliiga.com profiili' : null,
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
  const tuntemattomat = haeTuntemattomat();
  if (tuntemattomat.length > 0) {
    console.log('');
    console.log('TUNNISTAMATTOMAT MAAKOODIT (pelaaja -> "ei tietoa"):');
    for (const [koodi, n] of tuntemattomat) {
      console.log('  ' + koodi + ': ' + n + ' kpl');
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

// Ajetaan vain kun tiedosto kaynnistetaan suoraan. Nain testit voivat
// importata parsiProfiili- ja normalisoiMaakoodi-funktiot ilman etta koko
// ajo lahtee kayntiin.
// Testit importoivat nama taalta, jotta testitiedosto ei muutu.
export { parsiProfiili, normalisoiMaakoodi, nollaaTuntemattomat, haeTuntemattomat };

if (require.main === module) {
  main().catch((err) => {
    console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
