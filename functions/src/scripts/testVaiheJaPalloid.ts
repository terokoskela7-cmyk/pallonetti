// ============================================
// REGRESSIOTESTI — vaiheen nimi ja palloid kausituonnissa
//
// 1) Miesten Ykkösen kaudella 2021 runkosarjan vaihe on lähteessä
//    "Ykkönen". Se on tulkittava runkosarjaksi, muuten kauden
//    runkosarjaosuus on 0 %.
// 2) palloid tallentuu suoritukseen ja projektioon; puuttuva sarake ei
//    kaada tuontia.
//
// Ajo:  node lib/scripts/testVaiheJaPalloid.js
// ============================================
import * as XLSX from 'xlsx';
import { parsiKausiExcel, normalisoiVaihe, onRunkosarjaVaihe } from '../services/kausiImport';

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

function excel(otsikot: string[], rivit: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([otsikot, ...rivit]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

console.log('VAIHEEN NIMI');
vertaa('"Ykkönen" Miesten Ykkösessä', normalisoiVaihe('Ykkönen', 'Miesten Ykkönen'), 'Runkosarja');
vertaa('koko sarjan nimi', normalisoiVaihe('Miesten Ykkönen', 'Miesten Ykkönen'), 'Runkosarja');
vertaa('Runkosarja ennallaan', normalisoiVaihe('Runkosarja', 'Miesten Ykkönen'), 'Runkosarja');
vertaa('jatkosarja ennallaan', normalisoiVaihe('Ylempi jatkosarja', 'Miesten Ykkönen'), 'Ylempi jatkosarja');
vertaa('VL:n vaihe ennallaan', normalisoiVaihe('Mestaruussarja', 'Veikkausliiga'), 'Mestaruussarja');
vertaa('"Ykkönen" ei ole Ykkösliigan runkosarja', normalisoiVaihe('Ykkönen', 'Ykkösliiga'), 'Ykkönen');

const OTSIKOT = [
  'Etunimi', 'Sukunimi', 'palloid', 'Pelaajan ikä kaudella', 'Kausi', 'Sarja',
  'Sarjan vaihe', 'Joukkue', 'Pelatut minuutit (min)', 'Ottelut aloituksessa',
  'Pelatut ottelut', 'Ottelut kokoonpanossa', 'Maalit', 'Joukkueen ottelut sarjassa',
];

console.log('RUNKOSARJAN VAIHEET');
vertaa('Runkosarja', onRunkosarjaVaihe('Runkosarja'), true);
vertaa('1.-2. kierros', onRunkosarjaVaihe('1.-2. kierros'), true);
vertaa('3. kierros', onRunkosarjaVaihe('3. kierros'), true);
vertaa('Mestaruussarja ei', onRunkosarjaVaihe('Mestaruussarja'), false);
vertaa('Ylempi jatkosarja ei', onRunkosarjaVaihe('Ylempi jatkosarja'), false);

console.log('TUONTI');
{
  const t = parsiKausiExcel(
    excel(OTSIKOT, [
      ['Aku', 'Testi', '12345', 19, '2021', 'Miesten Ykkönen', 'Ykkönen', 'KPV', 900, 10, 11, 15, 1, 22],
      ['Aku', 'Testi', '12345', 19, '2021', 'Miesten Ykkönen', 'Ylempi jatkosarja', 'KPV', 300, 3, 4, 5, 0, 5],
    ]),
  );
  vertaa('ei virheitä', t.virheet, []);
  vertaa('vaiheet', t.suoritukset.map((s) => s.vaihe), ['Runkosarja', 'Ylempi jatkosarja']);
  vertaa('suorituksen palloid', t.suoritukset.map((s) => s.palloid), ['12345', '12345']);
  vertaa('projektion palloid', t.projektiot.map((p) => p.palloid), ['12345']);
  vertaa('runkosarjan osuus > 0', (t.kaudet[0]?.osuus_runkosarja ?? 0) > 0, true);
}
{
  const ilman = OTSIKOT.filter((o) => o !== 'palloid');
  const t = parsiKausiExcel(
    excel(ilman, [['Aku', 'Testi', 19, '2025', 'Veikkausliiga', 'Runkosarja', 'HJK', 900, 10, 11, 15, 1, 22]]),
  );
  vertaa('ilman palloid-saraketta: ei virheitä', t.virheet, []);
  vertaa('ilman palloid-saraketta: null', t.suoritukset.map((s) => s.palloid), [null]);
}

if (virheita > 0) {
  console.log('\n' + virheita + ' väitettä ei pitänyt.');
  process.exit(1);
}
console.log('\nKaikki väitteet pitivät.');
