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
  laskeKaudenKontekstit,
  valitseNosto,
  valitseNostot,
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
    '65 % KuPS:n otteluiden minuuteista',
  );
  vertaa(
    'Ruoppi: tiheyslause',
    tekstit(r).find((t) => t.indexOf('min/ottelu') >= 0),
    '86 min/ottelu',
  );
  vertaa(
    'Ruoppi: aloituslause',
    tekstit(r).find((t) => t.indexOf('aloittanut') >= 0),
    'aloittanut 15/22 ottelua',
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
  // Sijoitusrivilla ei ole nuolta; osuusrivilla on.
  vertaa('sijoitusrivilla ei nuolta', minuuttirivi?.nuoli, null);
  // Ruopin osuus 65 % on ikaryhman mediaani (76 / 65 / 15), joten nuoli
  // osoittaa tasoa. Olennaista on, etta osuusrivilla nuoli on olemassa.
  vertaa(
    'osuusrivilla on nuoli',
    (r?.rivit ?? []).find((x) => x.id === 'osuus')?.nuoli,
    'tasolla',
  );
  vertaa(
    'yhdellakaan sijoitusrivilla ei ole nuolta',
    (r?.rivit ?? [])
      .filter((x) => x.id.indexOf('sijoitus') === 0)
      .every((x) => x.nuoli === null),
    true,
  );
}

// ============================================
console.log('');
console.log('MAALISIJOITUS EI RIIPU PELIPAIKASTA');
// ============================================
{
  // Pelipaikka ei ole ehto: lause syntyy vaikka rekisterissa ei olisi
  // riviakaan. Ehto on maalit >= 1.
  const ilman = laskeKonteksti(syote('julius-korkko', korkkoRuoppi, nimittajat3, []));
  vertaa('ilman pelipaikkoja: maalisija', ilman?.faktat.sijaMaalit, 1);
  vertaa(
    'ilman pelipaikkoja: maalilause syntyy',
    tekstit(ilman).find((t) => t.indexOf('maalit') >= 0),
    '20-vuotiaiden kärki Veikkausliigassa: maalit (5)',
  );

  // Maalivahti on vertailujoukossa nollassa eika siirra ketaan
  // karkikolmikosta. Ilman omaa maalia han ei itse saa maalilausetta.
  const mvData = korkkoRuoppi.concat([
    suoritus({
      slug: 'maalivahti',
      etunimi: 'Mauri',
      sukunimi: 'Vahti',
      joukkue: 'HJK',
      ika: 20,
      minuutit: 1980,
      ottelut: 22,
      maalit: 0,
    }),
  ]);
  const mvPaikat: Array<[string, string | null]> = paikat.concat([
    ['maalivahti', 'Maalivahti'],
  ]);
  const mv = laskeKonteksti(syote('maalivahti', mvData, nimittajat3, mvPaikat));
  vertaa('maalivahti: sija on fakta', mv?.faktat.sijaMaalit, 4);
  vertaa(
    'maalivahti: ei maalilausetta ilman maalia',
    tekstit(mv).filter((t) => t.indexOf('maalit') >= 0),
    [],
  );
  const korkkoMv = laskeKonteksti(
    syote('julius-korkko', mvData, nimittajat3, mvPaikat),
  );
  vertaa(
    'maalivahti ei siirra karkea',
    korkkoMv?.faktat.sijaMaalit,
    1,
  );

  // Ykkosliigassa pelipaikkoja ei ole kerätty. Maalilauseen on silti
  // synnyttava — juuri tama oli syy poistaa pelipaikkaehto.
  const ykkonen = laskeKonteksti(
    syote(
      'julius-korkko',
      korkkoRuoppi.map((s) => ({ ...s, sarja: 'Ykkösliiga' })),
      nimittajat3.map((n) => ({ ...n, sarja: 'Ykkösliiga' })),
      [],
      'Ykkösliiga',
    ),
  );
  vertaa('Ykkösliiga: maalisija', ykkonen?.faktat.sijaMaalit, 1);
  vertaa(
    'Ykkösliiga: sarja lauseessa',
    tekstit(ykkonen).find((t) => t.indexOf('maalit') >= 0),
    '20-vuotiaiden kärki Ykkösliigassa: maalit (5)',
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
  const isoOsuus = laskeKonteksti(
    syote(
      'p',
      [
        suoritus({ slug: 'p', minuutit: 900, ottelut: 14, aloitukset: 9, maalit: 0 }),
        suoritus({ slug: 'muu', minuutit: 1000, ottelut: 18, aloitukset: 11 }),
      ],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  // 900 / 1980 = 45 %
  vertaa('osuus >= 30 %', tekstit(isoOsuus)[0], '45 % KuPS:n otteluiden minuuteista');
  vertaa(
    'aloituslause',
    tekstit(isoOsuus).find((t) => t.indexOf('aloittanut') >= 0),
    'aloittanut 9/22 ottelua',
  );

  const pieniOsuus = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', minuutit: 200, ottelut: 8, aloitukset: 1, maalit: 0 })],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  // 200 / 1980 = 10 %, ottelut 8 >= 5
  vertaa(
    'osuus < 30 % ja ottelut >= 5',
    tekstit(pieniOsuus)[0],
    '8 ottelua, 10 % KuPS:n otteluiden minuuteista',
  );

  // Pieni osuus ja alle viisi ottelua: ei osuuslausetta, syy kirjataan.
  const vahanOtteluita = laskeKonteksti(
    syote(
      'p',
      [suoritus({ slug: 'p', minuutit: 120, ottelut: 4, aloitukset: 0, maalit: 0 })],
      [nimittaja('KuPS', 22)],
      [['p', 'Puolustaja']],
    ),
  );
  vertaa(
    'osuus 6 % ja 4 ottelua: ei osuuslausetta',
    (vahanOtteluita?.rivit ?? []).filter((r) => r.id === 'osuus').length,
    0,
  );
  vertaa(
    'syy kirjattu',
    (vahanOtteluita?.ohitetut ?? []).some((x) => x.indexOf('alle 30 %:n rajan') >= 0),
    true,
  );
  // Nolla aloitusta: ei aloituslausetta, koska "aloittanut 0/22" ei
  // kerro pelaajasta mitaan mita osuuslause ei jo kerro.
  vertaa(
    'nolla aloitusta: ei aloituslausetta',
    tekstit(vahanOtteluita).filter((t) => t.indexOf('aloittanut') >= 0),
    [],
  );

  // Ei tulkitsevia lopukkeita missaan lauseessa.
  const kielletyt = [
    'aloittaa lähes aina',
    'vakiintumassa kokoonpanoon',
    'hakee vielä paikkaansa',
    'pelaa lähes täydet pelit',
  ];
  const kaikkiLauseet = [isoOsuus, pieniOsuus, vahanOtteluita]
    .flatMap((k) => tekstit(k));
  vertaa(
    'ei tulkitsevia lopukkeita',
    kaikkiLauseet.filter((t) => kielletyt.some((k) => t.indexOf(k) >= 0)),
    [],
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
    '76 % joukkueen otteluiden minuuteista',
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

// ============================================
console.log('');
console.log('ETUSIVUN NOSTO');
// ============================================
{
  // Kuusi 20-vuotiasta. Viisi on lahella toisiaan, yksi poikkeaa
  // selvasti maaleissa — nosto on han.
  // Jokaisella oma seura: seurasaanto testataan erikseen alempana.
  const SEURAT = ['KuPS', 'Ilves', 'HJK', 'AC Oulu', 'VPS', 'TPS'];
  const joukko: SuoritusDoc[] = [
    suoritus({ slug: 'a', joukkue: 'KuPS', minuutit: 1200, ottelut: 20, aloitukset: 14, maalit: 1 }),
    suoritus({ slug: 'b', joukkue: 'Ilves', minuutit: 1250, ottelut: 20, aloitukset: 14, maalit: 2 }),
    suoritus({ slug: 'c', joukkue: 'HJK', minuutit: 1300, ottelut: 20, aloitukset: 15, maalit: 1 }),
    suoritus({ slug: 'd', joukkue: 'AC Oulu', minuutit: 1350, ottelut: 20, aloitukset: 15, maalit: 2 }),
    suoritus({ slug: 'e', joukkue: 'VPS', minuutit: 1400, ottelut: 20, aloitukset: 16, maalit: 3 }),
    suoritus({
      slug: 'maalintekija',
      etunimi: 'Maali',
      sukunimi: 'Tekijä',
      joukkue: 'TPS',
      minuutit: 1380,
      ottelut: 20,
      aloitukset: 15,
      maalit: 14,
    }),
  ];
  const nim = SEURAT.map((x) => nimittaja(x, 22));
  const kaikki = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: joukko,
    nimittajat: nim,
    pelipaikat: new Map(),
  });
  vertaa('kaikki pelaajat saivat kontekstin', kaikki.length, 6);

  const nosto = valitseNosto(kaikki);
  vertaa('nosto on suurin poikkeama', nosto?.slug, 'maalintekija');
  vertaa('noston mittari', nosto?.rivi.mittari, 'maalit');
  // maalit 1,2,1,2,3,14 -> mediaani 2, poikkeamat 1,0,1,0,1,12 -> MAD 1
  vertaa('noston mediaani', nosto?.rivi.mediaani, 2);
  vertaa('noston hajonta', nosto?.rivi.hajonta, 1);
  vertaa('noston poikkeama', nosto?.poikkeama, 12);

  // Sama data, mutta ikaryhmassa vain nelja pelaajaa: liian pieni joukko.
  const pieni = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: joukko.slice(2),
    nimittajat: nim,
    pelipaikat: new Map(),
  });
  vertaa('alle viisi vertailtavaa: ei nostoa', valitseNosto(pieni), null);

  // Hajonta 0: kaikilla sama arvo -> poikkeamaa ei lasketa.
  const samat = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug, i) =>
    suoritus({
      slug,
      joukkue: SEURAT[i],
      minuutit: 1300,
      ottelut: 20,
      aloitukset: 15,
      maalit: 2,
    }),
  );
  const samatK = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: samat,
    nimittajat: nim,
    pelipaikat: new Map(),
  });
  vertaa('hajonta 0 -> ei nostoa', valitseNosto(samatK), null);
  vertaa('tyhja lista -> ei nostoa', valitseNosto([]), null);

  // Valokeila: kolme eri pelaajaa, ei samaa pelaajaa kahdesti.
  const kolme = valitseNostot(kaikki, 3);
  vertaa('valokeilassa kolme', kolme.length, 3);
  vertaa('valokeilan ensimmainen', kolme[0]?.slug, 'maalintekija');
  vertaa(
    'valokeilassa eri pelaajat',
    new Set(kolme.map((x) => x.slug)).size,
    3,
  );
  vertaa(
    'valokeila on laskevassa jarjestyksessa',
    kolme.every((x, i) => i === 0 || x.poikkeama <= kolme[i - 1].poikkeama),
    true,
  );

  // Valinta koskee VAIN mediaanin ylapuolelle jaavia poikkeamia.
  const kaikkiEhdokkaat = valitseNostot(kaikki, 99);
  vertaa(
    'kaikki nostot ovat mediaanin ylapuolella',
    kaikkiEhdokkaat.every(
      (n) => n.rivi.mediaani !== null && n.rivi.arvo > n.rivi.mediaani,
    ),
    true,
  );
  vertaa(
    'kaikki poikkeamat positiivisia',
    kaikkiEhdokkaat.every((n) => n.poikkeama > 0),
    true,
  );

  // Selvasti mediaanin ALAPUOLELLA oleva pelaaja ei paady valokeilaan,
  // vaikka poikkeama itseisarvona olisi suurin.
  const alapuolella: SuoritusDoc[] = [
    suoritus({ slug: 'a', joukkue: 'KuPS', minuutit: 1900, ottelut: 22, aloitukset: 21, maalit: 2 }),
    suoritus({ slug: 'b', joukkue: 'Ilves', minuutit: 1850, ottelut: 22, aloitukset: 20, maalit: 2 }),
    suoritus({ slug: 'c', joukkue: 'HJK', minuutit: 1800, ottelut: 21, aloitukset: 20, maalit: 2 }),
    suoritus({ slug: 'd', joukkue: 'AC Oulu', minuutit: 1750, ottelut: 21, aloitukset: 19, maalit: 2 }),
    suoritus({ slug: 'e', joukkue: 'VPS', minuutit: 1700, ottelut: 20, aloitukset: 19, maalit: 2 }),
    suoritus({ slug: 'vahan', joukkue: 'TPS', minuutit: 90, ottelut: 6, aloitukset: 1, maalit: 0 }),
  ];
  const alaK = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: alapuolella,
    nimittajat: nim,
    pelipaikat: new Map(),
  });
  vertaa(
    'mediaanin alapuolinen ei ole valokeilassa',
    valitseNostot(alaK, 99).some((n) => n.slug === 'vahan'),
    false,
  );

  // Siirtomerkinta: valinta ei hae sita, vaan reitti taydentaa.
  vertaa('valinta jattaa siirron nulliksi', nosto?.siirto, null);
  vertaa('valinta palauttaa kauden seurat', nosto?.seurat, ['TPS']);
  vertaa('valinta merkitsee akatemian', nosto?.akatemia, false);
}

// ============================================
console.log('');
console.log('VALOKEILAN RAJAT');
// ============================================
{
  const nim = ['KuPS', 'Ilves', 'HJK Klubi 04', 'SJK Akatemia', 'HJK'].map((x) =>
    nimittaja(x, 22),
  );

  // 1. VALINTA-AKSELIT: vain osuus ja maalit.
  // Kuusi samanikaista, joilla kaikilla sama osuus ja sama maalimaara,
  // mutta yhdella selvasti eniten minuutteja ja aloituksia. Minuutit,
  // aloitukset ja tiheys eivat saa tuottaa nostoa.
  const samaOsuus: SuoritusDoc[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug, i) =>
    suoritus({
      slug,
      joukkue: ['KuPS', 'Ilves', 'HJK', 'AC Oulu', 'VPS', 'TPS'][i],
      minuutit: 1188,
      ottelut: i === 0 ? 22 : 14,
      aloitukset: i === 0 ? 22 : 8,
      maalit: 2,
    }),
  );
  const akselitK = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: samaOsuus,
    nimittajat: ['KuPS', 'Ilves', 'HJK', 'AC Oulu', 'VPS', 'TPS'].map((x) =>
      nimittaja(x, 22),
    ),
    pelipaikat: new Map(),
  });
  const akselitNostot = valitseNostot(akselitK, 3);
  vertaa(
    'minuutit, aloitukset ja tiheys eivat valitse',
    akselitNostot.map((n) => n.rivi.id),
    [],
  );

  // 2. YKSI PELAAJA PER SEURA. Kolme KuPS-pelaajaa karjessa.
  const samaSeura: SuoritusDoc[] = [
    suoritus({ slug: 'kups1', joukkue: 'KuPS', minuutit: 1900, ottelut: 22, aloitukset: 21, maalit: 12 }),
    suoritus({ slug: 'kups2', joukkue: 'KuPS', minuutit: 1850, ottelut: 22, aloitukset: 20, maalit: 10 }),
    suoritus({ slug: 'kups3', joukkue: 'KuPS', minuutit: 1800, ottelut: 22, aloitukset: 20, maalit: 8 }),
    suoritus({ slug: 'ilves1', joukkue: 'Ilves', minuutit: 900, ottelut: 18, aloitukset: 9, maalit: 1 }),
    suoritus({ slug: 'hjk1', joukkue: 'HJK', minuutit: 800, ottelut: 18, aloitukset: 8, maalit: 1 }),
    suoritus({ slug: 'hjk2', joukkue: 'HJK', minuutit: 700, ottelut: 17, aloitukset: 7, maalit: 0 }),
  ];
  const seuraK = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: samaSeura,
    nimittajat: ['KuPS', 'Ilves', 'HJK'].map((x) => nimittaja(x, 22)),
    pelipaikat: new Map(),
  });
  const seuraNostot = valitseNostot(seuraK, 3);
  vertaa(
    'enintaan yksi pelaaja per seura',
    seuraNostot.length === new Set(seuraNostot.map((n) => n.joukkue)).size,
    true,
  );
  vertaa('paras KuPS-pelaaja valittiin', seuraNostot[0]?.slug, 'kups1');
  vertaa(
    'toinen KuPS-pelaaja ei ole valokeilassa',
    seuraNostot.some((n) => n.slug === 'kups2'),
    false,
  );

  // 3. ENINTAAN YKSI AKATEMIAJOUKKUEESTA. Akatemiat ovat karjessa.
  const akatemiat: SuoritusDoc[] = [
    suoritus({ slug: 'klubi1', joukkue: 'HJK Klubi 04', minuutit: 1900, ottelut: 22, aloitukset: 21, maalit: 12 }),
    suoritus({ slug: 'sjka1', joukkue: 'SJK Akatemia', minuutit: 1850, ottelut: 22, aloitukset: 20, maalit: 10 }),
    suoritus({ slug: 'kups1', joukkue: 'KuPS', minuutit: 1400, ottelut: 20, aloitukset: 15, maalit: 6 }),
    suoritus({ slug: 'ilves1', joukkue: 'Ilves', minuutit: 900, ottelut: 18, aloitukset: 9, maalit: 1 }),
    suoritus({ slug: 'hjk1', joukkue: 'HJK', minuutit: 800, ottelut: 18, aloitukset: 8, maalit: 1 }),
    suoritus({ slug: 'hjk2', joukkue: 'HJK', minuutit: 300, ottelut: 12, aloitukset: 2, maalit: 0 }),
  ];
  const akatemiaK = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Ykkösliiga',
    suoritukset: akatemiat.map((x) => ({ ...x, sarja: 'Ykkösliiga' })),
    nimittajat: nim.map((x) => ({ ...x, sarja: 'Ykkösliiga' })),
    pelipaikat: new Map(),
  });
  const akatemiaNostot = valitseNostot(akatemiaK, 3);
  vertaa(
    'enintaan yksi akatemiajoukkueesta',
    akatemiaNostot.filter((n) => n.akatemia).length <= 1,
    true,
  );
  vertaa('paras akatemiapelaaja valittiin', akatemiaNostot[0]?.slug, 'klubi1');
  vertaa('akatemia merkitaan', akatemiaNostot[0]?.akatemia, true);
  vertaa(
    'toinen akatemia ei ole valokeilassa',
    akatemiaNostot.some((n) => n.slug === 'sjka1'),
    false,
  );
  vertaa(
    'muut seurat tayttavat paikat',
    akatemiaNostot.slice(1).every((n) => !n.akatemia),
    true,
  );
}

// ============================================
console.log('');
console.log('EI ARVOTTAVIA SANOJA');
// ============================================
{
  // Lauseessa ei saa olla arvioita pelaajasta. "Karki" ja "jaettu 2."
  // ovat sijoituksia, eivat arvioita, joten ne EIVAT ole kiellettyja.
  const kielletyt = [
    'aloittaa lähes aina',
    'vakiintumassa kokoonpanoon',
    'hakee vielä paikkaansa',
    'pelaa lähes täydet pelit',
    'kovin',
    'paras',
    'parhaa',
    'parempi',
    'huippu',
    'loistav',
    'vakuuttav',
    'lupaav',
  ];
  const kaikkiLauseet = laskeKaudenKontekstit({
    kausi: 2026,
    sarja: 'Veikkausliiga',
    suoritukset: korkkoRuoppi,
    nimittajat: nimittajat3,
    pelipaikat: new Map(paikat),
  }).flatMap((k) => k.rivit.map((r) => r.teksti));

  vertaa(
    'lauseita syntyi',
    kaikkiLauseet.length > 0,
    true,
  );
  vertaa(
    'ei arvottavia sanoja',
    kaikkiLauseet.filter((t) =>
      kielletyt.some((s) => t.toLowerCase().indexOf(s) >= 0),
    ),
    [],
  );
  // Sijoituslause sailyy: se ei ole arvottava.
  vertaa(
    'sijoituslause sailyy',
    kaikkiLauseet.some((t) => t.indexOf('kärki') >= 0),
    true,
  );
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
