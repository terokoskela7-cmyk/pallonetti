// ============================================
// TESTI — vertailurivin sanamuodot
//
// Rivin muoto riippuu "ei tietoa" -osuudesta, ja valimuoto ei esiinny
// nykyisella datalla lainkaan (kaikilla kausilla ei tietoa < 0,5 pp).
// Ilman testia se haara jaisi kokonaan ajamatta.
//
// Webappissa ei ole testiajuria, joten tama on itsenainen skripti:
//   cd webapp
//   npx esbuild testit/vertailu.testi.ts --bundle --platform=node \
//     --format=cjs --outfile=/tmp/vertailu.cjs --alias:@=./src && \
//     node /tmp/vertailu.cjs
// ============================================
import { vertailurivinTeksti } from '../src/utils/vertailu';

let virheita = 0;
function vertaa(nimi: string, saatu: string, odotettu: string) {
  if (saatu === odotettu) console.log('  OK  ' + nimi + ': ' + saatu);
  else { virheita++; console.log('  EI  ' + nimi + '\n      odotettu: ' + odotettu + '\n      saatu:    ' + saatu); }
}

// 1. Kausi 2026: ei tietoa alle 0,5 pp -> yksi luku
vertaa('2026 (ei tietoa 0,0)',
  vertailurivinTeksti(13.0, { fin: 10.2, muu: 2.8, eiTietoa: 0.0 }),
  'Alle 21-vuotiaat 13,0 % · Suomen kansalaisille 10,2 % · Tanska 11,7 % (CIES 2025)');

// 2. Ei tietoa vahintaan 0,5 pp -> vali
vertaa('vali (ei tietoa 2,2)',
  vertailurivinTeksti(13.0, { fin: 8.1, muu: 2.7, eiTietoa: 2.2 }),
  'Alle 21-vuotiaat 13,0 % · Suomen kansalaisille 8,1–10,3 % · Tanska 11,7 % (CIES 2025)');

// 3. Raja-arvo 0,5 kuuluu valiin
vertaa('raja 0,5 -> vali',
  vertailurivinTeksti(13.0, { fin: 10.2, muu: 2.3, eiTietoa: 0.5 }),
  'Alle 21-vuotiaat 13,0 % · Suomen kansalaisille 10,2–10,7 % · Tanska 11,7 % (CIES 2025)');

// 4. Kolmijako puuttuu kaudelta
vertaa('ei kolmijakoa',
  vertailurivinTeksti(13.0, null),
  'Alle 21-vuotiaat 13,0 % · Suomen kansalaisten osuus: ei tietoa · Tanska 11,7 % (CIES 2025)');

console.log(virheita === 0 ? 'Kaikki vaitteet pitivat.' : virheita + ' vaitetta petti.');
process.exit(virheita === 0 ? 0 : 1);
