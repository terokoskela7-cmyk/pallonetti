// ============================================
// TARKISTUS — luetaan Firestoresta, ei tiedostosta
//
// Hyväksymiskriteerit on laskettava siitä datasta joka on tosiasiassa
// kirjoitettu, ei parserin muistista. Tämä ajaa samat kyselyt jotka
// korvaavien endpointtien (/api/youth-stats, /api/players, /api/teams)
// on määrä ajaa, ja vertaa tuloksia briefin lukuihin.
//
// Käyttö:
//   export FIRESTORE_EMULATOR_HOST=localhost:8080
//   node lib/scripts/tarkistaKausituonti.js [--etuliite testi_]
// ============================================
import * as admin from 'firebase-admin';

function argumentti(nimi: string): string | undefined {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const ETULIITE = argumentti('etuliite') || '';
let virheita = 0;

function vertaa(nimi: string, saatu: unknown, odotettu: unknown): void {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) {
    console.log('  ✓ ' + nimi + ' = ' + a);
  } else {
    virheita++;
    console.log('  ✗ ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

interface SuoritusData {
  kausi: string;
  vaihe: string;
  joukkue: string;
  pelaajaAvain: string;
  minuutit: number;
  ika: number;
  vanhentunut?: boolean;
}

interface NimittajaData {
  kausi: string;
  vaihe: string;
  kapasiteetti_min: number;
}

async function main(): Promise<void> {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi' });
  const db = admin.firestore();

  const suoritukset = (
    await db.collection(ETULIITE + 'suoritukset').get()
  ).docs.map((d) => d.data() as SuoritusData);
  const nimittajat = (
    await db.collection(ETULIITE + 'nimittajat').get()
  ).docs.map((d) => d.data() as NimittajaData);
  const kaudet = (await db.collection(ETULIITE + 'kaudet').get()).docs;

  console.log('DOKUMENTTIMÄÄRÄT');
  vertaa('suoritukset', suoritukset.length, 1136);
  vertaa('nimittajat', nimittajat.length, 148);
  vertaa('kaudet', kaudet.length, 6);

  let projektioita = 0;
  for (const k of kaudet) {
    const snap = await db
      .collection(ETULIITE + 'seasons')
      .doc(k.id)
      .collection('players')
      .get();
    projektioita += snap.size;
  }
  vertaa('seasons/{kausi}/players', projektioita, 697);

  // ---- Nuorten osuus laskettuna Firestoresta ----
  // osuus = Σ minuutit / Σ kapasiteetti_min, kauden kaikkien seurojen ja
  // vaiheiden yli. Sama kaava kuin dry-runissa.
  console.log('');
  console.log('NUORTEN OSUUS (laskettu Firestore-dokumenteista)');
  const odotetut: Record<string, [string, string]> = {
    '2020': ['18,0 %', '18,0 %'],
    '2024': ['15,3 %', '14,9 %'],
    '2025': ['15,9 %', '15,4 %'],
  };
  for (const kausi of Object.keys(odotetut)) {
    const min = suoritukset
      .filter((s) => s.kausi === kausi && !s.vanhentunut)
      .reduce((a, s) => a + s.minuutit, 0);
    const kap = nimittajat
      .filter((n) => n.kausi === kausi)
      .reduce((a, n) => a + n.kapasiteetti_min, 0);
    const rsMin = suoritukset
      .filter((s) => s.kausi === kausi && s.vaihe === 'Runkosarja' && !s.vanhentunut)
      .reduce((a, s) => a + s.minuutit, 0);
    const rsKap = nimittajat
      .filter((n) => n.kausi === kausi && n.vaihe === 'Runkosarja')
      .reduce((a, n) => a + n.kapasiteetti_min, 0);
    const muoto = (x: number): string => (x * 100).toFixed(1).replace('.', ',') + ' %';
    vertaa(
      'kausi ' + kausi + ' [koko kausi, runkosarja]',
      [muoto(min / kap), muoto(rsMin / rsKap)],
      odotetut[kausi],
    );
  }

  // ---- Runkosarja 22 ottelua joka kaudella ----
  console.log('');
  console.log('RAKENNE');
  const rsKapasiteetit = new Set(
    nimittajat.filter((n) => n.vaihe === 'Runkosarja').map((n) => n.kapasiteetti_min),
  );
  vertaa(
    'runkosarjan kapasiteetti yhtenäinen (22 × 90 × 11)',
    Array.from(rsKapasiteetit),
    [22 * 90 * 11],
  );

  // ---- Otto Ruoppi: kausisumma yli vaiheiden ----
  console.log('');
  console.log('PELAAJAKOHTAISET');
  for (const [kausi, odotettuMin, odotettuIka] of [
    ['2024', 887, 18],
    ['2025', 2388, 19],
  ] as [string, number, number][]) {
    const rivit = suoritukset.filter(
      (s) => s.pelaajaAvain === 'otto ruoppi' && s.kausi === kausi,
    );
    vertaa(
      'Otto Ruoppi ' + kausi + ' [min, ikä]',
      [rivit.reduce((a, s) => a + s.minuutit, 0), rivit[0] ? rivit[0].ika : null],
      [odotettuMin, odotettuIka],
    );
  }

  // ---- Siirtyneen pelaajan seurakohtaiset minuutit ----
  const hudd = suoritukset.filter(
    (s) => s.pelaajaAvain === 'roni hudd' && s.kausi === '2025',
  );
  const perSeura: Record<string, number> = {};
  for (const s of hudd) {
    perSeura[s.joukkue] = (perSeura[s.joukkue] || 0) + s.minuutit;
  }
  const seurat = Object.keys(perSeura).sort();
  const summa = Object.values(perSeura).reduce((a, b) => a + b, 0);
  vertaa('Roni Hudd 2025 seurat', seurat, ['FC Haka', 'HJK']);
  vertaa(
    'kausisumma = seurojen summa',
    summa,
    perSeura['FC Haka'] + perSeura['HJK'],
  );
  console.log(
    '     (FC Haka ' + perSeura['FC Haka'] + ' min, HJK ' + perSeura['HJK'] + ' min)',
  );

  const proj = await db
    .collection(ETULIITE + 'seasons')
    .doc('2025')
    .collection('players')
    .doc('roni-hudd')
    .get();
  const p = proj.data() as { minTotal?: number; joukkueet?: string[] } | undefined;
  vertaa('projektion minTotal = sama summa', p ? p.minTotal : null, summa);
  vertaa('projektio säilyttää molemmat seurat', p ? p.joukkueet : null, [
    'FC Haka',
    'HJK',
  ]);

  console.log('');
  if (virheita > 0) {
    console.log('TARKISTUS EPÄONNISTUI — ' + virheita + ' väitettä ei pitänyt.');
    process.exit(1);
  }
  console.log('Kaikki väitteet pitivät.');
}

main().catch((err) => {
  console.error('Tarkistus epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
