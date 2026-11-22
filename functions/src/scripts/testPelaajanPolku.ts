// ============================================
// REGRESSIOTESTI — pelaajan polku (vaihe 6)
//
// Polku yhdistää saman slugin rivit eri kausilta ja sarjoista. Kaima
// eri ikäisenä ei saa päätyä polkuun.
//
// Ajo:  node lib/scripts/testPelaajanPolku.js
// ============================================
import { valitsePolku, type PolkuKausi } from '../services/pelaajanPolku';

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

function rivi(kausi: number, sarja: string, ika: number): PolkuKausi {
  return {
    kausi, sarja, ika, joukkue: 'X', joukkueet: ['X'],
    minTotal: 0, ottelutTotal: 0, aloituksetTotal: 0, kokoonpanossaTotal: null, maaliTotal: 0,
  };
}
const avain = (r: PolkuKausi[]) => r.map((p) => p.kausi + ' ' + p.sarja);

console.log('PELAAJAN POLKU');
{
  const viite = rivi(2026, 'Veikkausliiga', 19);
  const tulos = valitsePolku(viite, [
    viite,
    rivi(2025, 'Ykkösliiga', 18),
    rivi(2024, 'Miesten Ykkönen', 17),
    rivi(2025, 'Veikkausliiga', 21), // kaima, eri ikäinen
  ]);
  vertaa('yhteensopivat mukaan, uusin ensin', avain(tulos), [
    '2026 Veikkausliiga', '2025 Ykkösliiga', '2024 Miesten Ykkönen',
  ]);
}
{
  // Ikä lasketaan kauden aikana: syntymävuosiarvio voi heittää yhdellä.
  const tulos = valitsePolku(rivi(2026, 'Veikkausliiga', 19), [rivi(2025, 'Ykkösliiga', 19)]);
  vertaa('yhden vuoden heitto hyväksytään', tulos.length, 2);
}
{
  const tulos = valitsePolku(rivi(2026, 'Veikkausliiga', 19), [rivi(2025, 'Ykkösliiga', 20)]);
  vertaa('kahden vuoden ero hylätään', tulos.length, 1);
}
{
  const tulos = valitsePolku(rivi(2026, 'Veikkausliiga', 0), [rivi(2025, 'Ykkösliiga', 18)]);
  vertaa('tuntematon ikä → vain viiterivi', avain(tulos), ['2026 Veikkausliiga']);
}
{
  const tulos = valitsePolku(rivi(2025, 'Veikkausliiga', 18), [rivi(2025, 'Ykkösliiga', 18)]);
  vertaa('sama kausi kahdessa sarjassa, aakkosjärjestys', avain(tulos), [
    '2025 Veikkausliiga', '2025 Ykkösliiga',
  ]);
}

if (virheita > 0) {
  console.log('\n' + virheita + ' väitettä ei pitänyt.');
  process.exit(1);
}
console.log('\nKaikki väitteet pitivät.');
