// ============================================
// REGRESSIOTESTI — sarjatasot, läpimurrot ja debyytin jälkeen
//
// Ajo:  node lib/scripts/testLapimurrot.js
// ============================================
import { sarjanTaso, tasonSarja } from '../services/sarjatasot';
import { laskeLapimurrot, type LapimurtoRivi } from '../services/lapimurrot';

let virheita = 0;
function vertaa(nimi: string, saatu: unknown, odotettu: unknown): void {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) console.log('  ✓ ' + nimi + ' = ' + a);
  else {
    virheita++;
    console.log('  ✗ ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

console.log('SARJATASOT');
vertaa('Ykkönen 2023', sarjanTaso('Miesten Ykkönen', 2023), 2);
vertaa('Ykkönen 2024', sarjanTaso('Miesten Ykkönen', 2024), 3);
vertaa('Ykkösliiga 2023 (ei ollut)', sarjanTaso('Ykkösliiga', 2023), null);
vertaa('Ykkösliiga 2024', sarjanTaso('Ykkösliiga', 2024), 2);
vertaa('VL', sarjanTaso('Veikkausliiga', 2021), 1);
vertaa('taso 2 2023', tasonSarja(2, 2023), 'Miesten Ykkönen');
vertaa('taso 2 2025', tasonSarja(2, 2025), 'Ykkösliiga');
vertaa('taso 3 2022', tasonSarja(3, 2022), null);

const VL = 'Veikkausliiga';
const YL = 'Ykkösliiga';
const YK = 'Miesten Ykkönen';
function r(
  slug: string, sarja: string, kausi: number, ika: number, joukkue: string, minuutit: number,
  palloid: string | null = null,
): LapimurtoRivi {
  return { slug, nimi: slug, sarja, kausi, ika, joukkue, minuutit, palloid };
}
// Joukkueella 27 ottelua → 2430 min; 20 % = 486 min.
const ott = new Map<string, number>();
for (const k of [2022, 2023, 2024, 2025]) ott.set(VL + '|' + k + '|HJK', 27);

const rivit: LapimurtoRivi[] = [
  // Aineiston ensimmäinen VL-kausi: debyytti ei tiedossa
  r('vanha', VL, 2022, 20, 'HJK', 1000),
  // Ykkönen 2022 (taso 2) → VL 2023 debyytti 300 min → 2024 600 min (kasvoi)
  // Vanhoilla VL-riveillä ei palloidia: yhdistyy slugin kautta.
  r('aku', YK, 2022, 18, 'KPV', 2000, '111'),
  r('aku', VL, 2023, 19, 'HJK', 300),
  r('aku', VL, 2024, 20, 'HJK', 600, '111'),
  // Debyytti 2023 500 min (vakiintunut heti, läpimurto heti) → 2024 alempi sarja
  r('beni', VL, 2023, 18, 'HJK', 500, '222'),
  r('beni', YL, 2024, 19, 'TPS', 1500, '222'),
  // Debyytti 21-vuotiaana → seuraavana vuonna ei datassa: täytti 22
  r('cale', VL, 2023, 21, 'HJK', 100, '333'),
  // Debyytti 2023 → 2024 VL-kokoonpanossa ilman minuutteja
  r('dani', VL, 2023, 18, 'HJK', 200, '444'),
  r('dani', VL, 2024, 19, 'HJK', 0, '444'),
  // Debyytti 2023 → ei mitään 2024 (ikä 19): ei datassa
  r('eki', VL, 2023, 19, 'HJK', 90, '555'),
  // Debyytti viimeisellä kaudella: kausi kesken
  r('fred', VL, 2025, 18, 'HJK', 45, '666'),
  // Akatemian kasvatti: HJK Klubi 04 (Ykkönen 2022) → debyytti HJK 2023
  r('kasvatti', YK, 2022, 17, 'HJK Klubi 04', 800, '999'),
  r('kasvatti', VL, 2023, 18, 'HJK', 120, '999'),
  // Akatemiasta muualle: ei oman seuran kasvatti
  r('muualle', YK, 2022, 17, 'SJK Akatemia', 800, '1000'),
  r('muualle', VL, 2023, 18, 'HJK', 120, '1000'),
  // Kaima: sama slug, eri palloid → eri pelaajat
  r('kaima', VL, 2023, 18, 'HJK', 100, '777'),
  r('kaima', VL, 2024, 25, 'HJK', 900, '888'),
];
const kans = new Map<string, 'FIN' | 'muu'>([
  ['aku', 'FIN'],
  ['beni', 'muu'],
  ['kasvatti', 'FIN'],
]);
const t = laskeLapimurrot(rivit, ott, kans, [2023]);
const hae = (slug: string) => t.pelaajat.filter((p) => p.slug === slug);

console.log('LÄPIMURROT');
vertaa('VL-kaudet', t.vlKaudet, [2022, 2023, 2024, 2025]);
vertaa('vanha: ei tiedossa', hae('vanha')[0].debyyttiTiedossa, false);
const aku = hae('aku');
vertaa('aku yhdistyy yhdeksi', aku.length, 1);
vertaa('aku debyytti', aku[0].debyyttiKausi, 2023);
vertaa('aku ennen', aku[0].ennen, { sarja: YK, taso: 2, seura: 'KPV', min: 2000 });
vertaa('aku jälkeen', aku[0].jalkeen.luokka, 'kasvoi');
vertaa('aku läpimurto 2024 (300+600 ≥ 450)', aku[0].lapimurtoKausi, 2024);
vertaa('aku vakiintunut 2024 (600/2430 ≥ 20 %)', aku[0].vakiintunutKausi, 2024);
const beni = hae('beni')[0];
vertaa('beni läpimurto ja vakiintunut debyyttikaudella', [beni.lapimurtoKausi, beni.vakiintunutKausi], [2023, 2023]);
vertaa('beni jälkeen', [beni.jalkeen.luokka, beni.jalkeen.sarja], ['alempi sarja', YL]);
vertaa('cale täytti 22', hae('cale')[0].jalkeen.luokka, 'täytti 22');
vertaa('dani ei peliaikaa', hae('dani')[0].jalkeen.luokka, 'ei peliaikaa');
vertaa('eki ei datassa', hae('eki')[0].jalkeen.luokka, 'ei datassa');
vertaa('fred ei vielä', hae('fred')[0].jalkeen.luokka, 'ei vielä');
vertaa('kaimat erillään', hae('kaima').length, 2);

console.log('KOTIMAISET JA KASVATIT');
vertaa('aku suomi', hae('aku')[0].kansalaisuus, 'suomi');
vertaa('beni muu', hae('beni')[0].kansalaisuus, 'muu');
vertaa('cale ei tietoa', hae('cale')[0].kansalaisuus, 'ei tietoa');
vertaa('kasvatti tunnistuu', hae('kasvatti')[0].akatemianKasvatti, true);
vertaa('akatemiasta muualle ei kasvatti', hae('muualle')[0].akatemianKasvatti, false);
vertaa('aku ei akatemiasta', hae('aku')[0].akatemianKasvatti, false);
const s2023 = t.yhteenvetoSuomi.find((y) => y.kausi === 2023)!;
vertaa('Suomi 2023 debytoineet (aku, kasvatti)', s2023.debytoineet, 2);
vertaa('Suomi 2023 debyyttiminuutit', s2023.debyyttiMinuutit, 420);
vertaa('Kasvatit 2023', t.yhteenvetoKasvatit.find((y) => y.kausi === 2023)!.debytoineet, 1);
vertaa('kansalaisuuskaudet', t.kansalaisuusKaudet, [2023]);

console.log('YHTEENVETO');
const y2023 = t.yhteenveto.find((y) => y.kausi === 2023)!;
vertaa('2022 ei yhteenvedossa', t.yhteenveto.some((y) => y.kausi === 2022), false);
vertaa('2023 debytoineet', y2023.debytoineet, 8);
vertaa('2023 alemmalta tasolta', y2023.alemmaltaTasolta, 3);
vertaa('2023 ei kansalaisuustietoa', y2023.eiKansalaisuustietoa, 5);
vertaa('2023 läpimurto', y2023.lapimurto, 2);
vertaa('2023 jälkeen', [y2023.jalkeen.kasvoi, y2023.jalkeen['alempi sarja'], y2023.jalkeen['täytti 22'], y2023.jalkeen['ei peliaikaa'], y2023.jalkeen['ei datassa']], [1, 1, 1, 1, 4]);

if (virheita > 0) {
  console.log('\n' + virheita + ' väitettä ei pitänyt.');
  process.exit(1);
}
console.log('\nKaikki väitteet pitivät.');
