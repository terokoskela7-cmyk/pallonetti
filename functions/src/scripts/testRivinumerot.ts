// ============================================
// REGRESSIOTESTI — Excel-rivinumerot kun tiedostossa on tyhjiä rivejä
//
// Veikkausliigan vienti kirjoittaa rivit ILMAN r-attribuuttia, jolloin
// rivinumero on pelkkä järjestys tiedostossa. SheetJS pudottaa tällaisesta
// tiedostosta tyhjät <row/>-elementit kokonaan pois, jolloin kaikki niiden
// jälkeiset rivit siirtyvät yhdellä ylöspäin. Esikatselun raportoima
// "rivi N" osoittaisi silloin väärään riviin siinä tiedostossa jota
// ihminen katsoo Excelissä — juuri silloin kun hän etsii ongelmariviä.
//
// kausiImport.ts lukee rivien todellisen järjestyksen taulukon raaka-XML:stä.
// Tämä testi varmistaa ettei se regressoi.
//
// Fixture rivinumerot-tyhja-rivi.xlsx (sama rakenne kuin oikeassa viennissä:
// inline-stringit, ei r-attribuutteja):
//   rivi 1  otsikko
//   rivi 2-4  dataa   (*-ENNEN-TYHJAA)
//   rivi 5  TYHJÄ     <x:row />
//   rivi 6-7  dataa   (*-JALKEEN-TYHJAN)  ← nämä siirtyisivät ilman korjausta
//   rivi 8  TYHJÄ     <x:row />
//   rivi 9  footer/suodatinseloste
//
// Käyttö:
//   npm run build
//   node lib/scripts/testRivinumerot.js
// ============================================
import * as fs from 'fs';
import * as path from 'path';
import { parsiKausiExcel } from '../services/kausiImport';

const FIXTURE = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'fixtures',
  'rivinumerot-tyhja-rivi.xlsx',
);

let virheita = 0;

function vertaa(nimi: string, saatu: unknown, odotettu: unknown): void {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) {
    console.log('  ✓ ' + nimi);
  } else {
    virheita++;
    console.log('  ✗ ' + nimi);
    console.log('      odotettu: ' + b);
    console.log('      saatu:    ' + a);
  }
}

function main(): void {
  console.log('TESTI: Excel-rivinumerot tyhjien rivien yli');

  const tulos = parsiKausiExcel(fs.readFileSync(FIXTURE));

  vertaa('tiedosto kelpaa (ei virheitä)', tulos.virheet, []);
  vertaa('käyttökelpoisia rivejä', tulos.suoritukset.length, 5);
  vertaa('rivejä luettu otsikko pois lukien', tulos.rivitLuettu, 8);

  // Ydinväite: rivinumerot ovat Excelin omat, myös tyhjän rivin JÄLKEEN.
  vertaa(
    'datarivien numerot hyppäävät tyhjän rivin yli',
    tulos.suoritukset.map((s) => s.rivi),
    [2, 3, 4, 6, 7],
  );

  // Ilman korjausta rivit 6 ja 7 raportoituisivat riveinä 5 ja 6.
  const jalkeen = tulos.suoritukset.filter(
    (s) => s.sukunimi === 'JALKEEN-TYHJAN',
  );
  vertaa(
    'tyhjän rivin jälkeiset rivit eivät ole siirtyneet',
    jalkeen.map((s) => s.rivi),
    [6, 7],
  );

  vertaa(
    'molemmat tyhjät rivit ja footer raportoidaan ohitettuina',
    tulos.ohitetut,
    [
      { rivi: 5, syy: 'tyhjä rivi' },
      { rivi: 8, syy: 'tyhjä rivi' },
      { rivi: 9, syy: 'footer/suodatinseloste, ei datariviä' },
    ],
  );

  // Rivinumerointi ei saa vaikuttaa laskentaan.
  vertaa('kausia', tulos.kaudet.length, 1);
  vertaa(
    'nimittäjiä (2 joukkuetta × 1 vaihe)',
    tulos.nimittajat.length,
    2,
  );
  vertaa(
    'kauden minuutit yhteensä',
    tulos.kaudet[0].minuutit_yhteensa,
    900 + 450 + 90 + 1800 + 45,
  );

  console.log('');
  if (virheita > 0) {
    console.log('TESTI EPÄONNISTUI — ' + virheita + ' väitettä ei pitänyt.');
    process.exit(1);
  }
  console.log('Kaikki väitteet pitivät.');
}

main();
