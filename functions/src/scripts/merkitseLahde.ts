// ============================================
// LÄHDEMERKINTÄ transfermarkt_players -dokumentteihin
//
// Lisää kentän `lahde` niihin dokumentteihin, jotka on haettu suoraan
// transfermarkt.com:ista. Muita kenttiä ei muuteta eikä mitään poisteta.
//
// CLAUDE.md 3.5: kirjoitus tuotantoon vaatii KAKSI lippua
// (--tuotanto --vahvista) ja käyttäjän chatissa antaman hyväksynnän.
// Ilman lippuja ajo listaa vain kohteet eikä kirjoita mitään.
//
// Käyttö:
//   node lib/scripts/merkitseLahde.js                      (listaus)
//   node lib/scripts/merkitseLahde.js --tuotanto --vahvista
// ============================================
import * as admin from 'firebase-admin';

const LAHDE_ARVO = 'transfermarkt.com (suora haku, ei enää käytössä)';
/** Päivä jolloin suora haku ajettiin. */
const PAIVA = '2026-09-19';

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

async function main(): Promise<void> {
  const vahvista = lippu('vahvista');
  const tuotanto = lippu('tuotanto');

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi' });
  const db = admin.firestore();

  const snap = await db.collection('transfermarkt_players').get();
  const kohteet = snap.docs.filter((d) => {
    const x = d.data();
    return (
      x.source === 'transfermarkt.com' &&
      typeof x.fetchedAt === 'string' &&
      x.fetchedAt.startsWith(PAIVA)
    );
  });

  console.log('='.repeat(66));
  console.log('LÄHDEMERKINTÄ — ' + (vahvista && tuotanto ? 'KIRJOITUS' : 'LISTAUS'));
  console.log('Ehto: source = "transfermarkt.com" JA fetchedAt alkaa ' + PAIVA);
  console.log('Lisättävä kenttä: lahde = "' + LAHDE_ARVO + '"');
  console.log('='.repeat(66));
  console.log('');
  console.log('Kokoelmassa yhteensä: ' + snap.size + ' dokumenttia');
  console.log('Muutettavia:          ' + kohteet.length);
  console.log('');
  for (const d of kohteet) {
    const x = d.data();
    console.log(
      '  ' +
        d.id.padEnd(10) +
        '  ' +
        String(x.name ?? '').padEnd(24) +
        '  ' +
        (x.lahde === undefined ? 'ei lahde-kenttää' : 'lahde JO ASETETTU'),
    );
  }

  if (!vahvista || !tuotanto) {
    console.log('');
    console.log(
      'Listaus vain. Kirjoitus vaatii --tuotanto JA --vahvista (CLAUDE.md 3.5).',
    );
    return;
  }

  console.log('');
  console.log('KIRJOITETAAN — vain lahde-kenttä, update() ei set()');
  let n = 0;
  for (const d of kohteet) {
    // update() koskee vain annettuun kenttaan: muut kentat sailyvat
    // koskemattomina eika mitaan poisteta.
    await d.ref.update({ lahde: LAHDE_ARVO });
    n++;
  }
  console.log('  paivitetty: ' + n + ' dokumenttia');
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
