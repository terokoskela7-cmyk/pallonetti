// ============================================
// REGRESSIOTESTI — Veikkausliigan profiilisivun jäsennys
//
// Jäsentäjä lukee kaksi asiaa, joista molemmat ovat jo kerran menneet
// väärin tuotannossa:
//
//  1. Kansalaisuuskoodi. Veikkausliiga sekoittaa alpha-2- ja alpha-3-
//     koodeja samassa kentässä ("FIN" ja "Fi"). Aiempi regex vaati kolme
//     isoa kirjainta, jolloin jokainen alpha-2-pelaaja putosi pois —
//     ja juuri niitä on vanhoilla kausilla eniten.
//
//  2. Kauden seura. Tilastolistan seura-sarake tarkoittaa eri asiaa
//     päättyneellä ja kuluvalla kaudella, joten seura on luettava
//     profiilin kauden tilastoriviltä. Rivin jäsennyksessä syntymävuosi
//     osui aluksi kauden kaavaan.
//
// Ajo:  node lib/scripts/testProfiiliParsinta.js
// ============================================
import * as fs from 'fs';
import * as path from 'path';
import { parsiProfiili } from './haeKansalaisuudet';

const HAKEMISTO = path.join(__dirname, '../../test/fixtures/profiilit');

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

function lue(tiedosto: string): string {
  return fs.readFileSync(path.join(HAKEMISTO, tiedosto), 'utf-8');
}

console.log('PROFIILIN JÄSENNYS');
console.log('');

// ---------- 1. Yksi seura, alpha-3-koodi ----------
console.log('yksi-seura.html (Ruoppi, FIN, KuPS)');
{
  const p = parsiProfiili(lue('yksi-seura.html'), '276307');
  vertaa('kansalaisuudet', p.kansalaisuudet, ['FIN']);
  vertaa('syntymävuosi', p.syntymavuosi, 2006);
  vertaa('kauden 2026 seurat', p.kaudenSeurat?.['2026'], ['KuPS']);
  vertaa('kauden 2025 seurat', p.kaudenSeurat?.['2025'], ['KuPS']);
  // Syntymävuosi 2006 EI saa päätyä kausiksi.
  vertaa('syntymävuosi ei ole kausi', p.kaudenSeurat?.['2006'], undefined);
}

// ---------- 2. Useampi seura samalla kaudella ----------
console.log('');
console.log('useampi-seura.html (Suso, GMB, SJK + FC Inter)');
{
  const p = parsiProfiili(lue('useampi-seura.html'), '1303047');
  vertaa('kansalaisuudet', p.kansalaisuudet, ['GMB']);
  // Molempien seurojen on löydyttävä: vahvistukseen riittää että datan
  // seura on jommassakummassa.
  vertaa('kauden 2026 seurat', p.kaudenSeurat?.['2026'], ['SJK', 'FC Inter']);
}

// ---------- 3. Alpha-2-koodi + syntymävuosi joka näyttää kaudelta ----------
console.log('');
console.log('syntymavuosi-nayttaa-kaudelta.html (koodi "Fi", synt. 2007)');
{
  const p = parsiProfiili(lue('syntymavuosi-nayttaa-kaudelta.html'), '1');
  // "Fi" normalisoituu FIN:ksi — ilman tätä pelaaja katoaisi.
  vertaa('kansalaisuudet', p.kansalaisuudet, ['FIN']);
  vertaa('syntymävuosi', p.syntymavuosi, 2007);
  vertaa('kauden 2026 seurat', p.kaudenSeurat?.['2026'], ['Ilves']);
  vertaa('syntymävuosi ei ole kausi', p.kaudenSeurat?.['2007'], undefined);
}

// ---------- 4. Profiili ilman kauden riviä → "ei tietoa" ----------
console.log('');
console.log('ei-kauden-rivia.html (ei tilastorivejä)');
{
  const p = parsiProfiili(lue('ei-kauden-rivia.html'), '99');
  vertaa('kansalaisuudet', p.kansalaisuudet, ['SWE']);
  // Kauden riviä ei ole, joten seuraa ei voi varmentaa. Kutsuja tulkitsee
  // tyhjän listan "ei tietoa" -tilaksi eikä arvaa seuraa.
  vertaa('kaudenSeurat tyhjä', p.kaudenSeurat, {});
  vertaa('kauden 2026 seurat', p.kaudenSeurat?.['2026'], undefined);
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
