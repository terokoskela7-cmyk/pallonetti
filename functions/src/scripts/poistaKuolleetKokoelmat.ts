// ============================================
// KUOLLEIDEN VALIMUISTIKOKOELMIEN POISTO
//
// Kolme kokoelmaa jai orvoiksi, kun ulkoinen tilastorajapinta
// poistettiin tyossa 4. Niita kirjoitti vain poistettu koodi, eika
// yksikaan reitti tai sivu lue niita enaa:
//
//   u21_round_trend   kierroskohtainen trendi (reitti poistettu)
//   players_cache     pelaajaprofiilit (reitti poistettu)
//   player_fixtures   pelaajan ottelurivit (reitti poistettu)
//
// CLAUDE.md 3.5: poisto on aina ihmisen paatos, ja poistettavan
// dokumentin sisalto kirjataan ennen poistoa. Siksi skripti tulostaa
// AINA jokaisen dokumentin tunnisteen, kirjoitusajan ja koon — myos
// kirjoitusajossa, jolloin loki jaa talteen.
//
// Ilman lippuja skripti vain listaa. Poisto vaatii KAKSI lippua:
//   node lib/scripts/poistaKuolleetKokoelmat.js                       (listaus)
//   node lib/scripts/poistaKuolleetKokoelmat.js --tuotanto --vahvista (poisto)
// ============================================
import * as admin from 'firebase-admin';

const KOKOELMAT = ['u21_round_trend', 'players_cache', 'player_fixtures'];

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

async function main(): Promise<void> {
  const vahvista = lippu('vahvista');
  const tuotanto = lippu('tuotanto');
  const poistetaan = vahvista && tuotanto;

  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();

  console.log('='.repeat(70));
  console.log(
    'KUOLLEET VALIMUISTIKOKOELMAT — ' + (poistetaan ? 'POISTO' : 'LISTAUS'),
  );
  console.log('='.repeat(70));

  const yhteenveto: Array<{ kokoelma: string; maara: number }> = [];

  for (const kokoelma of KOKOELMAT) {
    const snap = await db.collection(kokoelma).get();
    yhteenveto.push({ kokoelma, maara: snap.size });

    console.log('');
    console.log(kokoelma + ': ' + snap.size + ' dokumenttia');
    for (const d of snap.docs) {
      const x = d.data();
      const aika =
        (x.cachedAt as string) ||
        (x.updatedAt as string) ||
        (x.fetchedAt as string) ||
        '(ei aikaleimaa)';
      const koko = JSON.stringify(x).length;
      console.log(
        '  ' +
          d.id.padEnd(16) +
          '  kirjoitettu ' +
          String(aika).padEnd(26) +
          koko +
          ' merkkia  kentat: ' +
          Object.keys(x).join(','),
      );
    }
  }

  console.log('');
  console.log('YHTEENSA: ' + yhteenveto.reduce((a, y) => a + y.maara, 0) + ' dokumenttia');
  for (const y of yhteenveto) console.log('  ' + y.kokoelma.padEnd(18) + y.maara);

  if (!poistetaan) {
    console.log('');
    console.log(
      'Listaus vain. Poisto vaatii --tuotanto JA --vahvista (CLAUDE.md 3.5).',
    );
    return;
  }

  console.log('');
  console.log('POISTETAAN');
  for (const kokoelma of KOKOELMAT) {
    const snap = await db.collection(kokoelma).get();
    let n = 0;
    // Erissa, jottei yksi batch kasva liian suureksi. Maarat ovat
    // pienia, mutta sama rakenne kestaa isommankin kokoelman.
    let batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
      if (++n % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (n % 400 !== 0 || n === 0) await batch.commit();
    console.log('  ' + kokoelma.padEnd(18) + 'poistettu ' + n + ' dokumenttia');
  }

  console.log('');
  console.log('TARKISTUS POISTON JALKEEN');
  for (const kokoelma of KOKOELMAT) {
    const snap = await db.collection(kokoelma).get();
    console.log(
      '  ' + kokoelma.padEnd(18) + snap.size + ' dokumenttia' +
        (snap.size === 0 ? '  ✓' : '  ✗ JAI DOKUMENTTEJA'),
    );
  }
}

main().catch((err) => {
  console.error('Ajo epaonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
