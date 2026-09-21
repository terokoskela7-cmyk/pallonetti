// ============================================
// EMULAATTORITESTI — sarjat eivat vuoda toisiinsa
//
// Tarkein hyvaksymiskriteeri: Veikkausliigan luvut eivat muutu, kun
// Ykkosliiga lisataan. Riski ei ole laskennassa vaan kirjoituksessa:
// vanhentuneiden merkinta kohdistui aiemmin kauteen, ei sarjaan, jolloin
// Ykkosliigan tuonti olisi merkinnyt saman kauden Veikkausliigan rivit
// vanhentuneiksi ja nollannut sen luvut.
//
// Testi kirjoittaa VAIN EMULAATTORIIN. Ilman FIRESTORE_EMULATOR_HOSTia se
// kieltaytyy ajamasta, jottei sita voi vahingossa ajaa tuotantoa vasten.
//
// Ajo:
//   firebase emulators:start --only firestore
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node lib/scripts/testSarjaEristys.js
// ============================================
import * as admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import { parsiKausiExcel } from '../services/kausiImport';
import { kirjoitaKausituonti } from '../services/kausiImportKirjoitus';
import { laskeKolmijako, luokitteleKansalaisuudet } from '../services/trendit';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'FIRESTORE_EMULATOR_HOST puuttuu. Tama testi kirjoittaa, joten se ' +
      'ajetaan vain emulaattoria vasten.',
  );
  process.exit(1);
}

let virheita = 0;
function vertaa(nimi: string, saatu: unknown, odotettu: unknown): void {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) console.log('  ✓ ' + nimi + ' = ' + a);
  else {
    virheita++;
    console.log('  ✗ ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

const OTSIKOT = [
  'Etunimi', 'Sukunimi', 'Kausi', 'Sarja', 'Sarjan vaihe', 'Joukkue',
  'Pelaajan ikä kaudella', 'Pelatut minuutit (min)', 'Pelatut ottelut',
  'Ottelut aloituksessa', 'Ottelut kokoonpanossa', 'Maalit',
  'Joukkueen ottelut sarjassa',
];

function tiedosto(rivit: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([OTSIKOT, ...rivit]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Yksi rivi. Oletus 900 minuuttia, joukkueella 10 ottelua (kapasiteetti
 * 9 900). Minuutit annetaan sarjoittain eri suuruisina, jotta mahdollinen
 * vuoto nakyisi lukuna eika peittyisi symmetriaan.
 */
function rivi(
  nimi: string,
  sarja: string,
  vaihe: string,
  joukkue: string,
  minuutit = 900,
): unknown[] {
  const [etu, suku] = nimi.split(' ');
  return [etu, suku, '2026', sarja, vaihe, joukkue, 20, minuutit, 10, 10, 10, 0, 10];
}

async function main(): Promise<void> {
  admin.initializeApp({ projectId: 'pallonetti-fi' });
  const db = admin.firestore();
  const etuliite = 'testi_sarja_';

  // Sama joukkuenimi molemmissa sarjoissa: FC Lahti pelaa oikeastikin
  // eri kausina kummassakin. Jos sarja ei ole avaimessa, rivit osuvat
  // toisiinsa.
  const vl = parsiKausiExcel(
    tiedosto([
      rivi('Otto Ruoppi', 'Veikkausliiga', 'Runkosarja', 'FC Lahti'),
      rivi('Roni Hudd', 'Veikkausliiga', 'Runkosarja', 'KuPS'),
    ]),
  );
  const yl = parsiKausiExcel(
    tiedosto([
      // Sama pelaaja, ERI minuutit: vuoto nakyisi kolmijaossa lukuna.
      rivi('Otto Ruoppi', 'Ykkösliiga', 'Ykkösliiga', 'FC Lahti', 450),
      rivi('Joku Pelaaja', 'Ykkösliiga', 'Ykkösliiga', 'JäPS', 450),
    ]),
  );
  vertaa('molemmat tiedostot kelpaavat', [vl.virheet, yl.virheet], [[], []]);

  console.log('');
  console.log('1) VEIKKAUSLIIGA ENSIN');
  await kirjoitaKausituonti(db, vl, {
    kokoelmaEtuliite: etuliite,
    tuontiId: 'testi-vl-1',
    lahdeTiedosto: 'vl.xlsx',
    tilannekuvaPvm: false,
  });
  // Luetaan etuliitteellisesta kokoelmasta suoraan: lueKausi lukee
  // tuotantokokoelmista, joten tassa kaytetaan omaa kyselya.
  const lueTesti = async (sarja: string) => {
    const s = await db.collection(etuliite + 'suoritukset').where('kausi', '==', '2026').get();
    const n = await db.collection(etuliite + 'nimittajat').where('kausi', '==', '2026').get();
    const omat = (x: { sarja?: string; vanhentunut?: boolean }) =>
      (x.sarja || 'Veikkausliiga') === sarja && x.vanhentunut !== true;
    return {
      suoritukset: s.docs.map((d) => d.data()).filter(omat),
      nimittajat: n.docs.map((d) => d.data()).filter(omat),
    };
  };
  const vlEnnen = await lueTesti('Veikkausliiga');
  vertaa('VL suorituksia', vlEnnen.suoritukset.length, 2);
  vertaa(
    'VL kapasiteetti',
    vlEnnen.nimittajat.reduce((a, x) => a + (x.kapasiteetti_min as number), 0),
    19800,
  );

  console.log('');
  console.log('2) YKKÖSLIIGA SAMALLE KAUDELLE');
  const ylYhteenveto = await kirjoitaKausituonti(db, yl, {
    kokoelmaEtuliite: etuliite,
    tuontiId: 'testi-yl-1',
    lahdeTiedosto: 'yl.xlsx',
    tilannekuvaPvm: false,
  });
  // TAMA ON TESTIN YDIN: Ykkosliigan tuonti ei saa koskea Veikkausliigaan.
  vertaa('VL-suorituksia ei merkitty vanhentuneiksi', ylYhteenveto.vanhentuneet.length, 0);
  vertaa('VL-nimittäjiä ei merkitty vanhentuneiksi', ylYhteenveto.vanhentuneetNimittajat.length, 0);
  vertaa('VL-projektioita ei merkitty vanhentuneiksi', ylYhteenveto.vanhentuneetProjektiot.length, 0);

  const vlJalkeen = await lueTesti('Veikkausliiga');
  vertaa('VL suorituksia ennallaan', vlJalkeen.suoritukset.length, 2);
  vertaa(
    'VL kapasiteetti ennallaan',
    vlJalkeen.nimittajat.reduce((a, x) => a + (x.kapasiteetti_min as number), 0),
    19800,
  );
  const ylJalkeen = await lueTesti('Ykkösliiga');
  vertaa('YL suorituksia', ylJalkeen.suoritukset.length, 2);
  vertaa(
    'YL kapasiteetti erikseen',
    ylJalkeen.nimittajat.reduce((a, x) => a + (x.kapasiteetti_min as number), 0),
    19800,
  );

  // Sama pelaaja molemmissa sarjoissa: kaksi eri dokumenttia.
  const projektiot = await db
    .collection(etuliite + 'seasons')
    .doc('2026')
    .collection('players')
    .get();
  const ruopit = projektiot.docs.filter((d) => (d.data().slug as string) === 'otto-ruoppi');
  vertaa('sama pelaaja molemmissa sarjoissa -> 2 projektiota', ruopit.length, 2);
  vertaa(
    'projektioiden tunnisteet',
    ruopit.map((d) => d.id).sort(),
    ['veikkausliiga_otto-ruoppi', 'ykkosliiga_otto-ruoppi'],
  );

  console.log('');
  console.log('3) SAMAN SARJAN UUSINTATUONTI VANHENTAA VAIN OMANSA');
  const vlUusi = parsiKausiExcel(
    tiedosto([rivi('Otto Ruoppi', 'Veikkausliiga', 'Runkosarja', 'FC Lahti')]),
  );
  const vlYhteenveto = await kirjoitaKausituonti(db, vlUusi, {
    kokoelmaEtuliite: etuliite,
    tuontiId: 'testi-vl-2',
    lahdeTiedosto: 'vl2.xlsx',
    tilannekuvaPvm: false,
  });
  // Hudd poistui lahteesta -> vanhentuu. Ykkosliigan rivit eivat.
  vertaa(
    'vanhentuneet ovat vain Veikkausliigan',
    vlYhteenveto.vanhentuneet.map((v) => v.id).sort(),
    ['veikkausliiga_2026_Runkosarja_KuPS_roni hudd'],
  );
  const ylLopuksi = await lueTesti('Ykkösliiga');
  vertaa('YL suorituksia yhä 2', ylLopuksi.suoritukset.length, 2);

  console.log('');
  console.log('4) TILANNEKUVAT ERI SARJOILLE');
  // Tilannekuva on kehityskayran lahde. Jos kaksi sarjaa kirjoittaisi
  // saman paivan samaan dokumenttiin, kayra sekoittaisi sarjat.
  const pvm = '2026-09-21';
  await kirjoitaKausituonti(db, vl, {
    kokoelmaEtuliite: etuliite,
    tuontiId: 'testi-vl-tk',
    lahdeTiedosto: 'vl.xlsx',
    tilannekuvaPvm: pvm,
  });
  await kirjoitaKausituonti(db, yl, {
    kokoelmaEtuliite: etuliite,
    tuontiId: 'testi-yl-tk',
    lahdeTiedosto: 'yl.xlsx',
    tilannekuvaPvm: pvm,
  });
  const tkSnap = await db
    .collection(etuliite + 'seasons')
    .doc('2026')
    .collection('tilannekuvat')
    .get();
  vertaa(
    'saman päivän tilannekuvat ovat eri dokumentteja',
    tkSnap.docs.map((d) => d.id).sort(),
    ['veikkausliiga_2026-09-21', 'ykkosliiga_2026-09-21'],
  );
  vertaa(
    'tilannekuva kertoo sarjansa',
    tkSnap.docs.map((d) => d.data().sarja).sort(),
    ['Veikkausliiga', 'Ykkösliiga'],
  );
  const vlTk = tkSnap.docs.find((d) => d.id.startsWith('veikkausliiga'))!;
  const vlTkPelaajat = await vlTk.ref.collection('pelaajat').get();
  vertaa(
    'tilannekuvan pelaajat ovat vain oman sarjan',
    vlTkPelaajat.docs.map((d) => d.id).sort(),
    ['veikkausliiga_otto-ruoppi', 'veikkausliiga_roni-hudd'],
  );

  console.log('');
  console.log('5) KANSALAISUUS LASKEE VAIN OMAN SARJAN MINUUTIT');
  // Kansalaisuusdokumentti on kausikohtainen ja yhteinen molemmille
  // sarjoille (avain on slug). Jos sarjarajaus vuotaisi, Ykkosliigan
  // minuutit nakyisivat Veikkausliigan kolmijaossa.
  await db
    .collection(etuliite + 'seasons')
    .doc('2026')
    .collection('kansalaisuudet')
    .doc('otto-ruoppi')
    .set({
      slug: 'otto-ruoppi',
      nimi: 'Otto Ruoppi',
      vlKansalaisuus: 'FIN',
      seura_vahvistettu: true,
      suomalainen: 'kylla',
    });
  // laskeTrendit lukee tuotantokokoelmista, joten tassa lasketaan
  // kolmijako samoilla palasilla kuin reitti sen laskee.
  const lueKolmijako = async (sarja: string) => {
    const { suoritukset, nimittajat } = await lueTesti(sarja);
    const kansSnap = await db
      .collection(etuliite + 'seasons')
      .doc('2026')
      .collection('kansalaisuudet')
      .get();
    const kapasiteetti = nimittajat.reduce(
      (a, x) => a + (x.kapasiteetti_min as number),
      0,
    );
    const luokat = luokitteleKansalaisuudet(kansSnap.docs);
    return laskeKolmijako(
      suoritukset as unknown as Parameters<typeof laskeKolmijako>[0],
      kapasiteetti,
      luokat,
      20,
    );
  };
  // Veikkausliigassa Ruopilla on 900 min / 19 800 min = 4,5 %.
  // Ykkosliigassa samalla pelaajalla 450 min / 19 800 min = 2,3 %.
  // Jos sarjarajaus vuotaisi, VL nayttaisi 6,8 % (900 + 450).
  vertaa('Veikkausliigan FIN-osuus', (await lueKolmijako('Veikkausliiga'))?.fin, 4.5);
  vertaa('Ykkösliigan FIN-osuus', (await lueKolmijako('Ykkösliiga'))?.fin, 2.3);

  console.log('');
  console.log('6) SIIVOUS');
  for (const kok of ['suoritukset', 'nimittajat', 'kaudet']) {
    const snap = await db.collection(etuliite + kok).get();
    for (const d of snap.docs) await d.ref.delete();
    console.log('  poistettu ' + snap.size + ' dokumenttia: ' + etuliite + kok);
  }
  const kausiRef = db.collection(etuliite + 'seasons').doc('2026');
  const pSnap = await kausiRef.collection('players').get();
  for (const d of pSnap.docs) await d.ref.delete();
  console.log('  poistettu ' + pSnap.size + ' projektiota');
  const kSnap = await kausiRef.collection('kansalaisuudet').get();
  for (const d of kSnap.docs) await d.ref.delete();
  console.log('  poistettu ' + kSnap.size + ' kansalaisuusdokumenttia');
  const tSnap = await kausiRef.collection('tilannekuvat').get();
  for (const d of tSnap.docs) {
    const p = await d.ref.collection('pelaajat').get();
    for (const x of p.docs) await x.ref.delete();
    await d.ref.delete();
  }
  console.log('  poistettu ' + tSnap.size + ' tilannekuvaa');

  console.log('');
  console.log(
    virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
  );
  process.exit(virheita === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Ajo epaonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
