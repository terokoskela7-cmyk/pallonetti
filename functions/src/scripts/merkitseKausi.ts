// ============================================
// KAUDEN MERKINTÄ PÄÄTTYNEEKSI (tai takaisin keskeneräiseksi)
//
// Trendi ja etusivu merkitsevät kauden keskeneräiseksi, ellei
// kausidokumentissa ole valmis-kenttää: kuluva kalenterivuosi päätellään
// muuten kesken olevaksi (services/trendit.ts, onKesken). Kun kausi on
// pelattu loppuun ennen vuodenvaihdetta, se merkitään tällä.
//
// Sama vartija kuin kausituonnissa (CLAUDE.md 3.5): oletuksena esikatselu,
// kirjoitus vaatii --vahvista JA --tuotanto. Kirjoitus on merge, joten
// tuonnin kentät säilyvät, ja tuonti kirjoittaa kausidokumentin myös
// mergenä, joten merkintä säilyy uudelleentuonnissa.
//
//   node lib/scripts/merkitseKausi.js --kausi 2026 --sarja Veikkausliiga --tuotanto
//   node lib/scripts/merkitseKausi.js --kausi 2026 --sarja Veikkausliiga --tuotanto --vahvista
//   (--kesken palauttaa keskeneräiseksi)
// ============================================
import * as admin from 'firebase-admin';
import { kausiId, TUETUT_SARJAT } from '../services/kausiImport';

function argumentti(nimi: string): string | undefined {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

async function main(): Promise<void> {
  const kausi = argumentti('kausi');
  const sarja = argumentti('sarja');
  const vahvista = lippu('vahvista');
  const tuotanto = lippu('tuotanto');
  const valmis = !lippu('kesken');

  if (!kausi || !/^\d{4}$/.test(kausi)) {
    console.error('Anna --kausi VVVV.');
    process.exit(1);
  }
  if (!sarja || !(TUETUT_SARJAT as readonly string[]).includes(sarja)) {
    console.error('Anna --sarja, yksi näistä: ' + TUETUT_SARJAT.join(', ') + '.');
    process.exit(1);
  }
  if (!tuotanto && !process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('Kohde puuttuu: anna --tuotanto tai aseta FIRESTORE_EMULATOR_HOST.');
    process.exit(1);
  }

  admin.initializeApp({ projectId: 'pallonetti-fi' });
  const db = admin.firestore();
  const id = kausiId({ sarja, kausi });
  const ref = db.collection('kaudet').doc(id);
  const snap = await ref.get();

  console.log('==================================================================');
  console.log('KAUDEN MERKINTÄ — ' + (vahvista ? 'KIRJOITUS' : 'ESIKATSELU'));
  console.log('Kohde:     ' + (tuotanto ? 'TUOTANTO' : 'emulaattori'));
  console.log('Dokumentti kaudet/' + id);
  console.log('==================================================================');

  if (!snap.exists) {
    console.error('Kausidokumenttia ei ole. Tuo kausi ensin.');
    process.exit(1);
  }
  const d = snap.data() ?? {};
  if (d.vanhentunut === true) {
    console.error('Kausidokumentti on merkitty vanhentuneeksi. Ei muuteta.');
    process.exit(1);
  }
  console.log('  nyt:   valmis = ' + (typeof d.valmis === 'boolean' ? d.valmis : '(puuttuu → päätellään kalenterista)'));
  console.log('  uusi:  valmis = ' + valmis);
  console.log('  tuonti_id ' + (d.tuonti_id ?? '(puuttuu)') + ' · ottelut_max ' + (d.ottelut_max ?? '(puuttuu)'));

  if (!vahvista) {
    console.log('');
    console.log('Esikatselu vain. Kirjoitus vaatii --vahvista.');
    return;
  }
  await ref.set({ valmis, valmisMerkitty: new Date().toISOString() }, { merge: true });
  console.log('');
  console.log('Kirjoitettu.');
}

main().catch((e) => {
  console.error('Ajo epäonnistui:', e instanceof Error ? e.message : e);
  process.exit(1);
});
