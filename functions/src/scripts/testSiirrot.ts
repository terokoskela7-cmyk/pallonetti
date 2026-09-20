// ============================================
// REGRESSIOTESTI — siirtojen yhdistaminen pelaajaan (B5)
//
// Vaara merkinta vaittaisi pelaajan siirtyneen ulkomaille, joten
// yhdistamisen on tasmattava seka nimessa etta kauden seurassa. Testi
// varmistaa molemmat suunnat: oikea osuma loytyy, vaara ei synny.
//
// Ajo:  node lib/scripts/testSiirrot.js
// ============================================
import { haeSiirto, kaudenSiirrot, siirronAvain } from '../services/siirrot';

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

console.log('SIIRTODATA');
{
  const rivit = kaudenSiirrot(2026);
  vertaa('kauden 2026 rivimäärä', rivit.length, 7);
  vertaa('tuntematon kausi on tyhjä', kaudenSiirrot(2025).length, 0);

  // Jokaisella rivillä on oltava julkinen lähde ja kelvollinen tyyppi:
  // ilman lähdettä merkintää ei tehdä lainkaan.
  const ilmanLahdetta = rivit.filter(
    (s) => !/^https:\/\//.test(String(s.lahde_url || '')),
  );
  vertaa('kaikilla https-lähde', ilmanLahdetta.map((s) => s.pelaaja), []);
  const vaaraTyyppi = rivit.filter(
    (s) => s.tyyppi !== 'siirto' && s.tyyppi !== 'laina',
  );
  vertaa('tyyppi on siirto tai laina', vaaraTyyppi.map((s) => s.pelaaja), []);

  // Tiitinen on laina, ei siirto — tämä meni kerran väärin lähdeaineistossa.
  const tiitinen = rivit.find((s) => s.pelaaja === 'Otto Tiitinen');
  vertaa('Tiitinen on laina', tiitinen?.tyyppi, 'laina');
  // Ruopilla ei ole päivää. Null säilyy nullina: päivää ei keksitä.
  const ruoppi = rivit.find((s) => s.pelaaja === 'Otto Ruoppi');
  vertaa('Ruopin pvm on null', ruoppi?.pvm, null);
}

console.log('');
console.log('NIMIAVAIN');
{
  vertaa('kaksiosainen nimi', siirronAvain('Otto Ruoppi'), 'otto ruoppi');
  // Skandit säilytetään: niiden poisto yhdistäisi eri pelaajia.
  vertaa('skandit säilyvät', siirronAvain('Rudi Vikström'), 'rudi vikström');
  vertaa('kaksoisetunimi', siirronAvain('Jean Pierre Mbala'), 'jean pierre mbala');
  vertaa('ylimääräiset välit', siirronAvain('  Toivo   Mero '), 'toivo mero');
}

console.log('');
console.log('YHDISTÄMINEN PELAAJAAN');
{
  const osuma = haeSiirto(2026, 'Otto', 'Ruoppi', ['KuPS']);
  vertaa('Ruoppi/KuPS löytyy', osuma?.uusi_seura, '1. FSV Mainz 05');

  // Sama nimi, eri seura -> ei merkintää. Kyseessä on eri pelaaja tai
  // väärä kausi, eikä sivu saa väittää siirtoa.
  vertaa('Ruoppi/Ilves ei löydy', haeSiirto(2026, 'Otto', 'Ruoppi', ['Ilves']), null);

  // Pelaaja joka vaihtoi seuraa kesken kauden: lähtöseuran on riitettävä
  // vaikka kauden seuroja on kaksi.
  vertaa(
    'useampi seura, lähtöseura mukana',
    haeSiirto(2026, 'Otto', 'Tiitinen', ['Ilves', 'FC Inter'])?.tyyppi,
    'laina',
  );

  vertaa('ei riviä -> null', haeSiirto(2026, 'Roni', 'Hudd', ['KuPS']), null);
  vertaa('tyhjä nimi -> null', haeSiirto(2026, '', '', ['KuPS']), null);
  vertaa('väärä kausi -> null', haeSiirto(2025, 'Otto', 'Ruoppi', ['KuPS']), null);
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
