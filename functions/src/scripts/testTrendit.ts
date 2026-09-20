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
  pyoristaKolmijako,
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
console.log('PYÖRISTYS — FIN luonnollisesti, jäännös "ei tietoa" -sarakkeeseen');
{
  // Kausi 2025: tarkat arvot. FIN 7,552 pyöristyy 7,6:een, ja jäännös
  // menee "ei tietoa" -sarakkeeseen. Aiemmin FIN siirtyi 7,5:een.
  vertaa(
    'kausi 2025',
    pyoristaKolmijako(7.552, 1.164, 0.227, 8.9),
    { fin: 7.6, muu: 1.2, eiTietoa: 0.1 },
  );
  // Kausi 2021: FIN 9,632 -> 9,6 (ei 9,7).
  vertaa(
    'kausi 2021',
    pyoristaKolmijako(9.632, 1.299, 0.22, 11.2),
    { fin: 9.6, muu: 1.3, eiTietoa: 0.3 },
  );
  vertaa(
    'kausi 2026',
    pyoristaKolmijako(10.24, 2.78, 0.006, 13.0),
    { fin: 10.2, muu: 2.8, eiTietoa: 0 },
  );
  vertaa('nollat', pyoristaKolmijako(0, 0, 0, 0), { fin: 0, muu: 0, eiTietoa: 0 });

  // Negatiivinen jäännös: FIN ja muu pyöristyvät yhdessä yli
  // kokonaisosuuden. Osuutta ei näytetä negatiivisena, vaan palataan
  // suurimman jäännöksen menetelmään (ja tapaus lokitetaan).
  const varalla = pyoristaKolmijako(5.06, 5.06, 0.0, 10.1);
  vertaa('negatiivinen jäännös -> varamenetelmä', varalla, { fin: 5.1, muu: 5, eiTietoa: 0 });
  vertaa(
    'varamenetelmän summa täsmää',
    (varalla.fin + varalla.muu + varalla.eiTietoa).toFixed(1),
    '10.1',
  );
  vertaa('ei negatiivisia osia', [varalla.fin, varalla.muu, varalla.eiTietoa].every((x) => x >= 0), true);

  // Summa pitää satunnaisilla jaoilla, ja FIN on luonnollisesti
  // pyöristetty aina kun jäännös ei mene negatiiviseksi.
  let summaPoikkeamia = 0;
  let finPoikkeamia = 0;
  for (let i = 0; i < 2000; i++) {
    const fin = Math.random() * 12;
    const muu = Math.random() * 4;
    const eiT = Math.random() * 2;
    const kokonaisuus = Math.round((fin + muu + eiT) * 10) / 10;
    const j = pyoristaKolmijako(fin, muu, eiT, kokonaisuus);
    if (Math.round((j.fin + j.muu + j.eiTietoa) * 10) !== Math.round(kokonaisuus * 10)) {
      summaPoikkeamia++;
    }
    // FIN saa siirtya vain silloin, kun luonnollinen pyoristys veisi
    // jaannoksen negatiiviseksi — muuten se on pyoristettava itsenaan.
    const finLuonnollinen = Math.round(fin * 10) / 10;
    const muuLuonnollinen = Math.round(muu * 10) / 10;
    const jaannos =
      Math.round((kokonaisuus - finLuonnollinen - muuLuonnollinen) * 10) / 10;
    if (jaannos >= 0 && j.fin !== finLuonnollinen) finPoikkeamia++;
  }
  vertaa('2000 satunnaista jakoa summautuu', summaPoikkeamia, 0);
  vertaa('FIN luonnollisesti pyöristetty', finPoikkeamia, 0);

  // Varamenetelma on yha olemassa ja summautuu.
  vertaa('varamenetelmä summautuu', pyoristaOsatSummaan([9.62, 1.31, 0.24], 11.2), [9.6, 1.3, 0.3]);
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
