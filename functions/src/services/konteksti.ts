// ============================================
// KONTEKSTIMOOTTORI — luvusta lauseeksi
//
// Yksikaan kontekstilause ei ole kirjoitettu kasin. Jokainen tuotetaan
// kauden datasta ajossa, koska kasin kirjoitettu vaite vanhenee
// kierroksessa ja sivu alkaa valehdella itsevarmasti. Luonnoksessa luki
// "Ruoppi, paras U20-maalintekija, 4 maalia" — Julius Korkko (AC Oulu,
// 20 v) oli tehnyt viisi.
//
// Lauseet muodostetaan TAALLA eika selaimessa: sama laskenta palvelee
// pelaajasivua, listoja ja etusivua, ja se on yksikkotestattavissa
// ilman selainta.
//
// NELJA VERTAILUAKSELIA
//   osuus minuuteista   minuutit / (joukkueen ottelut × 90)
//   osuus otteluista    ottelut / joukkueen ottelut
//   tiheys              minuutit / ottelut
//   sijoitus            tihea sijoitus (dense rank) samanikaisten joukossa
//
// Joukkueen ottelumaara luetaan nimittajat-kokoelmasta, ei vakiosta.
//
// PUUTTUVA ARVO EI OLE NOLLA. Jos lause ei ole todistettavissa datasta,
// sita ei tuoteta. Tyhja tila on parempi kuin merkityksetön lause, ja
// jokainen poisjatetty lause kirjataan syineen (ohitetut), jotta
// puuttuminen voidaan katselmoida.
// ============================================
import type { NimittajaDoc, SuoritusDoc } from './kausiData';
import { genetiivi, sarjaInessiivi } from './taivutus';

// --- Kynnysarvot lausesapluunoille -------------------------------------
// Nama ovat sapluunan ehtoja, eivat dataa: ne maarittavat milloin lause
// on kertomisen arvoinen. Yhdessa paikassa, jottei sama raja ole
// kahdessa eri kohdassa eri lukuna.
const OSUUS_VAKIOPAIKKA = 60; // %
const OSUUS_VAKIINTUMASSA = 30; // %
const OSUUS_HAKEE_PAIKKAANSA = 15; // %
const OTTELUT_HAKEE_PAIKKAANSA = 5;
const TIHEYS_TAYDET_PELIT = 80; // min/ottelu
/** Alle taman ottelumaaran pelanneista ei tuoteta sijoituslauseita. */
const SIJOITUS_MIN_OTTELUT = 3;
/** Sijoituslause tuotetaan vain karkikolmikosta. */
const SIJOITUS_MAX_SIJA = 3;

/** Pelipaikka, jota ei verrata kenttapelaajien maaleihin. */
const MAALIVAHTI = 'Maalivahti';

export type Nuoli = 'yli' | 'tasolla' | 'alle';

export interface Kontekstirivi {
  /** Vakaa tunniste riville, esim. 'osuus' — kayttoliittyman avain. */
  id: string;
  teksti: string;
  /** Vertailu ikaryhman mediaaniin. null = mediaania ei voi laskea. */
  nuoli: Nuoli | null;
  mittari: string;
  arvo: number;
  yksikko: string;
  mediaani: number | null;
  /** Vertailujoukko sanoin — sama joukko kuin mediaanissa ja sijoituksessa. */
  vertailujoukko: string | null;
}

export interface Konteksti {
  slug: string;
  kausi: number;
  sarja: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  /** Seura, jossa pelaajalla on eniten minuutteja talla kaudella. */
  joukkue: string;
  seurat: string[];
  pelipaikka: string | null;
  faktat: {
    minuutit: number;
    ottelut: number;
    maalit: number;
    aloitukset: number;
    /** Minuutit paaseurassa — osuus lasketaan naista. */
    minuutitPaaseurassa: number;
    ottelutPaaseurassa: number;
    joukkueenOttelut: number | null;
    osuusMinuuteista: number | null;
    osuusOtteluista: number | null;
    tiheys: number | null;
    sijaMinuutit: number | null;
    sijaMaalit: number | null;
    jaettuMinuutit: boolean;
    jaettuMaalit: boolean;
    vertailujoukonKoko: number;
  };
  rivit: Kontekstirivi[];
  /** Miksi lause jai pois. Katselmointia varten, ei kayttoliittymaan. */
  ohitetut: string[];
}

interface Kooste {
  slug: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  minuutit: number;
  ottelut: number;
  maalit: number;
  aloitukset: number;
  seurat: Map<string, { minuutit: number; ottelut: number }>;
  paaseura: string;
  minuutitPaaseurassa: number;
  ottelutPaaseurassa: number;
}

/** Pelaajan kausikooste seuroittain. Sama laskenta kaikille pelaajille. */
function kokoaPelaajat(suoritukset: SuoritusDoc[]): Map<string, Kooste> {
  const kartta = new Map<string, Kooste>();
  for (const s of suoritukset) {
    let p = kartta.get(s.slug);
    if (!p) {
      p = {
        slug: s.slug,
        etunimi: s.etunimi,
        sukunimi: s.sukunimi,
        ika: s.ika,
        minuutit: 0,
        ottelut: 0,
        maalit: 0,
        aloitukset: 0,
        seurat: new Map(),
        paaseura: s.joukkue,
        minuutitPaaseurassa: 0,
        ottelutPaaseurassa: 0,
      };
      kartta.set(s.slug, p);
    }
    p.minuutit += s.minuutit;
    p.ottelut += s.ottelut;
    p.maalit += s.maalit;
    p.aloitukset += s.aloitukset;
    if (!p.ika && s.ika) p.ika = s.ika;
    const seura = p.seurat.get(s.joukkue) || { minuutit: 0, ottelut: 0 };
    seura.minuutit += s.minuutit;
    seura.ottelut += s.ottelut;
    p.seurat.set(s.joukkue, seura);
  }

  // Paaseura = seura jossa eniten minuutteja. Kesken kauden siirtyneella
  // osuus lasketaan vain siita seurasta, jonka otteluihin se suhteutetaan;
  // muuten kahden seuran minuutit jaettaisiin yhden seuran kapasiteetilla
  // ja osuus voisi ylittaa 100 %.
  for (const p of kartta.values()) {
    let paras = p.paaseura;
    let parasMin = -1;
    for (const [seura, arvot] of p.seurat) {
      if (arvot.minuutit > parasMin) {
        parasMin = arvot.minuutit;
        paras = seura;
      }
    }
    p.paaseura = paras;
    p.minuutitPaaseurassa = p.seurat.get(paras)?.minuutit ?? 0;
    p.ottelutPaaseurassa = p.seurat.get(paras)?.ottelut ?? 0;
  }

  return kartta;
}

/** Joukkue -> kauden ottelut kaikissa vaiheissa. */
function joukkueidenOttelut(nimittajat: NimittajaDoc[]): Map<string, number> {
  const kartta = new Map<string, number>();
  for (const n of nimittajat) {
    kartta.set(n.joukkue, (kartta.get(n.joukkue) || 0) + n.ottelut);
  }
  return kartta;
}

/**
 * Osuus joukkueen kauden minuuteista. Rajataan valille 0–100:
 * siirtynyt pelaaja tai datavirhe ei saa tuottaa yli sadan prosentin.
 */
function osuusMinuuteista(
  minuutit: number,
  joukkueenOttelut: number | undefined,
): number | null {
  if (!joukkueenOttelut || joukkueenOttelut <= 0) return null;
  const osuus = (minuutit / (joukkueenOttelut * 90)) * 100;
  return Math.min(100, Math.max(0, osuus));
}

function osuusOtteluista(
  ottelut: number,
  joukkueenOttelut: number | undefined,
): number | null {
  if (!joukkueenOttelut || joukkueenOttelut <= 0) return null;
  const osuus = (ottelut / joukkueenOttelut) * 100;
  return Math.min(100, Math.max(0, osuus));
}

function tiheys(minuutit: number, ottelut: number): number | null {
  if (ottelut <= 0) return null;
  return minuutit / ottelut;
}

function mediaani(arvot: number[]): number | null {
  const lajiteltu = arvot.slice().sort((a, b) => a - b);
  if (lajiteltu.length === 0) return null;
  const keski = Math.floor(lajiteltu.length / 2);
  return lajiteltu.length % 2 === 1
    ? lajiteltu[keski]
    : (lajiteltu[keski - 1] + lajiteltu[keski]) / 2;
}

/**
 * Tihea sijoitus: tasatilanteessa sama sija molemmille, eika seuraavaa
 * sijaa hyppaytetä yli. Palauttaa myos tiedon siita, onko sija jaettu.
 */
function tiheaSijoitus(
  arvot: Array<{ slug: string; arvo: number }>,
  slug: string,
): { sija: number; jaettu: boolean } | null {
  const oma = arvot.find((a) => a.slug === slug);
  if (!oma) return null;
  const paremmat = new Set(
    arvot.filter((a) => a.arvo > oma.arvo).map((a) => a.arvo),
  );
  const samat = arvot.filter((a) => a.arvo === oma.arvo).length;
  return { sija: paremmat.size + 1, jaettu: samat > 1 };
}

/** Vertailu mediaaniin naytettavilla arvoilla: sama luku = "tasolla". */
function nuoli(
  arvo: number | null,
  med: number | null,
  pyorista: (x: number) => number,
): Nuoli | null {
  if (arvo === null || med === null) return null;
  const a = pyorista(arvo);
  const m = pyorista(med);
  if (a === m) return 'tasolla';
  return a > m ? 'yli' : 'alle';
}

const kokonaisluku = (x: number): number => Math.round(x);

export interface KontekstiSyote {
  kausi: number;
  sarja: string;
  slug: string;
  suoritukset: SuoritusDoc[];
  nimittajat: NimittajaDoc[];
  /** slug -> pelipaikka rekisterista. Puuttuva = tuntematon, ei kenttapelaaja. */
  pelipaikat: Map<string, string | null>;
}

/**
 * Pelaajan konteksti: faktat ja niista muodostetut lauseet.
 * Palauttaa null, jos pelaajalla ei ole kauden rivia lainkaan.
 */
export function laskeKonteksti(syote: KontekstiSyote): Konteksti | null {
  const { kausi, sarja, slug, suoritukset, nimittajat, pelipaikat } = syote;
  const koosteet = kokoaPelaajat(suoritukset);
  const oma = koosteet.get(slug);
  if (!oma) return null;

  const ottelutSeuroittain = joukkueidenOttelut(nimittajat);
  const joukkueenOttelut = ottelutSeuroittain.get(oma.paaseura) ?? null;
  const ohitetut: string[] = [];

  const osuus = osuusMinuuteista(
    oma.minuutitPaaseurassa,
    joukkueenOttelut ?? undefined,
  );
  const otteluOsuus = osuusOtteluista(
    oma.ottelutPaaseurassa,
    joukkueenOttelut ?? undefined,
  );
  const minPerOttelu = tiheys(oma.minuutit, oma.ottelut);

  if (joukkueenOttelut === null) {
    ohitetut.push(
      'Osuuslause: joukkueelle ' + oma.paaseura + ' ei ole nimittajariviä ' +
        'kaudella ' + kausi + ', joten ottelumaaraa ei tiedeta.',
    );
  }

  // --- Vertailujoukko: samanikaiset, joilla on peliaikaa ---------------
  // Mediaani lasketaan peliaikaa saaneista. Kaikkien mediaani on
  // useimmilla kierroksilla 0, ja vertailu siihen olisi hyodyton.
  const ikaryhma = Array.from(koosteet.values()).filter(
    (p) => p.ika === oma.ika && p.minuutit > 0,
  );
  const vertailujoukko =
    oma.ika > 0
      ? oma.ika + '-vuotiaat ' + sarjaInessiivi(sarja) + ' ' + kausi +
        ', ' + ikaryhma.length + ' peliaikaa saanutta'
      : null;

  const medOsuus = mediaani(
    ikaryhma
      .map((p) =>
        osuusMinuuteista(
          p.minuutitPaaseurassa,
          ottelutSeuroittain.get(p.paaseura),
        ),
      )
      .filter((x): x is number => x !== null),
  );
  const medTiheys = mediaani(
    ikaryhma
      .map((p) => tiheys(p.minuutit, p.ottelut))
      .filter((x): x is number => x !== null),
  );
  const medMinuutit = mediaani(ikaryhma.map((p) => p.minuutit));
  const medMaalit = mediaani(ikaryhma.map((p) => p.maalit));

  // --- Sijoitukset -----------------------------------------------------
  const omaPelipaikka = pelipaikat.get(slug) ?? null;
  const sijoituksetSallittu = oma.ottelut >= SIJOITUS_MIN_OTTELUT;
  if (!sijoituksetSallittu) {
    ohitetut.push(
      'Sijoituslauseet: alle ' + SIJOITUS_MIN_OTTELUT + ' ottelua (' +
        oma.ottelut + ').',
    );
  }

  const sijaMinuutit = sijoituksetSallittu
    ? tiheaSijoitus(
        ikaryhma.map((p) => ({ slug: p.slug, arvo: p.minuutit })),
        slug,
      )
    : null;
  if (sijoituksetSallittu && sijaMinuutit === null) {
    // Ei hiljaisuutta: pelaaja on kauden datassa mutta puuttuu omasta
    // vertailujoukostaan. Se on epajohdonmukaisuus, ei tavallinen tila.
    console.error(
      '[konteksti] pelaajaa ' + slug + ' ei loydy ikaryhmasta ' + oma.ika +
        ' (' + sarja + ' ' + kausi + ') — sijoituslause jatetaan pois.',
    );
    ohitetut.push('Sijoituslause (minuutit): pelaajaa ei loytynyt vertailujoukosta.');
  }

  // Maalivertailu epaonnistuu sulkeutuen: tuntematon pelipaikka EI
  // tarkoita kenttapelaajaa, eika maalivahtia verrata kenttapelaajien
  // maaleihin. Vertailujoukosta suljetaan pois tunnetut maalivahdit;
  // tuntemattomat jaavat joukkoon, jottei sija nayta todellista parempaa.
  let sijaMaalit: { sija: number; jaettu: boolean } | null = null;
  if (!sijoituksetSallittu) {
    // syy kirjattu jo yllä
  } else if (omaPelipaikka === null) {
    ohitetut.push(
      'Maalisijoituslause: pelipaikka ei ole tiedossa. Tuntematon ' +
        'pelipaikka ei tarkoita kenttapelaajaa.',
    );
  } else if (omaPelipaikka === MAALIVAHTI) {
    ohitetut.push(
      'Maalisijoituslause: pelaaja on maalivahti, eika maalivahtia verrata ' +
        'kenttapelaajien maaleihin.',
    );
  } else {
    const kenttapelaajat = ikaryhma.filter(
      (p) => (pelipaikat.get(p.slug) ?? null) !== MAALIVAHTI,
    );
    sijaMaalit = tiheaSijoitus(
      kenttapelaajat.map((p) => ({ slug: p.slug, arvo: p.maalit })),
      slug,
    );
    if (sijaMaalit === null) {
      console.error(
        '[konteksti] pelaajaa ' + slug + ' ei loydy maalivertailujoukosta (' +
          sarja + ' ' + kausi + ') — maalisijoituslause jatetaan pois.',
      );
      ohitetut.push('Maalisijoituslause: pelaajaa ei loytynyt vertailujoukosta.');
    }
  }

  // --- Lauseet ---------------------------------------------------------
  const rivit: Kontekstirivi[] = [];
  const seuranGenetiivi = genetiivi(oma.paaseura);
  if (seuranGenetiivi === null && osuus !== null) {
    ohitetut.push(
      'Osuuslause nimeaa joukkueen yleisesti: seuralle ' + oma.paaseura +
        ' ei ole genetiivia taivutuskartassa.',
    );
  }
  const seuraSanana = seuranGenetiivi ?? 'joukkueen';

  if (osuus !== null && kokonaisluku(osuus) >= OSUUS_VAKIOPAIKKA) {
    rivit.push({
      id: 'osuus',
      teksti:
        kokonaisluku(osuus) + ' % ' + seuraSanana +
        ' kauden minuuteista, aloittaa lähes aina',
      nuoli: nuoli(osuus, medOsuus, kokonaisluku),
      mittari: 'osuus joukkueen minuuteista',
      arvo: kokonaisluku(osuus),
      yksikko: '%',
      mediaani: medOsuus === null ? null : kokonaisluku(medOsuus),
      vertailujoukko,
    });
  } else if (osuus !== null && kokonaisluku(osuus) >= OSUUS_VAKIINTUMASSA) {
    rivit.push({
      id: 'osuus',
      teksti:
        kokonaisluku(osuus) + ' % ' + seuraSanana +
        ' minuuteista, vakiintumassa kokoonpanoon',
      nuoli: nuoli(osuus, medOsuus, kokonaisluku),
      mittari: 'osuus joukkueen minuuteista',
      arvo: kokonaisluku(osuus),
      yksikko: '%',
      mediaani: medOsuus === null ? null : kokonaisluku(medOsuus),
      vertailujoukko,
    });
  } else if (
    osuus !== null &&
    kokonaisluku(osuus) < OSUUS_HAKEE_PAIKKAANSA &&
    oma.ottelut >= OTTELUT_HAKEE_PAIKKAANSA
  ) {
    rivit.push({
      id: 'osuus',
      teksti: oma.ottelut + ' peliä, hakee vielä paikkaansa',
      nuoli: nuoli(osuus, medOsuus, kokonaisluku),
      mittari: 'ottelut',
      arvo: oma.ottelut,
      yksikko: 'ottelua',
      mediaani: medOsuus === null ? null : kokonaisluku(medOsuus),
      vertailujoukko,
    });
  } else if (osuus !== null) {
    ohitetut.push(
      'Osuuslause: osuus ' + kokonaisluku(osuus) + ' % ei osu yhteenkaan ' +
        'sapluunaan (' + oma.ottelut + ' ottelua).',
    );
  }

  const sijoitusrivi = (
    id: string,
    sija: { sija: number; jaettu: boolean },
    mittari: string,
    arvo: number,
    yksikko: string,
    med: number | null,
  ): Kontekstirivi | null => {
    if (sija.sija > SIJOITUS_MAX_SIJA) {
      ohitetut.push(
        'Sijoituslause (' + mittari + '): sija ' + sija.sija + ' ei ole ' +
          'karkikolmikossa.',
      );
      return null;
    }
    // Nollalla ei sijoituta. Tuotannon datassa tama tuotti lauseen
    // "jaettu 3. 18-vuotiaiden joukossa: maalit (0)" — tosi mutta tyhja:
    // se kertoo vain, etta ikaryhmassa on vahan maalintekijoita. Tyhja
    // tila on parempi kuin merkityksetön lause.
    if (arvo <= 0) {
      ohitetut.push(
        'Sijoituslause (' + mittari + '): arvo on 0, eika nollalla sijoituta.',
      );
      return null;
    }
    // Vertailujoukko kirjataan jokaiseen sijoituslauseeseen, myos
    // ykkössijaan: "karki" ilman joukkoa ei ole todistettavissa.
    const joukko = oma.ika + '-vuotiaiden';
    const missa = sarjaInessiivi(sarja);
    const teksti =
      sija.sija === 1 && !sija.jaettu
        ? joukko + ' kärki ' + missa + ': ' + mittari + ' (' + arvo + ')'
        : (sija.jaettu ? 'jaettu ' : '') + sija.sija + '. ' + joukko +
          ' joukossa ' + missa + ': ' + mittari + ' (' + arvo + ')';
    return {
      id,
      teksti,
      nuoli: nuoli(arvo, med, kokonaisluku),
      mittari,
      arvo,
      yksikko,
      mediaani: med === null ? null : kokonaisluku(med),
      vertailujoukko,
    };
  };

  if (sijaMaalit) {
    const rivi = sijoitusrivi(
      'sijoitus-maalit',
      sijaMaalit,
      'maalit',
      oma.maalit,
      'maalia',
      medMaalit,
    );
    if (rivi) rivit.push(rivi);
  }

  if (minPerOttelu !== null && kokonaisluku(minPerOttelu) >= TIHEYS_TAYDET_PELIT) {
    rivit.push({
      id: 'tiheys',
      teksti:
        kokonaisluku(minPerOttelu) + ' min/ottelu, pelaa lähes täydet pelit',
      nuoli: nuoli(minPerOttelu, medTiheys, kokonaisluku),
      mittari: 'minuutit per ottelu',
      arvo: kokonaisluku(minPerOttelu),
      yksikko: 'min/ottelu',
      mediaani: medTiheys === null ? null : kokonaisluku(medTiheys),
      vertailujoukko,
    });
  } else if (minPerOttelu !== null) {
    ohitetut.push(
      'Tiheyslause: ' + kokonaisluku(minPerOttelu) + ' min/ottelu jaa alle ' +
        TIHEYS_TAYDET_PELIT + ' minuutin rajan.',
    );
  } else {
    ohitetut.push('Tiheyslause: pelaajalla ei ole otteluita, joten tiheytta ei ole.');
  }

  if (sijaMinuutit) {
    const rivi = sijoitusrivi(
      'sijoitus-minuutit',
      sijaMinuutit,
      'minuutit',
      oma.minuutit,
      'minuuttia',
      medMinuutit,
    );
    if (rivi) rivit.push(rivi);
  }

  return {
    slug,
    kausi,
    sarja,
    etunimi: oma.etunimi,
    sukunimi: oma.sukunimi,
    ika: oma.ika,
    joukkue: oma.paaseura,
    seurat: Array.from(oma.seurat.keys()).sort(),
    pelipaikka: omaPelipaikka,
    faktat: {
      minuutit: oma.minuutit,
      ottelut: oma.ottelut,
      maalit: oma.maalit,
      aloitukset: oma.aloitukset,
      minuutitPaaseurassa: oma.minuutitPaaseurassa,
      ottelutPaaseurassa: oma.ottelutPaaseurassa,
      joukkueenOttelut,
      osuusMinuuteista: osuus === null ? null : kokonaisluku(osuus),
      osuusOtteluista: otteluOsuus === null ? null : kokonaisluku(otteluOsuus),
      tiheys: minPerOttelu === null ? null : kokonaisluku(minPerOttelu),
      sijaMinuutit: sijaMinuutit ? sijaMinuutit.sija : null,
      sijaMaalit: sijaMaalit ? sijaMaalit.sija : null,
      jaettuMinuutit: sijaMinuutit ? sijaMinuutit.jaettu : false,
      jaettuMaalit: sijaMaalit ? sijaMaalit.jaettu : false,
      vertailujoukonKoko: ikaryhma.length,
    },
    rivit,
    ohitetut,
  };
}
