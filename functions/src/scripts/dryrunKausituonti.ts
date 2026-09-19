// ============================================
// DRY-RUN — kausituonnin esikatselu komentoriviltä
//
// Lukee Excel-tiedoston, laskee kaiken ja tulostaa yhteenvedon.
// EI kirjoita mitään, ei ota yhteyttä Firestoreen.
//
// Käyttö:
//   npm run build
//   node lib/scripts/dryrunKausituonti.js "/polku/data.xlsx"
// ============================================
import * as fs from 'fs';
import { parsiKausiExcel, nimittajaId } from '../services/kausiImport';

function pros(x: number): string {
  return (x * 100).toFixed(1).replace('.', ',') + ' %';
}

function rivi(merkki: string): string {
  return merkki.repeat(66);
}

function main(): void {
  const polku = process.argv[2];
  if (!polku) {
    console.error('Anna Excel-tiedoston polku argumenttina.');
    process.exit(1);
  }

  const tulos = parsiKausiExcel(fs.readFileSync(polku));

  console.log(rivi('='));
  console.log('KAUSITUONNIN ESIKATSELU (dry-run) — mitään ei kirjoiteta');
  console.log('Tiedosto: ' + polku);
  console.log(rivi('='));

  if (tulos.virheet.length > 0) {
    console.log('');
    console.log('TIEDOSTO HYLÄTÄÄN — ' + tulos.virheet.length + ' virhettä:');
    for (const v of tulos.virheet.slice(0, 20)) console.log('  ✗ ' + v);
    if (tulos.virheet.length > 20) {
      console.log('  … ja ' + (tulos.virheet.length - 20) + ' muuta');
    }
    process.exitCode = 1;
  }

  console.log('');
  console.log('RIVIT');
  console.log('  Luettu (pl. otsikko):  ' + tulos.rivitLuettu);
  console.log('  Käyttökelpoisia:       ' + tulos.suoritukset.length);
  console.log('  Ohitettu:              ' + tulos.ohitetut.length);
  for (const o of tulos.ohitetut) {
    console.log('     rivi ' + o.rivi + ': ' + o.syy);
  }

  console.log('');
  console.log('KAUDET');
  console.log(
    '  kausi  rivit  pelaajat  jkl  ottelut/jkl   osuus koko    osuus runkosarja',
  );
  for (const k of tulos.kaudet) {
    console.log(
      '  ' +
        k.kausi +
        '   ' +
        String(k.rivit).padStart(4) +
        '   ' +
        String(k.pelaajat).padStart(6) +
        '   ' +
        String(k.joukkueet).padStart(3) +
        '   ' +
        (k.ottelut_min + '–' + k.ottelut_max).padStart(9) +
        '   ' +
        pros(k.osuus_koko_kausi).padStart(9) +
        '   ' +
        pros(k.osuus_runkosarja).padStart(14),
    );
  }

  console.log('');
  console.log('VAIHEET JA OTTELUMÄÄRÄT');
  const vaiheOttelut = new Map<string, Set<number>>();
  for (const n of tulos.nimittajat) {
    if (!vaiheOttelut.has(n.vaihe)) vaiheOttelut.set(n.vaihe, new Set());
    vaiheOttelut.get(n.vaihe)!.add(n.ottelut);
  }
  for (const vaihe of Array.from(vaiheOttelut.keys()).sort()) {
    const arvot = Array.from(vaiheOttelut.get(vaihe)!).sort((a, b) => a - b);
    const vali =
      arvot.length > 1 ? arvot[0] + '–' + arvot[arvot.length - 1] : String(arvot[0]);
    console.log('  ' + vaihe.padEnd(26) + vali + ' ottelua');
  }

  console.log('');
  console.log('KIRJOITETTAISIIN');
  console.log('  suoritukset:   ' + tulos.suoritusIdt.length + ' dokumenttia');
  console.log('  nimittajat:    ' + tulos.nimittajat.length + ' dokumenttia');
  console.log('  kaudet:        ' + tulos.kaudet.length + ' dokumenttia');
  console.log(
    '  seasons/{kausi}/players (projektio): ' + tulos.projektiot.length + ' dokumenttia',
  );
  console.log(
    '  Uniikkeja dokumenttiavaimia: ' +
      new Set(tulos.suoritusIdt).size +
      ' / ' +
      tulos.suoritusIdt.length +
      (new Set(tulos.suoritusIdt).size === tulos.suoritusIdt.length
        ? '  (idempotentti)'
        : '  ← TÖRMÄYS'),
  );

  console.log('');
  console.log('VAROITUKSET (' + tulos.varoitukset.length + ')');
  const ryhmat = new Map<string, number>();
  for (const v of tulos.varoitukset) {
    ryhmat.set(v.tyyppi, (ryhmat.get(v.tyyppi) || 0) + 1);
  }
  for (const [tyyppi, n] of ryhmat) {
    console.log('  ' + tyyppi.padEnd(28) + n + ' kpl');
  }
  for (const v of tulos.varoitukset.slice(0, 15)) {
    console.log('     · ' + v.viesti);
  }
  if (tulos.varoitukset.length > 15) {
    console.log('     … ja ' + (tulos.varoitukset.length - 15) + ' muuta');
  }

  console.log('');
  console.log('ESIMERKKIAVAIMET');
  for (const id of tulos.suoritusIdt.slice(0, 3)) {
    console.log('  suoritukset/' + id);
  }
  if (tulos.nimittajat.length > 0) {
    const n = tulos.nimittajat[0];
    console.log(
      '  nimittajat/' +
        nimittajaId(n) +
        '  → ottelut ' +
        n.ottelut +
        ', kapasiteetti_min ' +
        n.kapasiteetti_min,
    );
  }

  console.log('');
  console.log(rivi('='));
  console.log('Dry-run valmis. Mitään ei kirjoitettu.');
}

main();
