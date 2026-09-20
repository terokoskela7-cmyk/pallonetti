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
import { lueKausi } from '../services/kausiData';
import { laskeTrendit } from '../services/trendit';

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

/** Yksi rivi: 900 minuuttia, joukkueella 10 ottelua (kapasiteetti 9900). */
function rivi(nimi: string, sarja: string, vaihe: string, joukkue: string): unknown[] {
  const [etu, suku] = nimi.split(' ');
  return [etu, suku, '2026', sarja, vaihe, joukkue, 20, 900, 10, 10, 10, 0, 10];
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
      rivi('Otto Ruoppi', 'Ykkösliiga', 'Ykkösliiga', 'FC Lahti'),
      rivi('Joku Pelaaja', 'Ykkösliiga', 'Ykkösliiga', 'JäPS'),
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
  console.log('4) SIIVOUS');
  for (const kok of ['suoritukset', 'nimittajat', 'kaudet']) {
    const snap = await db.collection(etuliite + kok).get();
    for (const d of snap.docs) await d.ref.delete();
    console.log('  poistettu ' + snap.size + ' dokumenttia: ' + etuliite + kok);
  }
  const pSnap = await db.collection(etuliite + 'seasons').doc('2026').collection('players').get();
  for (const d of pSnap.docs) await d.ref.delete();
  console.log('  poistettu ' + pSnap.size + ' projektiota');

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
