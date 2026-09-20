// ============================================
// REGRESSIOTESTI — kausitrendin laskenta
//
// Trendipisteen on oltava sama luku kuin kauden nakymassa, ja kolmijaon
// osien on summauduttava kokonaisosuudeksi. Molemmat ovat menneet
// aiemmin pieleen: osuus laskettiin eri nimittajalla, ja "ei tietoa"
// jai kokonaan pois, jolloin epavarmuus nayttai pienemmalta kuin se oli.
//
// Ajo:  node lib/scripts/testTrendit.js
// ============================================
import {
  luokitteleKansalaisuudet,
  laskeKolmijako,
  onKesken,
  otteluitaPelattu,
  pyoristaOsatSummaan,
} from '../services/trendit';
import type { SuoritusDoc } from '../services/kausiData';

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

/** Kevyt suoritusrivi: vain laskennassa kaytetyt kentat. */
function s(slug: string, ika: number, minuutit: number): SuoritusDoc {
  return { slug, ika, minuutit } as unknown as SuoritusDoc;
}

/** Kansalaisuusdokumentti samassa muodossa kuin Firestoren snapshot. */
function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

console.log('KANSALAISUUKSIEN LUOKITTELU');
{
  const luokat = luokitteleKansalaisuudet([
    doc('fin-pelaaja', { vlKansalaisuus: 'FIN', seura_vahvistettu: true }),
    doc('ulk-pelaaja', { vlKansalaisuus: 'CIV', seura_vahvistettu: true }),
    // Seura vahvistamatta: koodi tiedetaan, mutta pelaajan ei ole
    // varmennettu olevan sama henkilo -> ei tietoa.
    doc('vahvistamaton', { vlKansalaisuus: 'FIN', seura_vahvistettu: false }),
    // Koodi puuttuu -> ei tietoa, ei arvausta.
    doc('ei-koodia', { vlKansalaisuus: '', seura_vahvistettu: true }),
  ]);
  vertaa('FIN-joukko', Array.from(luokat.fin), ['fin-pelaaja']);
  vertaa('muu-joukko', Array.from(luokat.muu), ['ulk-pelaaja']);
  vertaa('saatavilla', luokat.saatavilla, true);
  vertaa('tyhjä kausi ei ole saatavilla', luokitteleKansalaisuudet([]).saatavilla, false);
}

console.log('');
console.log('KOLMIJAKO');
{
  const suoritukset = [
    s('fin-pelaaja', 20, 900),
    s('ulk-pelaaja', 19, 450),
    s('vahvistamaton', 18, 300),
    // Pelaajaa ei ole kansalaisuusdatassa lainkaan -> ei tietoa.
    s('tuntematon', 20, 150),
    // Liian vanha: ei kuulu alle 21 -lukuun.
    s('vanha', 25, 3000),
  ];
  const luokat = luokitteleKansalaisuudet([
    doc('fin-pelaaja', { vlKansalaisuus: 'FIN', seura_vahvistettu: true }),
    doc('ulk-pelaaja', { vlKansalaisuus: 'CIV', seura_vahvistettu: true }),
    doc('vahvistamaton', { vlKansalaisuus: 'FIN', seura_vahvistettu: false }),
  ]);
  const jako = laskeKolmijako(suoritukset, 10000, luokat, 20);
  vertaa('FIN', jako?.fin, 9);
  vertaa('muu maakoodi', jako?.muu, 4.5);
  // 300 + 150 = 450 min = 4,5 %: vahvistamaton JA datasta puuttuva.
  vertaa('ei tietoa', jako?.eiTietoa, 4.5);
  const summa = (jako!.fin + jako!.muu + jako!.eiTietoa).toFixed(1);
  vertaa('osat summautuvat kokonaisuuteen', summa, '18.0');

  vertaa(
    'ei kansalaisuusdataa -> null',
    laskeKolmijako(suoritukset, 10000, luokitteleKansalaisuudet([]), 20),
    null,
  );
  vertaa(
    'nimittäjä 0 -> null',
    laskeKolmijako(suoritukset, 0, luokat, 20),
    null,
  );
}

console.log('');
console.log('PYÖRISTYS — osat summautuvat näytettyyn kokonaislukuun');
{
  // Nämä kaksi näyttivät aiemmin väärin: erikseen pyöristetyt osat
  // antoivat 11,1 % ja 9,0 %, kun kokonaisluvut olivat 11,2 % ja 8,9 %.
  vertaa('kausi 2021 -tapaus', pyoristaOsatSummaan([9.62, 1.31, 0.24], 11.2), [9.6, 1.3, 0.3]);
  vertaa('kausi 2025 -tapaus', pyoristaOsatSummaan([7.63, 1.21, 0.16], 8.9), [7.6, 1.2, 0.1]);
  // Tavallinen tapaus ei muutu.
  vertaa('kausi 2026 -tapaus', pyoristaOsatSummaan([10.24, 2.78, 0.01], 13.0), [10.2, 2.8, 0]);
  vertaa('nollat', pyoristaOsatSummaan([0, 0, 0], 0), [0, 0, 0]);
  // Ylitys: osien alarajat ylittavat tavoitteen -> otetaan pois
  // pienimman jaannoksen mukaan, ei jaada silmukkaan.
  const ylitys = pyoristaOsatSummaan([1.0, 1.0], 1.5);
  vertaa('ylitys summautuu tavoitteeseen', ylitys.reduce((a, b) => a + b, 0).toFixed(1), '1.5');

  // Summa pitää kaikilla satunnaisilla jaoilla: pyöristys ei saa
  // toimia vain käsin valituilla luvuilla.
  let poikkeamia = 0;
  for (let i = 0; i < 2000; i++) {
    const osat = [Math.random() * 12, Math.random() * 4, Math.random() * 2];
    const summa = Math.round(osat.reduce((a, b) => a + b, 0) * 10) / 10;
    const tulos = pyoristaOsatSummaan(osat, summa);
    const saatu = Math.round(tulos.reduce((a, b) => a + b, 0) * 10);
    if (saatu !== Math.round(summa * 10)) poikkeamia++;
  }
  vertaa('2000 satunnaista jakoa summautuu', poikkeamia, 0);
}

console.log('');
console.log('KESKEN OLEVA KAUSI');
{
  vertaa('kuluva vuosi on kesken', onKesken(2026, undefined, 2026), true);
  vertaa('mennyt kausi on valmis', onKesken(2025, undefined, 2026), false);
  // Kausidokumentin kentta ohittaa kalenteripaattelyn molempiin suuntiin.
  vertaa('valmis: true ohittaa', onKesken(2026, { valmis: true }, 2026), false);
  vertaa('valmis: false ohittaa', onKesken(2025, { valmis: false }, 2026), true);
}

console.log('');
console.log('PELATUT OTTELUT');
{
  const nimittajat = [
    { joukkue: 'KuPS', ottelut: 20 },
    { joukkue: 'KuPS', ottelut: 4 },
    { joukkue: 'Ilves', ottelut: 23 },
  ];
  // Kausidokumentin luku voittaa: tuonti on laskenut sen samasta datasta.
  vertaa('kausidokumentista', otteluitaPelattu({ ottelut_max: 25 }, nimittajat), 25);
  // Vanhoissa dokumenteissa kenttaa ei ole -> lasketaan nimittajista.
  vertaa('nimittäjistä (vaiheet yhteen)', otteluitaPelattu(undefined, nimittajat), 24);
  vertaa('ei dataa -> null', otteluitaPelattu(undefined, []), null);
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
