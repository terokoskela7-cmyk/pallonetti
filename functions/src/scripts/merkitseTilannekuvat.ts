// ============================================
// TILANNEKUVIEN MERKINNAT
//
// Kaksi taydennysta, jotka tekevat tilannekuvista luettavia
// kehityskayralle (B3):
//
//   1. Vanhassa tilannekuvassa (2026-09-19) ei ole sarja-kenttaa, koska
//      se kirjoitettiin ennen sarjajakoa. Puuttuva kentta luetaan
//      Veikkausliigaksi, mutta arvo kirjoitetaan nakyviin, jottei sita
//      tarvitse paatella.
//
//   2. Migraation luomat tilannekuvat ovat paattyneiden kausien
//      lopputiloja, eivat kauden aikaisia havaintoja. Ne merkitaan
//      lahteella, jotta kehityskayra voi jattaa ne pois.
//
// Sisaltoa ei muuteta: vain nama kaksi kenttaa lisataan.
//
// CLAUDE.md 3.5: kirjoitus tuotantoon vaatii KAKSI lippua.
//   node lib/scripts/merkitseTilannekuvat.js                       (listaus)
//   node lib/scripts/merkitseTilannekuvat.js --tuotanto --vahvista
// ============================================
import * as admin from 'firebase-admin';

/** Tilannekuva, jolta puuttuu sarja. Arvo on oletussarja. */
const SARJATON = { kausi: '2026', id: '2026-09-19', sarja: 'Veikkausliiga' };

/** Migraation luomat tilannekuvat: sama paiva, Veikkausliigan tunniste. */
const MIGRAATION_TUNNISTE = 'veikkausliiga_2026-09-20';
const MIGRAATION_KAUDET = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

async function main(): Promise<void> {
  const kirjoitetaan = lippu('vahvista') && lippu('tuotanto');
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();
  const tk = (kausi: string) =>
    db.collection('seasons').doc(kausi).collection('tilannekuvat');

  console.log('='.repeat(70));
  console.log(
    'TILANNEKUVIEN MERKINNAT — ' + (kirjoitetaan ? 'KIRJOITUS' : 'LISTAUS'),
  );
  console.log('='.repeat(70));

  // ---------- 1. sarja vanhaan tilannekuvaan ----------
  console.log('');
  console.log('1) sarja-kentta puuttuvaan tilannekuvaan');
  const vanha = await tk(SARJATON.kausi).doc(SARJATON.id).get();
  if (!vanha.exists) {
    console.log('  seasons/' + SARJATON.kausi + '/tilannekuvat/' + SARJATON.id + ' — EI LOYDY');
  } else {
    const x = vanha.data() ?? {};
    console.log(
      '  seasons/' + SARJATON.kausi + '/tilannekuvat/' + SARJATON.id +
        '  pelaajia ' + x.pelaajia + '  sarja nyt: ' +
        (x.sarja ? String(x.sarja) : '(ei kenttaa)') +
        '  ->  ' + SARJATON.sarja,
    );
    if (kirjoitetaan && !x.sarja) {
      await vanha.ref.update({ sarja: SARJATON.sarja });
      console.log('    kirjoitettu');
    }
  }

  // ---------- 2. lahde migraation tilannekuviin ----------
  console.log('');
  console.log('2) lahde: "migraatio" migraation luomiin tilannekuviin');
  let loydetty = 0;
  for (const kausi of MIGRAATION_KAUDET) {
    const doc = await tk(kausi).doc(MIGRAATION_TUNNISTE).get();
    if (!doc.exists) {
      console.log('  ' + kausi + '/' + MIGRAATION_TUNNISTE + ' — ei loydy');
      continue;
    }
    loydetty++;
    const x = doc.data() ?? {};
    console.log(
      '  seasons/' + kausi + '/tilannekuvat/' + MIGRAATION_TUNNISTE +
        '  pelaajia ' + x.pelaajia + '  lahde nyt: ' +
        (x.lahde ? String(x.lahde) : '(ei kenttaa)') + '  ->  migraatio',
    );
    if (kirjoitetaan) {
      await doc.ref.update({ lahde: 'migraatio' });
      console.log('    kirjoitettu');
    }
  }
  console.log('  loydetty ' + loydetty + '/' + MIGRAATION_KAUDET.length);

  if (!kirjoitetaan) {
    console.log('');
    console.log('Listaus vain. Kirjoitus vaatii --tuotanto JA --vahvista.');
    return;
  }

  // ---------- Tarkistus ----------
  console.log('');
  console.log('TARKISTUS');
  const v2 = await tk(SARJATON.kausi).doc(SARJATON.id).get();
  console.log('  ' + SARJATON.id + ' sarja: ' + String(v2.data()?.sarja));
  for (const kausi of MIGRAATION_KAUDET) {
    const d = await tk(kausi).doc(MIGRAATION_TUNNISTE).get();
    if (d.exists) console.log('  ' + kausi + ' lahde: ' + String(d.data()?.lahde));
  }
}

main().catch((err) => {
  console.error('Ajo epaonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
