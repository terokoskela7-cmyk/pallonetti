// ============================================
// TARKISTUS — trendipiste vastaa kauden omaa lukua
//
// LUKEE VAIN. Ei kirjoita mitaan.
//
// Trendikaavio ja kausinakyma nayttavat saman asian. Jos ne laskettaisiin
// eri tavoin, sivusto vaittaisi kahta eri totuutta, eika lukija tietaisi
// kumpi on oikea. Siksi jokainen trendipiste verrataan kahteen muuhun
// lahteeseen:
//
//   1. kaudet/{kausi}.osuus_koko_kausi — tuonnin laskema luku, eri
//      koodipolku ja laskettu Excelista tuontihetkella
//   2. kolmijaon summa — osien on summauduttava kokonaisosuudeksi
//   3. FIN on pyoristetty itsenaan, ei siirretty summan takia
//
// Ajo:  node lib/scripts/tarkistaTrendit.js
// ============================================
import * as admin from 'firebase-admin';
import { laskeTrendit, luokitteleKansalaisuudet } from '../services/trendit';
import { lueKausi } from '../services/kausiData';
import { ALLE_21_MAX } from '../services/ikarajat';

function pros(x: number | null): string {
  return x === null ? 'ei dataa' : x.toFixed(1).replace('.', ',') + ' %';
}

async function main(): Promise<void> {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();

  const trendit = await laskeTrendit(db);
  const kaudetSnap = await db.collection('kaudet').get();
  const kausiDocit = new Map(kaudetSnap.docs.map((d) => [d.id, d.data()]));

  let virheita = 0;
  console.log('='.repeat(78));
  console.log('TRENDIPISTE vs. KAUDEN OMA LUKU — luetaan vain');
  console.log('='.repeat(78));
  console.log('');
  console.log(
    'kausi  17–21    alle21   FIN      muu      ei tietoa  summa    tuonnin luku',
  );

  for (const t of trendit) {
    const doc = kausiDocit.get(String(t.kausi));
    const tuonnista =
      doc && typeof doc.osuus_koko_kausi === 'number'
        ? Math.round(doc.osuus_koko_kausi * 1000) / 10
        : null;
    const j = t.alle21Jako;
    const summa = j ? Math.round((j.fin + j.muu + j.eiTietoa) * 10) / 10 : null;

    console.log(
      String(t.kausi).padEnd(7) +
        pros(t.osuus1721).padEnd(9) +
        pros(t.osuusAlle21).padEnd(9) +
        pros(j ? j.fin : null).padEnd(9) +
        pros(j ? j.muu : null).padEnd(9) +
        pros(j ? j.eiTietoa : null).padEnd(11) +
        pros(summa).padEnd(9) +
        pros(tuonnista) +
        (t.kesken ? '   (kesken, ' + t.otteluitaPelattu + ' ottelua)' : ''),
    );

    // 1) Sama luku kuin tuonnin laskema kauden osuus.
    if (tuonnista !== null && t.osuus1721 !== tuonnista) {
      virheita++;
      console.log(
        '  ✗ ' + t.kausi + ': 17–21 trendissa ' + pros(t.osuus1721) +
          ', tuonnin kausidokumentissa ' + pros(tuonnista),
      );
    }
    // 2) Naytettyjen osien on summauduttava TASAN naytettyyn
    //    kokonaislukuun. Toleranssia ei anneta: lukija laskee osat yhteen
    //    ruudulta, ja 0,1 %-yksikon ero nakyy siina.
    if (summa !== null && t.osuusAlle21 !== null) {
      if (Math.round(summa * 10) !== Math.round(t.osuusAlle21 * 10)) {
        virheita++;
        console.log(
          '  ✗ ' + t.kausi + ': kolmijaon summa ' + pros(summa) +
            ' ei vastaa alle 21 -osuutta ' + pros(t.osuusAlle21),
        );
      }
    }
    // 3) FIN on naytettava luonnollisesti pyoristettyna. Suomen
    //    kansalaisten osuus on tarkein vertailuluku, eika sita siirreta
    //    muiden pyoristyksen takia. Poikkeus on vain se tapaus, jossa
    //    jaannos menisi negatiiviseksi.
    if (j) {
      const kausiData = await lueKausi(db, t.kausi);
      const kansSnap = await db
        .collection('seasons')
        .doc(String(t.kausi))
        .collection('kansalaisuudet')
        .get();
      const luokat = luokitteleKansalaisuudet(kansSnap.docs);
      const kap = kausiData.nimittajat.reduce(
        (a, n) => a + n.kapasiteetti_min,
        0,
      );
      const minuutit = (joukko: Set<string> | null): number =>
        kausiData.suoritukset
          .filter((x) => x.ika <= ALLE_21_MAX && (joukko === null || joukko.has(x.slug)))
          .reduce((a, x) => a + x.minuutit, 0);
      const finTarkka = (minuutit(luokat.fin) / kap) * 100;
      const muuTarkka = (minuutit(luokat.muu) / kap) * 100;
      const finLuonnollinen = Math.round(finTarkka * 10) / 10;
      const muuLuonnollinen = Math.round(muuTarkka * 10) / 10;
      const jaannos =
        Math.round(((t.osuusAlle21 ?? 0) - finLuonnollinen - muuLuonnollinen) * 10) / 10;
      if (jaannos >= 0 && j.fin !== finLuonnollinen) {
        virheita++;
        console.log(
          '  ✗ ' + t.kausi + ': FIN naytetaan ' + pros(j.fin) +
            ', luonnollinen pyoristys olisi ' + pros(finLuonnollinen) +
            ' (tarkka ' + finTarkka.toFixed(3) + ' %)',
        );
      }
    }

    // 4) Alle 21 ei voi olla suurempi kuin 17–21: sama joukko, tiukempi raja.
    if (
      t.osuusAlle21 !== null &&
      t.osuus1721 !== null &&
      t.osuusAlle21 > t.osuus1721
    ) {
      virheita++;
      console.log('  ✗ ' + t.kausi + ': alle 21 > 17–21');
    }
  }

  console.log('');
  console.log(
    virheita === 0
      ? 'Kaikki kaudet tasmaavat.'
      : virheita + ' poikkeamaa — trendi ja kausinakyma eivat vastaa toisiaan.',
  );
  process.exit(virheita === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Tarkistus epaonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
