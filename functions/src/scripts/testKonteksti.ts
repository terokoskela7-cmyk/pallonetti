// ============================================
// YKSIKKOTESTI — kontekstimoottori ja taivutus
//
// Kontekstilauseet menevat sivulle sellaisenaan, joten vaara lause on
// julkaistu vaara vaite. Testi ajaa moottorin muistinvaraisella
// aineistolla: ei Firestorea, ei verkkoa.
//
// Ajo:  npm run build && node lib/scripts/testKonteksti.js
// ============================================
import {
  laskeKonteksti,
  type KontekstiSyote,
} from '../services/konteksti';
import type { NimittajaDoc, SuoritusDoc } from '../services/kausiData';
import { SEURAN_GENETIIVI, genetiivi, genetiiviTaiJoukkueen } from '../services/taivutus';

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

function suoritus(x: Partial<SuoritusDoc>): SuoritusDoc {
  return {
    sarja: 'Veikkausliiga',
    kausi: '2026',
    vaihe: 'Runkosarja',
    joukkue: 'KuPS',
    pelaajaAvain: x.slug || 'p',
    slug: 'p',
    etunimi: 'Etu',
    sukunimi: 'Suku',
    ika: 20,
    minuutit: 0,
    aloitukset: 0,
    ottelut: 0,
    maalit: 0,
    ...x,
  } as SuoritusDoc;
}

function nimittaja(joukkue: string, ottelut: number): NimittajaDoc {
  return {
    sarja: 'Veikkausliiga',
    kausi: '2026',
    vaihe: 'Runkosarja',
    joukkue,
    ottelut,
    kapasiteetti_min: ottelut * 90 * 11,
  };
}

function syote(
  slug: string,
  suoritukset: SuoritusDoc[],
  nimittajat: NimittajaDoc[],
  pelipaikat: Array<[string, string | null]> = [],
  sarja = 'Veikkausliiga',
): KontekstiSyote {
  return {
    kausi: 2026,
    sarja,
    slug,
    suoritukset,
    nimittajat,
    pelipaikat: new Map(pelipaikat),
  };
}

function tekstit(k: ReturnType<typeof laskeKonteksti>): string[] {
  return (k?.rivit ?? []).map((r) => r.teksti);
}

// ============================================
console.log('GENETIIVI — koko kartta');
// ============================================
{
  // Kartta luetellaan tassa auki, jotta testi kaatuu jos joku muuttaa
  // taivutusta vahingossa. `${joukkue}:n` tuottaisi naista seitseman
  // kahdestatoista vaarin.
  const odotetut: Record<string, string> = {
    'AC Oulu': 'AC Oulun',
    EIF: 'EIF:n',
    'FC Haka': 'FC Hakan',
    'FC Honka': 'FC Hongan',
    'FC Inter': 'FC Interin',
    'FC Lahti': 'FC Lahden',
    'FF Jaro': 'FF Jaron',
    HIFK: 'HIFK:n',
    HJK: 'HJK:n',
    'HJK Klubi 04': 'HJK Klubi 04:n',
    'IF Gnistan': 'IF Gnistanin',
    'IFK Mariehamn': 'IFK Mariehamnin',
    Ilves: 'Ilveksen',
    JIPPO: 'JIPPOn',
    JäPS: 'JäPS:n',
    KTP: 'KTP:n',
    KuPS: 'KuPS:n',
    KäPa: 'KäPan',
    MP: 'MP:n',
    'PK-35': 'PK-35:n',
    RoPS: 'RoPS:n',
    SJK: 'SJK:n',
    'SJK Akatemia': 'SJK Akatemian',
    SalPa: 'SalPan',
    TPS: 'TPS:n',
    VPS: 'VPS:n',
  };

  for (const seura of Object.keys(odotetut)) {
    vertaa(seura, genetiivi(seura), odotetut[seura]);
  }

  // Kartassa ei saa olla seuroja, joita testi ei kata, eika painvastoin.
  vertaa(
    'kartan koko',
    Object.keys(SEURAN_GENETIIVI).length,
    Object.keys(odotetut).length,
  );

  // DATASSA ESIINTYVAT SEURAT. Luettu tuotannosta (nimittajat, molemmat
  // sarjat, kaudet 2020–2026) 21.9.2026. Jos tuonti tuo uuden seuran,
  // tama valitehtava kaatuu vasta kun lista paivitetaan — siksi
  // tarkistaKonteksti.ts lukee saman listan elavasta datasta.
  const datanSeurat = Object.keys(odotetut);
  const puuttuvat = datanSeurat.filter((s) => genetiivi(s) === null);
  vertaa('datan seurat kartassa', puuttuvat, []);

  // Tuntematon seura EI saa arvattua taivutusta.
  vertaa('tuntematon seura -> null', genetiivi('FC Uusi'), null);
  vertaa(
    'tuntematon seura -> "joukkueen"',
    genetiiviTaiJoukkueen('FC Uusi'),
    'joukkueen',
  );
  vertaa('tyhja nimi -> "joukkueen"', genetiiviTaiJoukkueen(''), 'joukkueen');
}

// ============================================
console.log('');
console.log('KÖRKKÖ–RUOPPI — maalikärki 20-vuotiaissa');
// ============================================
const korkkoRuoppi: SuoritusDoc[] = [
  suoritus({
    slug: 'julius-korkko',
    etunimi: 'Julius',
    sukunimi: 'Körkkö',
    joukkue: 'AC Oulu',
    ika: 20,
    minuutit: 1500,
    ottelut: 20,
    aloitukset: 18,
    maalit: 5,
  }),
  suoritus({
    slug: 'otto-ruoppi',
    etunimi: 'Otto',
    sukunimi: 'Ruoppi',
    joukkue: 'KuPS',
    ika: 20,
    minuutit: 1292,
    ottelut: 15,
    aloitukset: 15,
    maalit: 4,
  }),
  suoritus({
    slug: 'kolmas-mies',
    etunimi: 'Kolmas',
    sukunimi: 'Mies',
    joukkue: 'Ilves',
    ika: 20,
    minuutit: 300,
    ottelut: 12,
    maalit: 1,
  }),
  // Samanikainen ilman peliaikaa: EI kuulu mediaaniin eika sijoitukseen.
  suoritus({
    slug: 'nolla-minuuttia',
    etunimi: 'Nolla',
    sukunimi: 'Minuuttia',
    joukkue: 'HJK',
    ika: 20,
    minuutit: 0,
    ottelut: 0,
    maalit: 0,
  }),
  // Eri-ikainen maalintekija: ei saa vaikuttaa 20-vuotiaiden sijoihin.
  suoritus({
    slug: 'vanhempi-karki',
    etunimi: 'Vanhempi',
    sukunimi: 'Kärki',
    joukkue: 'HJK',
    ika: 21,
    minuutit: 1800,
    ottelut: 21,
    maalit: 12,
  }),
];
const nimittajat3 = [
  nimittaja('AC Oulu', 22),
  nimittaja('KuPS', 22),
  nimittaja('Ilves', 22),
  nimittaja('HJK', 22),
];
const paikat: Array<[string, string | null]> = [
  ['julius-korkko', 'Hyökkääjä'],
  ['otto-ruoppi', 'Hyökkääjä'],
  ['kolmas-mies', 'Puolustaja'],
  ['vanhempi-karki', 'Hyökkääjä'],
];

{
  const k = laskeKonteksti(syote('julius-korkko', korkkoRuoppi, nimittajat3, paikat));
  vertaa('Körkkö: maalisija', k?.faktat.sijaMaalit, 1);
  vertaa('Körkkö: sija ei jaettu', k?.faktat.jaettuMaalit, false);
  vertaa(
    'Körkkö: maalilause',
    tekstit(k).find((t) => t.indexOf('maalit') >= 0),
    '20-vuotiaiden kärki Veikkausliigassa: maalit (5)',
  );

  const r = laskeKonteksti(syote('otto-ruoppi', korkkoRuoppi, nimittajat3, paikat));
  vertaa('Ruoppi: maalisija', r?.faktat.sijaMaalit, 2);
  vertaa(
    'Ruoppi: maalilause',
    tekstit(r).find((t) => t.indexOf('maalit') >= 0),
    '2. 20-vuotiaiden joukossa Veikkausliigassa: maalit (4)',
  );
  // Briefin esimerkki: 1292 / (22 × 90) = 65 %, 1292 / 15 = 86 min/ottelu.
  vertaa('Ruoppi: osuus', r?.faktat.osuusMinuuteista, 65);
  vertaa('Ruoppi: tiheys', r?.faktat.tiheys, 86);
  vertaa(
    'Ruoppi: osuuslause',
    tekstit(r)[0],
    '65 % KuPS:n kauden minuuteista, aloittaa lähes aina',
  );
  vertaa(
    'Ruoppi: tiheyslause',
    tekstit(r).find((t) => t.indexOf('min/ottelu') >= 0),
    '86 min/ottelu, pelaa lähes täydet pelit',
  );
  // Vertailujoukko kirjataan jokaiseen riviin, myos ykkössijaan.
  vertaa(
    'vertailujoukko riveilla',
    (r?.rivit ?? []).every((x) => typeof x.vertailujoukko === 'string'),
    true,
  );
  // Mediaani peliaikaa saaneista: minuutit 300 / 1292 / 1500 -> 1292.
  vertaa('vertailujoukon koko', r?.faktat.vertailujoukonKoko, 3);
  const minuuttirivi = (r?.rivit ?? []).find((x) => x.id === 'sijoitus-minuutit');
  vertaa('mediaani peliaikaa saaneista', minuuttirivi?.mediaani, 1292);
  vertaa('nuoli mediaaniin', minuuttirivi?.nuoli, 'tasolla');
}

// ============================================
console.log('');
console.log('PELIPAIKKA');
// ============================================
{
  // Tuntematon pelipaikka: ei maalisijoituslausetta.
  const ilman = laskeKonteksti(
    syote('julius-korkko', korkkoRuoppi, nimittajat3, [['otto-ruoppi', 'Hyökkääjä']]),
  );
  vertaa('tuntematon pelipaikka: ei maalisijaa', ilman?.faktat.sijaMaalit, null);
  vertaa(
    'tuntematon pelipaikka: ei maalilausetta',
    tekstit(ilman).filter((t) => t.indexOf('maalit') >= 0),
    [],
  );

  // Maalivahtia ei verrata kenttapelaajien maaleihin.
  const mv = laskeKonteksti(
    syote('julius-korkko', korkkoRuoppi, nimittajat3, [
      ['julius-korkko', 'Maalivahti'],
    ]),
  );
  vertaa('maalivahti: ei maalisijaa', mv?.faktat.sijaMaalit, null);

  // Ykkosliigassa pelipaikkoja ei ole -> ei maalisijoituslauseita.
  const ykkonen = laskeKonteksti(
    syote(
      'julius-korkko',
      korkkoRuoppi.map((s) => ({ ...s, sarja: 'Ykkösliiga' })),
      nimittajat3.map((n) => ({ ...n, sarja: 'Ykkösliiga' })),
      [],
      'Ykkösliiga',
    ),
  );
  vertaa('Ykkösliiga: ei maalisijaa', ykkonen?.faktat.sijaMaalit, null);
  vertaa(
    'Ykkösliiga: sarja lauseessa',
    tekstit(ykkonen).find((t) => t.indexOf('vuotiaiden') >= 0),
    '20-vuotiaiden kärki Ykkösliigassa: minuutit (1500)',
  );
}

// ============================================
console.log('');
console.log('JAETTU SIJA');
// ============================================
{
  const tasan = korkkoRuoppi.map((s) =>
    s.slug === 'julius-korkko' ? { ...s, maalit: 4 } : s,
  );
  const a = laskeKonteksti(syote('julius-korkko', tasan, nimittajat3, paikat));
  const b = laskeKonteksti(syote('otto-ruoppi', tasan, nimittajat3, paikat));
  vertaa('tasan: molemmilla sija 1', [a?.faktat.sijaMaalit, b?.faktat.sijaMaalit], [1, 1]);
  vertaa('tasan: merkitty jaetuksi', a?.faktat.jaettuMaalit, true);
  vertaa(
    'tasan: teksti kertoo jaetun',
    tekstit(a).find((t) => t.indexOf('maalit') >= 0),
    'jaettu 1. 20-vuotiaiden joukossa Veikkausliigassa: maalit (4)',
  );
  // Tihea sijoitus: tasapelin jalkeen seuraava on 2., ei 3.
  const c = laskeKonteksti(syote('kolmas-mies', tasan, nimittajat3, paikat));
  vertaa('tihea sijoitus: seuraava on 2.', c?.faktat.sijaMaalit, 2);
}

// ============================================
console.log('');
console.log('SAPLUUNAT JA RAJAT');
// ============================================
{
  const vakiintumassa = laskeKonteksti(
    syote(
      'p',
      [
        suoritus({ slug: 'p', minuutit: 900, ottelut: 14, maalit: 0 }),
        suoritus({ slug: 'muu', minuutit: 1000, ottelut: 18 }),
      ],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  // 900 / 1980 = 45 %
  vertaa(
    'osuus 30–59 %',
    tekstit(vakiintumassa)[0],
    '45 % KuPS:n minuuteista, vakiintumassa kokoonpanoon',
  );

  const hakee = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', minuutit: 200, ottelut: 8, maalit: 0 })],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  // 200 / 1980 = 10 %, ottelut 8 >= 5
  vertaa('osuus < 15 % ja ottelut >= 5', tekstit(hakee)[0], '8 peliä, hakee vielä paikkaansa');

  // 15–29 %: yksikaan sapluuna ei osu -> ei lausetta, syy kirjataan.
  const valiin = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', minuutit: 400, ottelut: 9, maalit: 0 })],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  vertaa(
    'osuus 20 %: ei osuuslausetta',
    (valiin?.rivit ?? []).filter((r) => r.id === 'osuus').length,
    0,
  );
  vertaa(
    'syy kirjattu',
    (valiin?.ohitetut ?? []).some((s) => s.indexOf('ei osu yhteenkaan') >= 0),
    true,
  );

  // Alle 3 ottelua: ei sijoituslauseita.
  const vahan = laskeKonteksti(
    syote(
      'p',
      [
        suoritus({ slug: 'p', minuutit: 170, ottelut: 2, maalit: 2 }),
        suoritus({ slug: 'muu', minuutit: 90, ottelut: 1, maalit: 0 }),
      ],
      [nimittaja('KuPS', 22)],
      [['p', 'Hyökkääjä'], ['muu', 'Hyökkääjä']],
    ),
  );
  vertaa('alle 3 ottelua: ei maalisijaa', vahan?.faktat.sijaMaalit, null);
  vertaa('alle 3 ottelua: ei minuuttisijaa', vahan?.faktat.sijaMinuutit, null);
  vertaa(
    'alle 3 ottelua: ei sijoituslauseita',
    tekstit(vahan).filter((t) => t.indexOf('vuotiaiden') >= 0),
    [],
  );

  // Nolla maalia ei tuota sijoituslausetta, vaikka sija olisi jaettu 1.
  const nollaMaalia = laskeKonteksti(
    syote(
      'p',
      [
        suoritus({ slug: 'p', minuutit: 1500, ottelut: 20, maalit: 0 }),
        suoritus({ slug: 'muu', minuutit: 1400, ottelut: 20, maalit: 0 }),
      ],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja'], ['muu', 'Puolustaja']],
    ),
  );
  vertaa('nolla maalia: sija on fakta', nollaMaalia?.faktat.sijaMaalit, 1);
  vertaa(
    'nolla maalia: ei sijoituslausetta',
    tekstit(nollaMaalia).filter((t) => t.indexOf('maalit') >= 0),
    [],
  );
  vertaa(
    'nolla maalia: syy kirjattu',
    (nollaMaalia?.ohitetut ?? []).some((s) => s.indexOf('nollalla sijoituta') >= 0),
    true,
  );

  // Sija 4 ei tuota lausetta, mutta fakta sailyy.
  const neljas = laskeKonteksti(
    syote(
      'd',
      [
        suoritus({ slug: 'a', minuutit: 1800, ottelut: 20, maalit: 9 }),
        suoritus({ slug: 'b', minuutit: 1700, ottelut: 20, maalit: 8 }),
        suoritus({ slug: 'c', minuutit: 1600, ottelut: 20, maalit: 7 }),
        suoritus({ slug: 'd', minuutit: 1500, ottelut: 20, maalit: 6 }),
      ],
      [nimittaja('KuPS', 22)],
      [['a', 'Hyökkääjä'], ['b', 'Hyökkääjä'], ['c', 'Hyökkääjä'], ['d', 'Hyökkääjä']],
    ),
  );
  vertaa('sija 4: fakta on', neljas?.faktat.sijaMaalit, 4);
  vertaa(
    'sija 4: ei lausetta',
    tekstit(neljas).filter((t) => t.indexOf('vuotiaiden') >= 0),
    [],
  );
}

// ============================================
console.log('');
console.log('OSUUS EI YLITA 100 %:A');
// ============================================
{
  // Kesken kauden siirtynyt: minuutteja kahdesta seurasta. Osuus
  // lasketaan vain paaseurasta, eika se voi ylittaa sataa.
  const siirtynyt = laskeKonteksti(
    syote(
      'p',
      [
        suoritus({ slug: 'p', joukkue: 'KuPS', minuutit: 1400, ottelut: 16, maalit: 3 }),
        suoritus({ slug: 'p', joukkue: 'Ilves', minuutit: 900, ottelut: 10, maalit: 2 }),
      ],
      [nimittaja('KuPS', 22), nimittaja('Ilves', 22)],
      [['p', 'Hyökkääjä']],
    ),
  );
  vertaa('paaseura = eniten minuutteja', siirtynyt?.joukkue, 'KuPS');
  vertaa('molemmat seurat listassa', siirtynyt?.seurat, ['Ilves', 'KuPS']);
  vertaa('osuus vain paaseurasta', siirtynyt?.faktat.osuusMinuuteista, 71);

  // Datavirhe: enemman minuutteja kuin kapasiteettia.
  const ylivuoto = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', minuutit: 9999, ottelut: 22, maalit: 0 })],
      [nimittaja('KuPS', 10)],
      [['p', 'Puolustaja']],
    ),
  );
  vertaa('osuus rajattu sataan', ylivuoto?.faktat.osuusMinuuteista, 100);
  vertaa('otteluosuus rajattu sataan', ylivuoto?.faktat.osuusOtteluista, 100);
}

// ============================================
console.log('');
console.log('PUUTTUVA DATA');
// ============================================
{
  // Tuntematon seura: lause kaytttaa muotoa "joukkueen", ei arvaa taivutusta.
  const outo = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', joukkue: 'FC Uusi', minuutit: 1500, ottelut: 20 })],
      [nimittaja('FC Uusi', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  vertaa(
    'tuntematon seura lauseessa',
    tekstit(outo)[0],
    '76 % joukkueen kauden minuuteista, aloittaa lähes aina',
  );

  // Nimittaja puuttuu: osuutta ei lasketa nollaksi vaan jatetaan pois.
  const eiNimittajaa = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', minuutit: 1500, ottelut: 20 })],
      [],
      [['p', 'Puolustaja']],
    ),
  );
  vertaa('ei nimittajaa: osuus null', eiNimittajaa?.faktat.osuusMinuuteista, null);
  vertaa('ei nimittajaa: ei osuuslausetta',
    (eiNimittajaa?.rivit ?? []).filter((r) => r.id === 'osuus').length, 0);
  vertaa(
    'ei nimittajaa: syy kirjattu',
    (eiNimittajaa?.ohitetut ?? []).some((s) => s.indexOf('nimittajariviä') >= 0),
    true,
  );

  // Pelaajaa ei ole kaudella lainkaan.
  vertaa(
    'tuntematon pelaaja -> null',
    laskeKonteksti(syote('ei-ketaan', korkkoRuoppi, nimittajat3, paikat)),
    null,
  );
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
