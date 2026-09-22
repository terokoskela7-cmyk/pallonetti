// ============================================
// YKSIKKOTESTI — seuravertailu
//
// Kaaviot ja taulukko lukevat samaa laskentaa, joten virhe taalla
// naytettaisiin sivustolla kahdesti samanlaisena eika erottuisi
// mistaan. Testi ajaa laskennan muistinvaraisella aineistolla: ei
// Firestorea, ei verkkoa.
//
// Ajo:  npm run build && node lib/scripts/testSeurat.js
// ============================================
import {
  laskeSeurakausi,
  laskeLiukuva,
  laskeSeuratrendit,
  laskeVertailuviivat,
  seuraTunniste,
  LIUKUVA_IKKUNA,
  type Seurakausi,
} from '../services/seurat';
import type { NimittajaDoc, SuoritusDoc } from '../services/kausiData';

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
    sarja: 'Veikkausliiga', kausi: '2026', vaihe: 'Runkosarja',
    joukkue: 'KuPS', pelaajaAvain: x.slug || 'p', slug: 'p',
    etunimi: 'Etu', sukunimi: 'Suku', ika: 20,
    minuutit: 0, aloitukset: 0, ottelut: 0, maalit: 0,
    ...x,
  } as SuoritusDoc;
}

function nimittaja(joukkue: string, ottelut: number, vaihe = 'Runkosarja'): NimittajaDoc {
  return {
    sarja: 'Veikkausliiga', kausi: '2026', vaihe, joukkue,
    ottelut, kapasiteetti_min: ottelut * 90 * 11,
  };
}

// ============================================
console.log('SEURAN TUNNISTE');
// ============================================
{
  vertaa('skandit', seuraTunniste('KäPa'), 'kapa');
  vertaa('valilyonnit', seuraTunniste('AC Oulu'), 'ac-oulu');
  vertaa('numerot sailyvat', seuraTunniste('HJK Klubi 04'), 'hjk-klubi-04');
  vertaa('viivat', seuraTunniste('PK-35'), 'pk-35');
  // Sama nimi antaa saman tunnisteen kaudesta riippumatta — tama on
  // koko viivan jatkuvuuden ehto.
  vertaa(
    'pysyva kausien yli',
    seuraTunniste('IFK Mariehamn') === seuraTunniste('IFK Mariehamn'),
    true,
  );
}

// ============================================
console.log('');
console.log('YHDEN KAUDEN LASKENTA');
// ============================================
{
  const rivit = [
    suoritus({ joukkue: 'KuPS', slug: 'a', ika: 20, minuutit: 1980, ottelut: 22 }),
    suoritus({ joukkue: 'KuPS', slug: 'b', ika: 18, minuutit: 990, ottelut: 15 }),
    suoritus({ joukkue: 'Ilves', slug: 'c', ika: 19, minuutit: 2178, ottelut: 22 }),
  ];
  const nim = [nimittaja('KuPS', 22), nimittaja('Ilves', 22), nimittaja('HJK', 22)];
  const seurat = laskeSeurakausi(2026, 'Veikkausliiga', rivit, nim);

  vertaa('kaikki nimittajan seurat mukana', seurat.map((s) => s.nimi), ['HJK', 'Ilves', 'KuPS']);

  const kups = seurat.find((s) => s.nimi === 'KuPS')!;
  // kapasiteetti 22 × 90 × 11 = 21780; minuutit 2970 -> 13,6 %
  vertaa('KuPS kapasiteetti', kups.kapasiteettiMin, 21780);
  vertaa('KuPS minuutit', kups.nuortenMinuutit, 2970);
  vertaa('KuPS osuus', kups.osuus, 13.6);
  vertaa('KuPS pelaajia', kups.pelaajia, 2);
  // Painotettu keski-ika: (20×1980 + 18×990) / 2970 = 19,3
  vertaa('KuPS painotettu keski-ika', kups.keskiIka, 19.3);

  // Seura ilman yhtaan nuorta EI ole null vaan 0: kapasiteetti tiedetaan
  // ja minuutteja tosiaan meni nolla.
  const hjk = seurat.find((s) => s.nimi === 'HJK')!;
  vertaa('HJK osuus on 0, ei null', hjk.osuus, 0);
  vertaa('HJK keski-ika on null', hjk.keskiIka, null);

  // Kaikki vaiheet mukaan: osoittaja ja nimittaja samasta ottelujoukosta.
  const monivaihe = laskeSeurakausi(
    2026, 'Veikkausliiga',
    [suoritus({ joukkue: 'KuPS', slug: 'a', minuutit: 2160, ottelut: 24 })],
    [nimittaja('KuPS', 22), nimittaja('KuPS', 2, 'Mestaruussarja')],
  );
  vertaa('vaiheet summautuvat', monivaihe[0].ottelut, 24);
  vertaa('kapasiteetti kaikista vaiheista', monivaihe[0].kapasiteettiMin, 24 * 90 * 11);

  // Akatemiamerkinta tulee nimetysta vakiosta.
  const akat = laskeSeurakausi(
    2026, 'Ykkösliiga', [],
    [nimittaja('HJK Klubi 04', 22), nimittaja('KäPa', 22)],
  );
  vertaa('akatemia merkitty', akat.map((s) => [s.nimi, s.akatemia]), [['HJK Klubi 04', true], ['KäPa', false]]);
}

// ============================================
console.log('');
console.log('LIUKUVA KESKIARVO (' + LIUKUVA_IKKUNA + ' kautta)');
// ============================================
{
  vertaa('kaksi ensimmaista ovat null', laskeLiukuva([10, 20, 30]).slice(0, 2), [null, null]);
  vertaa('kolmas on keskiarvo', laskeLiukuva([10, 20, 30])[2], 20);
  vertaa(
    'liukuu eteenpain',
    laskeLiukuva([10, 20, 30, 40]),
    [null, null, 20, 30],
  );
  // Puuttuvan kauden yli EI interpoloida: kahden kauden keskiarvo
  // kolmen kauden viivana vaittaisi enemman kuin data kertoo.
  vertaa(
    'puuttuva kausi katkaisee',
    laskeLiukuva([10, null, 30, 40, 50]),
    [null, null, null, null, 40],
  );
  vertaa('pelkka null', laskeLiukuva([null, null, null]), [null, null, null]);
  vertaa('pyoristys yhteen desimaaliin', laskeLiukuva([10, 11, 12])[2], 11);
}

// ============================================
console.log('');
console.log('AIKASARJAT JA KATKOT');
// ============================================
{
  const kaudet = [2024, 2025, 2026];
  const mk = (kausi: number, rivit: Array<[string, number]>): Seurakausi[] =>
    rivit.map(([nimi, osuus]) => ({
      tunniste: seuraTunniste(nimi), nimi, kausi, sarja: 'Veikkausliiga',
      akatemia: false, ottelut: 22, kapasiteettiMin: 21780,
      nuortenMinuutit: Math.round((osuus / 100) * 21780),
      osuus, pelaajia: 3, keskiIka: 19,
    }));

  const kausittain = new Map<number, Seurakausi[]>([
    [2024, mk(2024, [['KuPS', 10], ['Ilves', 20]])],
    // Ilves puuttuu 2025: ei ollut sarjassa.
    [2025, mk(2025, [['KuPS', 12]])],
    [2026, mk(2026, [['KuPS', 14], ['Ilves', 30]])],
  ]);
  const trendit = laskeSeuratrendit(kaudet, kausittain);

  vertaa('molemmat seurat mukana', trendit.length, 2);
  const ilves = trendit.find((t) => t.nimi === 'Ilves')!;
  vertaa('puuttuva kausi on null, ei 0', ilves.pisteet, [20, null, 30]);
  vertaa('kaudet mukana kertoo katkon', ilves.kaudetMukana, [2024, 2026]);
  vertaa('katkoinen sarja ei saa liukuvaa', ilves.liukuva, [null, null, null]);

  const kups = trendit.find((t) => t.nimi === 'KuPS')!;
  vertaa('yhtenainen sarja saa liukuvan', kups.liukuva, [null, null, 12]);

  // Jarjestys: tuorein luku suurimmasta pienimpaan.
  vertaa('jarjestys tuoreimman mukaan', trendit.map((t) => t.nimi), ['Ilves', 'KuPS']);

  // Seura, jolla ei ole tuoreinta lukua, menee perälle eika katoa.
  const poistunut = new Map(kausittain);
  poistunut.set(2026, mk(2026, [['KuPS', 14]]));
  const t2 = laskeSeuratrendit(kaudet, poistunut);
  vertaa('poistunut seura on mukana perassa', t2.map((t) => t.nimi), ['KuPS', 'Ilves']);
  vertaa('poistuneen viimeinen piste on null', t2[1].pisteet[2], null);
}

// ============================================
console.log('');
console.log('VERTAILUVIIVAT');
// ============================================
{
  const rivi = (nimi: string, min: number, akatemia: boolean): Seurakausi => ({
    tunniste: seuraTunniste(nimi), nimi, kausi: 2026, sarja: 'Ykkösliiga',
    akatemia, ottelut: 22, kapasiteettiMin: 21780, nuortenMinuutit: min,
    osuus: Math.round((min / 21780) * 1000) / 10, pelaajia: 3, keskiIka: 19,
  });
  const kausittain = new Map<number, Seurakausi[]>([
    [2026, [
      rivi('HJK Klubi 04', 21000, true),
      rivi('SJK Akatemia', 19000, true),
      rivi('KäPa', 2178, false),
      rivi('JIPPO', 1089, false),
    ]],
  ]);
  const viivat = laskeVertailuviivat([2026], kausittain);

  // Kaikki: (21000+19000+2178+1089) / (4 × 21780) = 49,7 %
  vertaa('kaikki joukkueet', viivat[0].kaikki, 49.7);
  // Ilman akatemioita: (2178+1089) / (2 × 21780) = 7,5 %
  vertaa('ilman akatemioita', viivat[0].ilmanAkatemioita, 7.5);
  // Juuri tama ero on syy nayttaa kaksi viivaa.
  vertaa(
    'akatemiat nostavat sarjan lukua yli kuusinkertaiseksi',
    viivat[0].kaikki! > viivat[0].ilmanAkatemioita! * 6,
    true,
  );

  // Tyhja kausi: ei lukuja, ei nollaa.
  const tyhja = laskeVertailuviivat([2026], new Map());
  vertaa('tyhja kausi -> null', tyhja[0], { kausi: 2026, kaikki: null, ilmanAkatemioita: null });

  // --- Toinen viiva syntyy VAIN jos akatemioita on ---------------------
  // Ehto paatellaan datasta onAkatemia-funktiolla, EI sarjan nimesta.

  // 1. Sarja, jossa EI ole akatemiajoukkueita (kuten Veikkausliiga):
  //    vain yksi viiva. Kaksi identtista lukua vierekkain vaittaisi
  //    vertailua, jota ei ole tehty.
  const ilmanAkatemioita = laskeVertailuviivat(
    [2026],
    new Map([[2026, [rivi('KuPS', 2178, false), rivi('Ilves', 4356, false)]]]),
  );
  vertaa('ei akatemioita: kaikki-luku on', ilmanAkatemioita[0].kaikki, 15);
  vertaa(
    'ei akatemioita: toista viivaa ei ole',
    ilmanAkatemioita[0].ilmanAkatemioita,
    null,
  );

  // 2. Sarja, jossa on yksikin akatemiajoukkue: kaksi viivaa.
  const yksiAkatemia = laskeVertailuviivat(
    [2026],
    new Map([[2026, [
      rivi('HJK Klubi 04', 21000, true),
      rivi('KuPS', 2178, false),
      rivi('Ilves', 4356, false),
    ]]]),
  );
  vertaa('yksi akatemia riittaa toiseen viivaan',
    yksiAkatemia[0].ilmanAkatemioita !== null, true);
  vertaa('toinen viiva jattaa akatemian pois',
    yksiAkatemia[0].ilmanAkatemioita, 15);
  vertaa('akatemia nostaa kaikki-lukua',
    yksiAkatemia[0].kaikki! > yksiAkatemia[0].ilmanAkatemioita!, true);

  // 3. Sama sarja, eri kausi: akatemia putoaa pois -> viiva katoaa.
  //    Tama on syy paatella ehto kaudelta eika sarjan nimesta.
  const kaksiKautta = laskeVertailuviivat(
    [2025, 2026],
    new Map([
      [2025, [rivi('HJK Klubi 04', 21000, true), rivi('KuPS', 2178, false)]],
      [2026, [rivi('KuPS', 2178, false)]],
    ]),
  );
  vertaa(
    'akatemiakausi saa kaksi viivaa',
    kaksiKautta[0].ilmanAkatemioita !== null,
    true,
  );
  vertaa(
    'akatemiaton kausi saa yhden',
    kaksiKautta[1].ilmanAkatemioita,
    null,
  );
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
