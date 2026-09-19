// ============================================
// KAUSITUONNIN AJO — esikatselu ja kirjoitus
//
// Oletuksena EI kirjoita. Kirjoitus vaatii --vahvista, ja kirjoitus
// tuotantoon vaatii lisäksi --tuotanto. Ilman niitä ajo kohdistuu
// emulaattoriin (FIRESTORE_EMULATOR_HOST) ja pysähtyy jos sitä ei ole.
//
// Emulaattori:
//   firebase emulators:start --only firestore
//   export FIRESTORE_EMULATOR_HOST=localhost:8080
//   node lib/scripts/tuoKausituonti.js "tiedosto.xlsx" --vahvista
//
// Erillinen testikokoelma oikeassa Firestoressa:
//   node lib/scripts/tuoKausituonti.js "tiedosto.xlsx" --etuliite testi_ \
//     --tuotanto --vahvista
// ============================================
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { parsiKausiExcel } from '../services/kausiImport';
import {
  arvioiMuutokset,
  kirjoitaKausituonti,
} from '../services/kausiImportKirjoitus';

function argumentti(nimi: string): string | undefined {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

function pros(x: number): string {
  return (x * 100).toFixed(1).replace('.', ',') + ' %';
}

async function main(): Promise<void> {
  const polku = process.argv[2];
  if (!polku || polku.startsWith('--')) {
    console.error('Anna Excel-tiedoston polku ensimmäisenä argumenttina.');
    process.exit(1);
  }

  const vahvista = lippu('vahvista');
  const tuotanto = lippu('tuotanto');
  const etuliite = argumentti('etuliite') || '';
  const kierrosRaaka = argumentti('kierros');
  const kierros = kierrosRaaka ? parseInt(kierrosRaaka, 10) : null;

  if (kierros !== null && (isNaN(kierros) || kierros < 1 || kierros > 34)) {
    console.error('--kierros on oltava 1–34 (tilannemerkintä, ei tunniste).');
    process.exit(1);
  }

  const emulaattori = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulaattori && !tuotanto) {
    console.error(
      'FIRESTORE_EMULATOR_HOST puuttuu. Käynnistä emulaattori tai anna ' +
        '--tuotanto jos kohde on oikea Firestore.',
    );
    process.exit(1);
  }
  if (tuotanto && !etuliite) {
    console.error(
      'Tuotantoon kirjoittaminen ilman --etuliite ylikirjoittaisi oikeat ' +
        'kokoelmat. Anna esim. --etuliite testi_ .',
    );
    process.exit(1);
  }

  const tulos = parsiKausiExcel(fs.readFileSync(polku));

  console.log('='.repeat(66));
  console.log('KAUSITUONTI — ' + (vahvista ? 'KIRJOITUS' : 'ESIKATSELU'));
  console.log('Tiedosto:  ' + polku);
  console.log('Kohde:     ' + (emulaattori ? 'emulaattori ' + emulaattori : 'TUOTANTO'));
  console.log('Kokoelmat: ' + (etuliite || '(tuotantonimet)'));
  console.log('='.repeat(66));

  if (tulos.virheet.length > 0) {
    console.log('');
    console.log('TIEDOSTO HYLÄTÄÄN — ' + tulos.virheet.length + ' virhettä:');
    for (const v of tulos.virheet.slice(0, 20)) console.log('  ✗ ' + v);
    process.exit(1);
  }

  console.log('');
  console.log('LUETTU');
  console.log('  rivejä ' + tulos.rivitLuettu + ', käyttökelpoisia ' +
    tulos.suoritukset.length + ', ohitettu ' + tulos.ohitetut.length);
  for (const o of tulos.ohitetut) console.log('     rivi ' + o.rivi + ': ' + o.syy);
  console.log('');
  for (const k of tulos.kaudet) {
    console.log(
      '  ' + k.kausi + ': ' + k.rivit + ' riviä · ' + k.pelaajat + ' pelaajaa · ' +
        'osuus ' + pros(k.osuus_koko_kausi) + ' (runkosarja ' +
        pros(k.osuus_runkosarja) + ')',
    );
  }

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi' });
  const db = admin.firestore();

  const arvio = await arvioiMuutokset(db, tulos, {
    kokoelmaEtuliite: etuliite,
    tuontiId: 'arvio',
    lahdeTiedosto: path.basename(polku),
  });

  console.log('');
  console.log('MUUTOKSET');
  console.log('  luodaan      ' + arvio.luodaan);
  console.log('  päivitetään  ' + arvio.paivitetaan);
  console.log('  vanhentuu    ' + arvio.vanhentuu);
  console.log('  lisäksi ' + tulos.nimittajat.length + ' nimittäjää, ' +
    tulos.kaudet.length + ' kautta, ' + tulos.projektiot.length + ' projektiota');

  if (!vahvista) {
    console.log('');
    console.log('Esikatselu vain. Kirjoitus vaatii --vahvista.');
    return;
  }

  const tuontiId =
    argumentti('tuonti-id') ||
    new Date().toISOString().replace(/[:.]/g, '-') + '_' + path.basename(polku);

  console.log('');
  console.log('KIRJOITETAAN — tuonti_id ' + tuontiId);
  const yhteenveto = await kirjoitaKausituonti(db, tulos, {
    kokoelmaEtuliite: etuliite,
    tuontiId,
    lahdeTiedosto: path.basename(polku),
    kierros,
  });

  console.log('  suoritukset  ' + yhteenveto.kirjoitettu.suoritukset);
  console.log('  nimittajat   ' + yhteenveto.kirjoitettu.nimittajat);
  console.log('  kaudet       ' + yhteenveto.kirjoitettu.kaudet);
  console.log('  projektiot   ' + yhteenveto.kirjoitettu.projektiot);
  console.log('  batcheja     ' + yhteenveto.batchejaAjettu);
  console.log('  vanhentuneita suorituksia merkitty: ' + yhteenveto.vanhentuneet.length);
  console.log('  vanhentuneita projektioita merkitty: ' +
    yhteenveto.vanhentuneetProjektiot.length);
  for (const v of yhteenveto.vanhentuneetProjektiot.slice(0, 5)) {
    console.log('     · seasons/' + v);
  }
  for (const v of yhteenveto.vanhentuneet.slice(0, 10)) {
    console.log('     · ' + v.id);
  }
  if (yhteenveto.vanhentuneet.length > 10) {
    console.log('     … ja ' + (yhteenveto.vanhentuneet.length - 10) + ' muuta');
  }
  console.log('');
  console.log('Valmis. Vanhentuneita EI poistettu — poisto on ihmisen päätös.');
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
