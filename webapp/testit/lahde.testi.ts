// ============================================
// TESTI — lähdemaininta
//
// Lähdemaininta näkyy jokaisella luvut esittävällä sivulla. Jos se
// muodostettaisiin komponenteissa, sama lähde eriytyisi sivu kerrallaan
// — testi pitää huolen siitä, että molemmat sarjat saavat oikean
// muodon yhdestä paikasta.
//
//   cd webapp
//   npx esbuild testit/lahde.testi.ts --bundle --platform=node \
//     --format=cjs --outfile=/tmp/lahde.cjs --alias:@=./src && node /tmp/lahde.cjs
// ============================================
import { lahdeMaininta, lahdeRivi, sarjaGenetiivi } from '../src/constants/lahde';

let virheita = 0;
function vertaa(nimi: string, saatu: unknown, odotettu: unknown) {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) console.log('  OK  ' + nimi + ' = ' + a);
  else {
    virheita++;
    console.log('  EI  ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

console.log('MOLEMMAT SARJAT');
vertaa(
  'Veikkausliiga',
  lahdeMaininta('Veikkausliiga'),
  'Veikkausliigan viralliset tilastot (kausivienti)',
);
vertaa(
  'Ykkösliiga',
  lahdeMaininta('Ykkösliiga'),
  'Ykkösliigan viralliset tilastot (kausivienti)',
);

console.log('');
console.log('ETULIITTEELLINEN MUOTO');
vertaa(
  'Veikkausliiga',
  lahdeRivi('Veikkausliiga'),
  'Lähde: Veikkausliigan viralliset tilastot (kausivienti)',
);
vertaa(
  'Ykkösliiga',
  lahdeRivi('Ykkösliiga'),
  'Lähde: Ykkösliigan viralliset tilastot (kausivienti)',
);

console.log('');
console.log('GENETIIVI');
vertaa('Veikkausliiga', sarjaGenetiivi('Veikkausliiga'), 'Veikkausliigan');
vertaa('Ykkösliiga', sarjaGenetiivi('Ykkösliiga'), 'Ykkösliigan');
// Ylimääräiset välilyönnit eivät saa pudottaa taivutusta.
vertaa('välit siedetään', sarjaGenetiivi('  Ykkösliiga '), 'Ykkösliigan');

console.log('');
console.log('TUNTEMATON SARJA');
// Tuntematon sarja EI saa arvattua taivutusta: muoto on oikein, muttei
// nimeä sarjaa. Näin uusi sarja ei tuota "Kakkosliigaan"-tyyppistä virhettä.
vertaa('tuntematon', sarjaGenetiivi('Kakkonen'), 'sarjan');
vertaa(
  'tuntematon maininta',
  lahdeMaininta('Kakkonen'),
  'sarjan viralliset tilastot (kausivienti)',
);
vertaa('tyhjä', lahdeMaininta(''), 'sarjan viralliset tilastot (kausivienti)');

console.log('');
console.log('EI MERKKIJONOTAIVUTUSTA');
// `${sarja}n` sattuu toimimaan näillä kahdella, mutta se on sama arvaus
// joka tuottaa "Ilves:n" seurojen kohdalla. Testi kiinnittää tuloksen
// karttaan, ei sääntöön.
for (const sarja of ['Veikkausliiga', 'Ykkösliiga']) {
  vertaa(
    sarja + ': maininta sisältää genetiivin',
    lahdeMaininta(sarja).startsWith(sarjaGenetiivi(sarja) + ' '),
    true,
  );
}

console.log('');
console.log(virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.');
process.exit(virheita === 0 ? 0 : 1);
