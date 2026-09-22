// ============================================
// TARKISTUS — seuravertailu tuotannon dataa vasten
//
// LUKEE VAIN. Ei kirjoita mitaan.
//
// Yksikkotesti todistaa, etta laskenta toimii annetulla aineistolla.
// Tama skripti todistaa, etta aineisto on sellaista kuin laskenta
// olettaa:
//
//   1. seurakohtaiset osuudet tasmaavat kauden omaan lukuun
//      (Σ seuran minuutit = liigan minuutit, Σ kapasiteetti = liigan
//      kapasiteetti) — jos ne eroavat, taulukko ja etusivu kertoisivat
//      eri tarinan samasta kaudesta
//   2. yksikaan osuus ei ole rajojen ulkopuolella (0–100 %)
//   3. puuttuva kausi on null eika 0
//   4. seuran tunniste on pysyva kausien yli: sama tunniste ei saa
//      kahta eri nimea eika sama nimi kahta tunnistetta
//
// Ajo:  node lib/scripts/tarkistaSeurat.js
// ============================================
import * as admin from 'firebase-admin';
import { lueKausi } from '../services/kausiData';
import {
  laskeSeurakausi,
  laskeSeuratrendit,
  laskeVertailuviivat,
  seuraTunniste,
  laskeSuhdeYlaraja,
  LIUKUVA_IKKUNA,
  type Seurakausi,
} from '../services/seurat';
import { TUETUT_SARJAT, OLETUSSARJA } from '../services/kausiImport';
import { kokoaSeuranSivu } from '../services/seuranSivu';

function pros(x: number | null): string {
  return x === null ? 'ei dataa' : x.toFixed(1).replace('.', ',') + ' %';
}

async function main(): Promise<void> {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();

  let virheita = 0;
  const moiti = (viesti: string): void => {
    virheita++;
    console.log('  ✗ ' + viesti);
  };

  const kaudetSnap = await db.collection('kaudet').get();
  // Talletetaan kaikkien sarjojen aineisto, jotta suhdeluvut voi laskea
  // koko aineistosta lopuksi — ei vain sarjaa vaihtaneille seuroille.
  const kaikkiSarjat = new Map<string, Map<number, Seurakausi[]>>();

  for (const sarja of TUETUT_SARJAT) {
    const kaudet = Array.from(
      new Set(
        kaudetSnap.docs
          .map((d) => d.data())
          .filter((k) => k.vanhentunut !== true)
          .filter((k) => ((k.sarja as string) || OLETUSSARJA) === sarja)
          .map((k) => (k.vuosi as number) ?? parseInt(String(k.kausi), 10))
          .filter((v) => !isNaN(v)),
      ),
    ).sort((a, b) => a - b);

    console.log('');
    console.log('='.repeat(78));
    console.log(sarja + ' — kaudet ' + kaudet.join(', ') + ' (luetaan vain)');
    console.log('='.repeat(78));

    const kausittain = new Map<number, Seurakausi[]>();

    for (const kausi of kaudet) {
      const { suoritukset, nimittajat } = await lueKausi(db, kausi, sarja);
      const seurat = laskeSeurakausi(kausi, sarja, suoritukset, nimittajat);
      kausittain.set(kausi, seurat);

      // 1. Summat tasmaavat kauden omaan lukuun.
      const kapSeurat = seurat.reduce((a, s) => a + s.kapasiteettiMin, 0);
      const minSeurat = seurat.reduce((a, s) => a + s.nuortenMinuutit, 0);
      const kapLiiga = nimittajat.reduce((a, n) => a + n.kapasiteetti_min, 0);
      const minLiiga = suoritukset.reduce((a, s) => a + s.minuutit, 0);
      if (kapSeurat !== kapLiiga) {
        moiti(kausi + ': kapasiteetti ' + kapSeurat + ' ≠ liigan ' + kapLiiga);
      }
      if (minSeurat !== minLiiga) {
        moiti(kausi + ': minuutit ' + minSeurat + ' ≠ liigan ' + minLiiga);
      }

      // 2. Rajat.
      for (const s of seurat) {
        if (s.osuus !== null && (s.osuus < 0 || s.osuus > 100)) {
          moiti(kausi + ' ' + s.nimi + ': osuus ' + s.osuus + ' % rajojen ulkopuolella');
        }
        if (s.ottelut <= 0) {
          moiti(kausi + ' ' + s.nimi + ': ottelumaara ' + s.ottelut);
        }
      }

      const viiva = laskeVertailuviivat([kausi], kausittain)[0];
      console.log(
        '  ' + kausi + ': ' + seurat.length + ' seuraa · kaikki ' +
          pros(viiva.kaikki) + ' · ilman akatemioita ' +
          pros(viiva.ilmanAkatemioita),
      );
    }

    kaikkiSarjat.set(sarja, kausittain);

    // 4. Tunnisteen pysyvyys kausien yli.
    const nimetTunnisteelle = new Map<string, Set<string>>();
    const tunnisteetNimelle = new Map<string, Set<string>>();
    for (const seurat of kausittain.values()) {
      for (const s of seurat) {
        if (!nimetTunnisteelle.has(s.tunniste)) {
          nimetTunnisteelle.set(s.tunniste, new Set());
        }
        nimetTunnisteelle.get(s.tunniste)!.add(s.nimi);
        if (!tunnisteetNimelle.has(s.nimi)) {
          tunnisteetNimelle.set(s.nimi, new Set());
        }
        tunnisteetNimelle.get(s.nimi)!.add(s.tunniste);
      }
    }
    for (const [tunniste, nimet] of nimetTunnisteelle) {
      if (nimet.size > 1) {
        moiti(
          'tunniste ' + tunniste + ' vastaa useaa nimea: ' +
            Array.from(nimet).join(', ') + ' — kirjaa nimenmuutos karttaan',
        );
      }
    }
    for (const [nimi, tunnisteet] of tunnisteetNimelle) {
      if (tunnisteet.size > 1) {
        moiti('nimi ' + nimi + ' vastaa useaa tunnistetta: ' + Array.from(tunnisteet).join(', '));
      }
    }

    // 3. Katkot: puuttuva kausi on null, ei 0.
    const trendit = laskeSeuratrendit(kaudet, kausittain);
    console.log('');
    console.log('  AIKASARJAT (liukuva ikkuna ' + LIUKUVA_IKKUNA + ' kautta)');
    for (const t of trendit) {
      const kentta = t.pisteet
        .map((p) => (p === null ? '  —  ' : p.toFixed(1).padStart(5)))
        .join(' ');
      console.log(
        '    ' + t.nimi.padEnd(15) + (t.akatemia ? '[akatemia] ' : '           ') + kentta,
      );
      const puuttuvat = t.pisteet.filter((p) => p === null).length;
      if (puuttuvat > 0 && t.kaudetMukana.length + puuttuvat !== kaudet.length) {
        moiti(t.nimi + ': katkojen ja kausien summa ei tasmaa');
      }
      for (let i = 0; i < t.pisteet.length; i++) {
        if (t.pisteet[i] === null && t.liukuva[i] !== null) {
          moiti(t.nimi + ': liukuva keskiarvo laskettu katkon yli');
        }
      }
    }
    console.log('    ' + ' '.repeat(26) + kaudet.map((k) => String(k).padStart(5)).join(' '));
  }

  // --- 5. Seuran oma sivu: sarjaa vaihtaneet seurat --------------------
  // Naiden kohdalla sivu nayttaa kauden kohdalla, missa sarjassa seura
  // pelasi, eika laske sarjojen lukuja yhteen. Akseli kattaa molemmat
  // sarjat, joten se on leveampi kuin kummankaan sarjan oma akseli.
  const tunnisteetSarjoittain = new Map<string, Set<string>>();
  for (const sarja of TUETUT_SARJAT) {
    const snap = await db.collection('nimittajat').get();
    for (const d of snap.docs) {
      const n = d.data();
      if (n.vanhentunut === true) continue;
      if (((n.sarja as string) || OLETUSSARJA) !== sarja) continue;
      const t = seuraTunniste(String(n.joukkue));
      if (!tunnisteetSarjoittain.has(t)) tunnisteetSarjoittain.set(t, new Set());
      tunnisteetSarjoittain.get(t)!.add(sarja);
    }
  }
  const monessaSarjassa = Array.from(tunnisteetSarjoittain.entries())
    .filter(([, sarjat]) => sarjat.size > 1)
    .map(([t]) => t)
    .sort();

  console.log('');
  console.log('='.repeat(78));
  console.log(
    'SEURAT MOLEMMISSA SARJOISSA (' + monessaSarjassa.length + ') — seuran sivu',
  );
  console.log('='.repeat(78));

  const viimeisinKausi = Math.max(
    ...TUETUT_SARJAT.flatMap((sarja) =>
      kaudetSnap.docs
        .map((d) => d.data())
        .filter((k) => k.vanhentunut !== true)
        .filter((k) => ((k.sarja as string) || OLETUSSARJA) === sarja)
        .map((k) => (k.vuosi as number) ?? parseInt(String(k.kausi), 10))
        .filter((v) => !isNaN(v)),
    ),
  );

  for (const tunniste of monessaSarjassa) {
    const sivu = await kokoaSeuranSivu(db, viimeisinKausi, tunniste);
    if (sivu === null) {
      moiti(tunniste + ': kokoaSeuranSivu palautti null vaikka seura on datassa');
      continue;
    }
    console.log('');
    console.log(
      '  ' + sivu.nimi + ' (' + tunniste + ')  akselit: osuus 0–' +
        sivu.ylaraja + ' %, suhde 0–' + sivu.ylarajaSuhde +
        '  sarjat: ' + sivu.sarjatMukana.join(', '),
    );
    console.log(
      '    kausi  sarja            osuus  sarjan taso   suhde  liukuva',
    );
    for (let i = 0; i < sivu.aikasarja.pisteet.length; i++) {
      const p = sivu.aikasarja.pisteet[i];
      const liuk = sivu.aikasarja.liukuva[i];
      const luku = (x: number | null, d = 1): string =>
        x === null ? '—' : x.toFixed(d).replace('.', ',');
      console.log(
        '    ' + p.kausi + '   ' + (p.sarja ?? 'ei sarjassa').padEnd(14) +
          luku(p.osuus).padStart(6) + ' %' +
          luku(p.sarjanTaso).padStart(9) + ' %' +
          luku(p.suhdeluku).padStart(8) +
          luku(liuk).padStart(9),
      );
      // Suhdeluku vaatii sarjan tason: jos taso on, suhdeluvun on oltava.
      if (p.osuus !== null && p.sarjanTaso !== null && p.suhdeluku === null) {
        moiti(sivu.nimi + ' ' + p.kausi + ': suhdeluku puuttuu vaikka taso on');
      }
      // Liukuva lasketaan SUHDELUVUSTA: sita ei saa olla ilman suhdelukua.
      if (liuk !== null && p.suhdeluku === null) {
        moiti(sivu.nimi + ' ' + p.kausi + ': liukuva katkon paalla');
      }
    }
    if (!sivu.aikasarja.useitaSarjoja) {
      moiti(sivu.nimi + ': useitaSarjoja on false vaikka seura on kahdessa sarjassa');
    }
  }

  // --- 6. Suhdeluvun aariarvot koko aineistossa -----------------------
  // Jokaisella seuralla on oma sivu ja oma akseli. Jos akseli leikkaisi
  // yhdenkin pisteen, kaavio valehtelisi. Tarkistetaan seurakohtaisesti,
  // etta akseli kattaa seuran omat luvut, ja raportoidaan aariarvot.
  interface Aari {
    arvo: number;
    seura: string;
    kausi: number;
    sarja: string;
  }
  let suurin: Aari | null = null;
  let pienin: Aari | null = null;
  const suhteetSeuroittain = new Map<string, { nimi: string; arvot: number[] }>();

  for (const [sarja, kausittain] of kaikkiSarjat) {
    const omatKaudet = Array.from(kausittain.keys()).sort((a, b) => a - b);
    const viivat = new Map(
      laskeVertailuviivat(omatKaudet, kausittain).map((v) => [v.kausi, v.kaikki]),
    );
    for (const kausi of omatKaudet) {
      const taso = viivat.get(kausi) ?? null;
      if (taso === null || taso <= 0) continue;
      for (const s of kausittain.get(kausi) || []) {
        if (s.osuus === null) continue;
        const suhde = Math.round((s.osuus / taso) * 10) / 10;
        if (suurin === null || suhde > suurin.arvo) {
          suurin = { arvo: suhde, seura: s.nimi, kausi, sarja };
        }
        if (pienin === null || suhde < pienin.arvo) {
          pienin = { arvo: suhde, seura: s.nimi, kausi, sarja };
        }
        if (!suhteetSeuroittain.has(s.tunniste)) {
          suhteetSeuroittain.set(s.tunniste, { nimi: s.nimi, arvot: [] });
        }
        suhteetSeuroittain.get(s.tunniste)!.arvot.push(suhde);
      }
    }
  }

  console.log('');
  console.log('='.repeat(78));
  console.log('SUHDELUVUN AARIARVOT KOKO AINEISTOSSA');
  console.log('='.repeat(78));
  const naytaAari = (nimi: string, a: Aari | null): void => {
    console.log(
      '  ' + nimi + ': ' +
        (a === null
          ? 'ei lukuja'
          : a.arvo.toFixed(1).replace('.', ',') + '  ' + a.seura + '  ' +
            a.kausi + '  ' + a.sarja),
    );
  };
  naytaAari('suurin ', suurin);
  naytaAari('pienin ', pienin);

  // Leikkaako yhdenkaan seuran akseli sen omia lukuja?
  let leikkaavia = 0;
  for (const [tunniste, { nimi, arvot }] of suhteetSeuroittain) {
    const ylaraja = laskeSuhdeYlaraja(arvot);
    const omaSuurin = Math.max(...arvot);
    if (omaSuurin > ylaraja) {
      leikkaavia++;
      moiti(
        nimi + ' (' + tunniste + '): akseli 0–' + ylaraja +
          ' leikkaa suurimman arvon ' + omaSuurin,
      );
    }
  }
  console.log(
    '  akseli kattaa seuran omat luvut: ' +
      (suhteetSeuroittain.size - leikkaavia) + ' / ' + suhteetSeuroittain.size +
      ' seuraa',
  );

  console.log('');
  console.log('='.repeat(78));
  console.log(
    virheita === 0
      ? 'Kaikki tarkistukset menivat lapi.'
      : virheita + ' tarkistusta petti.',
  );
  process.exit(virheita === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
