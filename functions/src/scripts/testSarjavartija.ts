// ============================================
// REGRESSIOTESTI — vain Veikkausliiga tuodaan
//
// Toisen sarjan rivit eivat ole vaaratonta ylimaaraa: nimittaja
// (joukkueen ottelut) on sarjakohtainen, ja samannimiset joukkueet ja
// pelaajat osuisivat samoihin avaimiin. Osuudet vaarentyisivat ilman
// etta mikaan nakyisi rikki.
//
// Ajo:  node lib/scripts/testSarjavartija.js
// ============================================
import * as XLSX from 'xlsx';
import { parsiKausiExcel, VIESTI_VAARA_SARJA } from '../services/kausiImport';

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

const OTSIKOT = [
  'Etunimi',
  'Sukunimi',
  'Kausi',
  'Sarja',
  'Sarjan vaihe',
  'Joukkue',
  'Pelaajan ikä kaudella',
  'Pelatut minuutit (min)',
  'Pelatut ottelut',
  'Ottelut aloituksessa',
  'Ottelut kokoonpanossa',
  'Maalit',
  'Joukkueen ottelut sarjassa',
];

/** Yksi datarivi annetulla sarjalla. */
function rivi(etu: string, suku: string, sarja: string, joukkue: string): unknown[] {
  return [etu, suku, '2026', sarja, 'Runkosarja', joukkue, 20, 900, 10, 10, 10, 1, 27];
}

function tiedosto(rivit: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([OTSIKOT, ...rivit]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

console.log('SARJAVARTIJA');
{
  // 1. Pelkkaa Veikkausliigaa: menee lapi.
  const vl = parsiKausiExcel(
    tiedosto([
      rivi('Otto', 'Ruoppi', 'Veikkausliiga', 'KuPS'),
      rivi('Roni', 'Hudd', 'Veikkausliiga', 'KuPS'),
    ]),
  );
  vertaa('Veikkausliiga: ei virheitä', vl.virheet, []);
  vertaa('Veikkausliiga: 2 suoritusta', vl.suoritukset.length, 2);

  // 2. Yksi Ykkosliigan rivi hylkaa koko tiedoston.
  const seka = parsiKausiExcel(
    tiedosto([
      rivi('Otto', 'Ruoppi', 'Veikkausliiga', 'KuPS'),
      rivi('Joku', 'Pelaaja', 'Ykkösliiga', 'JäPS'),
    ]),
  );
  vertaa('sekatiedosto hylätään', seka.virheet[0], VIESTI_VAARA_SARJA);
  vertaa(
    'viesti sanatarkasti',
    VIESTI_VAARA_SARJA,
    'Tiedostossa on muun sarjan rivejä (esim. Ykkösliiga). Vain Veikkausliiga on tuettu.',
  );
  vertaa('erittely kertoo sarjan ja rivin', seka.virheet[1], 'Sarja "Ykkösliiga": 1 riviä (rivit 3)');
  // Muun sarjan rivi ei saa paatya dataan edes hylatyssa tiedostossa.
  vertaa(
    'muun sarjan rivi ei ole suorituksissa',
    seka.suoritukset.map((s) => s.sarja),
    ['Veikkausliiga'],
  );

  // 3. Koko tiedosto toista sarjaa.
  const yl = parsiKausiExcel(
    tiedosto([
      rivi('A', 'Yksi', 'Ykkösliiga', 'JäPS'),
      rivi('B', 'Kaksi', 'Ykkönen', 'PK-35'),
    ]),
  );
  vertaa('vain muita sarjoja: hylätään', yl.virheet[0], VIESTI_VAARA_SARJA);
  vertaa('molemmat sarjat eritellään', yl.virheet.length, 3);

  // 4. Kirjainkoko ei ratkaise: lahde ei ole johdonmukainen.
  const pienella = parsiKausiExcel(
    tiedosto([rivi('Otto', 'Ruoppi', 'veikkausliiga', 'KuPS')]),
  );
  vertaa('pienellä kirjoitettu kelpaa', pienella.virheet, []);

  // 5. Tyhja Sarja-arvo kelpaa: sarake on valinnainen, eika puuttuva
  //    tieto ole vaite toisesta sarjasta.
  const tyhja = parsiKausiExcel(tiedosto([rivi('Otto', 'Ruoppi', '', 'KuPS')]));
  vertaa('tyhjä sarja kelpaa', tyhja.virheet, []);
  vertaa('tyhjä sarja: rivi säilyy', tyhja.suoritukset.length, 1);
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
