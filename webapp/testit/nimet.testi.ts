// ============================================
// TESTI — nimien näyttöasu
//
// Lähteen kirjoitusasu vaihtelee rivistä toiseen, joten muunnoksen on
// kestettävä kaikki muodot. Väliviivat ja heittomerkit ovat se kohta,
// jossa naiivi "isolla alkuun" menee rikki.
//
//   cd webapp
//   npx esbuild testit/nimet.testi.ts --bundle --platform=node \
//     --format=cjs --outfile=/tmp/nimet.cjs --alias:@=./src && node /tmp/nimet.cjs
// ============================================
import { naytaNimi, naytaKokoNimi } from '../src/utils/nimet';

let virheita = 0;
function vertaa(saatu: string, odotettu: string) {
  if (saatu === odotettu) console.log('  OK  ' + JSON.stringify(saatu));
  else { virheita++; console.log('  EI  odotettu ' + JSON.stringify(odotettu) + ', saatu ' + JSON.stringify(saatu)); }
}

vertaa(naytaNimi('alex RAMULA'), 'Alex Ramula');
vertaa(naytaNimi('OSKU MAUKONEN'), 'Osku Maukonen');
vertaa(naytaNimi('Aapo BOSTRÖM'), 'Aapo Boström');
vertaa(naytaNimi('OSKARI TAPIO PAAVOLA'), 'Oskari Tapio Paavola');
// Valiviiva: molemmat osat isolla.
vertaa(naytaNimi('LE GOFF-CONAN'), 'Le Goff-Conan');
vertaa(naytaNimi('de NASCIMENTO'), 'De Nascimento');
vertaa(naytaNimi('kelwin souza DO NASCIMENTO'), 'Kelwin Souza Do Nascimento');
// Heittomerkki.
vertaa(naytaNimi("o'BRIEN"), "O'Brien");
vertaa(naytaNimi('N’DIAYE'), 'N’Diaye');
// Skandit ja ylimaaraiset valit.
vertaa(naytaNimi('  JÄRVINEN   ääKKÖNEN '), 'Järvinen Ääkkönen');
// Tyhja arvo ei saa tuottaa tekstia "undefined".
vertaa(naytaNimi(null), '');
vertaa(naytaNimi(''), '');
vertaa(naytaKokoNimi('OTTO', 'ruoppi'), 'Otto Ruoppi');
vertaa(naytaKokoNimi('JEFF', 'Selenge'), 'Jeff Selenge');
vertaa(naytaKokoNimi(null, 'HUDD'), 'Hudd');

console.log(virheita === 0 ? 'Kaikki vaitteet pitivat.' : virheita + ' vaitetta petti.');
process.exit(virheita === 0 ? 0 : 1);
