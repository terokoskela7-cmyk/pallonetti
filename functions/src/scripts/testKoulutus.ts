// ============================================
// REGRESSIOTESTI — Suomessa koulutettu (≥3 kautta 15–21-v. suomalaisessa seurassa)
//
// 1) Kolme eri kautta eri sarjoista (myös väli välissä) → koulutettu.
//    Vastaa tapauksia, joissa pelaajan historia on aluesarjoissa
//    (esim. P15 Liiga, P17 SM) ennen aikuisten sarjaa.
// 2) Vain sivuston sarjan kausi → ei vahvistettu.
// 3) Maa-/aluejoukkue, alle 15-v. kausi, futsal-talvikausi ja
//    naisten sarja eivät kerrytä kausia.
// 4) Saman kauden kaksi seuraa = yksi kausi.
// 5) Sivustolla olemattoman pelaajan rivit jätetään pois.
//
// Ajo:  node lib/scripts/testKoulutus.js
// ============================================
import { kokoaKoulutus, koulutetutSlugit, suodataKoulutusRivit } from '../services/koulutus';

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

function r(palloid: string, kausi: string, ika: number, sarja: string, joukkue: string) {
  return {
    palloid,
    Kausi: kausi,
    'Pelaajan ikä kaudella': ika,
    Sarja: sarja,
    Joukkue: joukkue,
  };
}

const data = [
  // A: 2023, 2025, 2026 → 3 kautta
  r('A', '2023', 15, 'P15 Liiga Pohjoinen', 'VPS'),
  r('A', '2025', 17, 'P17 SM', 'VPS'),
  r('A', '2026', 18, 'Miesten Ykkönen', 'VPS Akatemia'),
  r('A', '2026', 18, 'Veikkausliiga', 'VPS'),
  // B: vain yksi kausi
  r('B', '2026', 20, 'Veikkausliiga', 'HJK'),
  // C: vain yksi kelpaava kausi
  r('C', '2021', 14, 'P14 Ykkönen', 'SJK'),
  r('C', '2022', 15, 'P15 Ykkönen', 'Suomi (P2007)'),
  r('C', '2022-23', 15, 'P15 Futsal-liiga', 'SJK'),
  r('C', '2023', 16, 'Naisten Ykkönen', 'SJK'),
  r('C', '2024', 17, 'P17 SM', 'SJK'),
  r('C', '2025', 22, 'Miesten Kakkonen', 'SJK'),
  // D: ei sivustolla
  r('D', '2022', 15, 'P15 Ykkönen', 'KuPS'),
  r('D', '2023', 16, 'P16 Ykkönen', 'KuPS'),
  r('D', '2024', 17, 'P17 SM', 'KuPS'),
  // selite / tyhjä rivi
  { palloid: null, Kausi: null },
];

const { rivit, ohitetut } = suodataKoulutusRivit(data);
console.log('Suodatus');
vertaa('kelpaavia rivejä', rivit.length, 9);
vertaa('maa- tai aluejoukkue', ohitetut['maa- tai aluejoukkue'], 1);
vertaa('futsal-talvikausi', ohitetut['talvikausi (futsal)'], 1);
vertaa('naisten sarja', ohitetut['naisten tai tyttöjen sarja'], 1);
vertaa('ikä', ohitetut['ikä 15–21 ulkopuolella'], 2);

const t = kokoaKoulutus(rivit, new Set(['A', 'B', 'C']));
console.log('Kokoaminen');
vertaa('A kausia', t.get('A')?.kausiaSuomessa, 3);
vertaa('A koulutettu', t.get('A')?.koulutettuSuomessa, true);
vertaa('A 2026 seurat', t.get('A')?.kaudet['2026'], ['VPS', 'VPS Akatemia']);
vertaa('B koulutettu', t.get('B')?.koulutettuSuomessa, false);
vertaa('C kausia', t.get('C')?.kausiaSuomessa, 1);
vertaa('C koulutettu', t.get('C')?.koulutettuSuomessa, false);
vertaa('D ei mukana', t.has('D'), false);

console.log('Slug-joukko');
vertaa('ei tietoa → null', koulutetutSlugit([{ slug: 'a', palloid: 'A' }], null), null);
vertaa(
  'vain koulutetut, rivi ilman palloidia pois',
  [...(koulutetutSlugit(
    [
      { slug: 'a', palloid: 'A' },
      { slug: 'b', palloid: 'B' },
      { slug: 'x', palloid: null },
    ],
    new Set(['A', 'X']),
  ) ?? [])],
  ['a'],
);

if (virheita > 0) {
  console.log(virheita + ' virhettä');
  process.exit(1);
}
console.log('OK');
