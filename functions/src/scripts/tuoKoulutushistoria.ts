// ============================================
// KOULUTUSHISTORIAN TUONTI — "Suomessa koulutettu" (UEFA association-trained)
//
// Lukee yhden tai useamman vientitiedoston (mitä tahansa sarjoja, sama
// sarakemuoto kuin kausituonnissa) ja laskee jokaiselle sivuston pelaajalle,
// monellako kaudella hän pelasi suomalaisessa seurassa 15–21-vuotiaana.
// Määritelmä ja rajaukset: services/koulutus.ts.
//
// Kaikki tiedostot annetaan samalla ajolla: dokumentti kirjoitetaan
// kokonaan uudelleen, joten osittainen ajo pienentäisi kausimääriä.
//
// Sivuston pelaajat = palloidit kokoelmassa `suoritukset` (vanhentuneet
// mukaan lukien). Muiden pelaajien historiaa ei tallenneta.
//
// Oletuksena EI kirjoita. Vartijat kuten kausituonnissa:
//   --vahvista            kirjoittaa
//   --tuotanto            kohde on oikea Firestore (muuten emulaattori)
//   --etuliite testi_     kirjoittaa kokoelmaan testi_koulutus
//   --oikeat-kokoelmat    kirjoittaa kokoelmaan koulutus
//   --offline             ei Firestorea lainkaan: sivuston pelaajat
//                         päätellään tiedostoista (VL / Ykkösliiga /
//                         Miesten Ykkönen, ikä 17–21). Vain esikatselu.
//
// Esim. esikatselu tuotantoa vasten (lukee suoritukset, ei kirjoita):
//   node lib/scripts/tuoKoulutushistoria.js a.xlsx b.xlsx c.xlsx --tuotanto
// ============================================
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import {
  KoulutusRivi,
  kokoaKoulutus,
  parsiKoulutusExcel,
  KOULUTUS_MIN_KAUSIA,
} from '../services/koulutus';

const ARVOLLISET = new Set(['etuliite', 'tuonti-id']);
const SIVUSTON_SARJAT = new Set(['Veikkausliiga', 'Ykkösliiga', 'Miesten Ykkönen']);
const BATCH = 400;

function argumentti(nimi: string): string | undefined {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

/** Positionaaliset argumentit = tiedostot (ohittaa lippujen arvot). */
function tiedostot(): string[] {
  const a = process.argv.slice(2);
  const t: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      if (ARVOLLISET.has(a[i].slice(2))) i++;
      continue;
    }
    t.push(a[i]);
  }
  return t;
}

async function main(): Promise<void> {
  const polut = tiedostot();
  if (polut.length === 0) {
    console.error('Anna vähintään yksi Excel-tiedosto.');
    process.exit(1);
  }
  const vahvista = lippu('vahvista');
  const tuotanto = lippu('tuotanto');
  const offline = lippu('offline');
  const etuliite = argumentti('etuliite') || '';
  const oikeatKokoelmat = lippu('oikeat-kokoelmat');
  const emulaattori = process.env.FIRESTORE_EMULATOR_HOST;

  if (offline && vahvista) {
    console.error('--offline on pelkkä esikatselu; --vahvista ei ole sallittu.');
    process.exit(1);
  }
  if (!offline && !emulaattori && !tuotanto) {
    console.error(
      'FIRESTORE_EMULATOR_HOST puuttuu. Käynnistä emulaattori, anna ' +
        '--tuotanto jos kohde on oikea Firestore, tai --offline.',
    );
    process.exit(1);
  }
  if (oikeatKokoelmat && etuliite) {
    console.error('--oikeat-kokoelmat ja --etuliite ovat ristiriidassa.');
    process.exit(1);
  }
  if (vahvista && tuotanto && !etuliite && !oikeatKokoelmat) {
    console.error(
      'Tuotantoon kirjoittaminen vaatii --etuliite (esim. testi_) tai ' +
        'tahallisen --oikeat-kokoelmat.',
    );
    process.exit(1);
  }

  console.log('='.repeat(66));
  console.log('KOULUTUSHISTORIA — ' + (vahvista ? 'KIRJOITUS' : 'ESIKATSELU'));
  console.log('Kohde:     ' + (offline ? 'ei Firestorea (offline)' :
    emulaattori ? 'emulaattori ' + emulaattori : 'TUOTANTO'));
  console.log('Kokoelma:  ' + (etuliite || '') + 'koulutus');
  console.log('='.repeat(66));

  const rivit: KoulutusRivi[] = [];
  const ohitetut: Record<string, number> = {};
  let minKausi = Infinity;
  let maxKausi = -Infinity;
  for (const p of polut) {
    const l = parsiKoulutusExcel(fs.readFileSync(p));
    rivit.push(...l.rivit);
    for (const [s, n] of Object.entries(l.ohitetut)) ohitetut[s] = (ohitetut[s] ?? 0) + n;
    for (const r of l.rivit) {
      minKausi = Math.min(minKausi, r.kausi);
      maxKausi = Math.max(maxKausi, r.kausi);
    }
    console.log('  ' + path.basename(p) + ': ' + l.rivit.length + ' riviä 15–21-v.');
  }
  console.log('  ohitettu:');
  for (const [s, n] of Object.entries(ohitetut).sort((a, b) => b[1] - a[1])) {
    console.log('     ' + s + ': ' + n);
  }
  console.log('  kaudet aineistossa: ' + minKausi + '–' + maxKausi);

  let db: admin.firestore.Firestore | null = null;
  let sallitut: Set<string>;
  if (offline) {
    sallitut = new Set(
      rivit.filter((r) => SIVUSTON_SARJAT.has(r.sarja) && r.ika >= 17).map((r) => r.palloid),
    );
    console.log('');
    console.log('Sivuston pelaajat päätelty tiedostoista: ' + sallitut.size);
  } else {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi' });
    db = admin.firestore();
    const snap = await db.collection('suoritukset').select('palloid').get();
    sallitut = new Set();
    for (const d of snap.docs) {
      const p = d.get('palloid');
      if (typeof p === 'string' && p) sallitut.add(p);
    }
    console.log('');
    console.log('Sivuston pelaajat (suoritukset, palloid): ' + sallitut.size);
  }

  const tulos = kokoaKoulutus(rivit, sallitut);
  // Sivuston pelaaja ilman yhtään riviä tiedostoissa saa 0 kautta.
  for (const p of sallitut) {
    if (!tulos.has(p)) {
      tulos.set(p, { palloid: p, kaudet: {}, kausiaSuomessa: 0, koulutettuSuomessa: false });
    }
  }

  const jakauma = new Map<number, number>();
  for (const d of tulos.values()) {
    jakauma.set(d.kausiaSuomessa, (jakauma.get(d.kausiaSuomessa) ?? 0) + 1);
  }
  const koulutettu = [...tulos.values()].filter((d) => d.koulutettuSuomessa).length;
  console.log('');
  console.log('TULOS');
  console.log('  pelaajia                 ' + tulos.size);
  console.log('  Suomessa koulutettu (≥' + KOULUTUS_MIN_KAUSIA + ')  ' + koulutettu);
  console.log('  ei vahvistettu           ' + (tulos.size - koulutettu));
  console.log('  kausia 15–21-v. Suomessa:');
  for (const [k, n] of [...jakauma.entries()].sort((a, b) => a[0] - b[0])) {
    console.log('     ' + k + ': ' + n);
  }

  if (!vahvista || !db) {
    console.log('');
    console.log('Esikatselu vain. Kirjoitus vaatii --vahvista.');
    return;
  }

  const tuontiId =
    argumentti('tuonti-id') || new Date().toISOString().replace(/[:.]/g, '-');
  const kokoelma = etuliite + 'koulutus';
  if (tuotanto && oikeatKokoelmat) {
    console.log('');
    console.log('!'.repeat(66));
    console.log('KOHTEENA TUOTANNON OIKEA KOKOELMA koulutus — ' + tulos.size + ' dokumenttia');
    console.log('!'.repeat(66));
  }
  const docs = [...tulos.values()];
  let kirjoitettu = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const b = db.batch();
    for (const d of docs.slice(i, i + BATCH)) {
      b.set(db.collection(kokoelma).doc(d.palloid), {
        ...d,
        aineistoKaudet: { alku: minKausi, loppu: maxKausi },
        lahdeTiedostot: polut.map((p) => path.basename(p)),
        tuontiId,
        paivitetty: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await b.commit();
    kirjoitettu += Math.min(BATCH, docs.length - i);
  }
  console.log('');
  console.log('Kirjoitettu ' + kirjoitettu + ' dokumenttia kokoelmaan ' + kokoelma +
    ' (tuonti_id ' + tuontiId + ').');
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
