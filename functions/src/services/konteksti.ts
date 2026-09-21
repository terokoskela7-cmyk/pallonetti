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
// LAUSE KERTOO, EI TULKITSE. Sapluunoissa ei ole arvioita pelaajan
// asemasta ("aloittaa lahes aina", "hakee viela paikkaansa"): jokaisen
// lauseen on oltava todistettavissa vaaraksi yhdella kyselylla.
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
/** Taman osuuden ylittava peliaika mainitaan sellaisenaan. */
const OSUUS_MAINITAAN = 30; // %
/** Pienempi osuus mainitaan vain, jos otteluita on kertynyt tama verran. */
const OTTELUT_VAHINTAAN = 5;
const TIHEYS_MAINITAAN = 80; // min/ottelu
/** Alle taman ottelumaaran pelanneista ei tuoteta sijoituslauseita. */
const SIJOITUS_MIN_OTTELUT = 3;
/** Sijoituslause tuotetaan vain karkikolmikosta. */
const SIJOITUS_MAX_SIJA = 3;

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
  /**
   * Ikaryhman mediaanipoikkeama (MAD) samalle mittarille. Tekee eri
   * mittareiden poikkeamista vertailukelpoisia. null tai 0 = poikkeamaa
   * ei voi laskea.
   */
  hajonta: number | null;
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
    aloituksetPaaseurassa: number;
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
  seurat: Map<string, { minuutit: number; ottelut: number; aloitukset: number }>;
  paaseura: string;
  minuutitPaaseurassa: number;
  ottelutPaaseurassa: number;
  aloituksetPaaseurassa: number;
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
        aloituksetPaaseurassa: 0,
      };
      kartta.set(s.slug, p);
    }
    p.minuutit += s.minuutit;
    p.ottelut += s.ottelut;
    p.maalit += s.maalit;
    p.aloitukset += s.aloitukset;
    if (!p.ika && s.ika) p.ika = s.ika;
    const seura =
      p.seurat.get(s.joukkue) || { minuutit: 0, ottelut: 0, aloitukset: 0 };
    seura.minuutit += s.minuutit;
    seura.ottelut += s.ottelut;
    seura.aloitukset += s.aloitukset;
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
    p.aloituksetPaaseurassa = p.seurat.get(paras)?.aloitukset ?? 0;
  }

  return kartta;
}

/**
 * Joukkue -> kauden ottelut KAIKISSA vaiheissa.
 *
 * Osoittaja ja nimittaja lasketaan samasta ottelujoukosta. Pelaajan
 * minuutit sisaltavat myos jatkosarjan minuutit, joten nimittajan on
 * sisallettava jatkosarjan ottelut. Jos nimittajaksi otettaisiin pelkka
 * runkosarja (22 ottelua joka kaudella), jatkosarjassa pelanneen osuus
 * kasvaisi keinotekoisesti — kaudella 2026 KuPS oli pelannut 24 ja
 * AC Oulu 25 ottelua, jolloin ero olisi jo kolme ottelua eri suuntiin
 * eri seuroilla. Kesken kauden luku kertoo siis "tahan mennessa
 * pelatuista otteluista", ei ennustetta koko kaudesta.
 */
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
 * Mediaanipoikkeama (MAD): mediaani etaisyyksista mediaaniin.
 *
 * Tarvitaan, jotta eri mittareiden poikkeamia voi verrata keskenaan:
 * "kolme maalia yli mediaanin" ja "400 minuuttia yli mediaanin" eivat
 * ole vertailukelpoisia lukuina, mutta ovat sen jalkeen kun molemmat
 * suhteutetaan oman mittarinsa hajontaan. Keskihajonnan sijaan MAD,
 * koska yksi poikkeava pelaaja ei saa maarata koko mittakaavaa.
 *
 * Nolla on mahdollinen (esim. kun yli puolet ikaryhmasta on tehnyt
 * saman maaran maaleja). Silloin poikkeamaa ei lasketa lainkaan, ei
 * jaeta nollalla.
 */
function hajonta(arvot: number[]): number | null {
  const med = mediaani(arvot);
  if (med === null) return null;
  return mediaani(arvot.map((x) => Math.abs(x - med)));
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
  /**
   * slug -> pelipaikka rekisterista. Tieto kulkee vastaukseen, mutta se
   * ei ohjaa yhtakaan lausetta. Puuttuva arvo on null, ei arvaus.
   */
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

  const osuudet = ikaryhma
    .map((p) =>
      osuusMinuuteista(
        p.minuutitPaaseurassa,
        ottelutSeuroittain.get(p.paaseura),
      ),
    )
    .filter((x): x is number => x !== null);
  const tiheydet = ikaryhma
    .map((p) => tiheys(p.minuutit, p.ottelut))
    .filter((x): x is number => x !== null);
  const minuutit = ikaryhma.map((p) => p.minuutit);
  const maalit = ikaryhma.map((p) => p.maalit);
  const aloitukset = ikaryhma.map((p) => p.aloituksetPaaseurassa);

  const medOsuus = mediaani(osuudet);
  const medTiheys = mediaani(tiheydet);
  const medMinuutit = mediaani(minuutit);
  const medMaalit = mediaani(maalit);
  const medAloitukset = mediaani(aloitukset);

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

  // Maalisijoitus ei riipu pelipaikasta. Vertailujoukko on koko ikaryhma,
  // maalivahdit mukaan luettuina: he ovat nollassa eivatka voi siirtaa
  // ketaan karkikolmikosta. Ehto on maalit >= 1 — nollalla ei sijoituta,
  // joten maalivahti ei voi itse saada maalisijoituslausetta ilman maalia.
  //
  // Pelipaikka luetaan edelleen vastaukseen tietona, mutta se ei ohjaa
  // yhtakaan lausetta: pelipaikkoja on kerätty vain Veikkausliigalle, ja
  // ehtona se olisi vaientanut Ykkosliigan maalintekijat kokonaan.
  let sijaMaalit: { sija: number; jaettu: boolean } | null = null;
  if (sijoituksetSallittu) {
    sijaMaalit = tiheaSijoitus(
      ikaryhma.map((p) => ({ slug: p.slug, arvo: p.maalit })),
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

  // Lause kertoo mitattavan asian eika tulkitse sita. "Aloittaa lahes
  // aina" ja "hakee viela paikkaansa" olivat arvioita pelaajan asemasta,
  // eivat havaintoja aineistosta: niita ei voi todistaa vaaraksi yhdella
  // kyselylla. Osuus, ottelut ja minuutit per ottelu voi.
  const osuusLause = (o: number): string =>
    kokonaisluku(o) + ' % ' + seuraSanana + ' otteluiden minuuteista';

  if (osuus !== null && kokonaisluku(osuus) >= OSUUS_MAINITAAN) {
    rivit.push({
      id: 'osuus',
      teksti: osuusLause(osuus),
      nuoli: nuoli(osuus, medOsuus, kokonaisluku),
      mittari: 'osuus joukkueen minuuteista',
      arvo: kokonaisluku(osuus),
      yksikko: '%',
      mediaani: medOsuus === null ? null : kokonaisluku(medOsuus),
      hajonta: hajonta(osuudet),
      vertailujoukko,
    });
  } else if (osuus !== null && oma.ottelut >= OTTELUT_VAHINTAAN) {
    // Pieni osuus kerrotaan vasta kun otteluita on kertynyt: yhden
    // ottelun 2 % ei kerro pelaajasta, viidentoista ottelun 12 % kertoo.
    rivit.push({
      id: 'osuus',
      teksti: oma.ottelut + ' ottelua, ' + osuusLause(osuus),
      nuoli: nuoli(osuus, medOsuus, kokonaisluku),
      mittari: 'osuus joukkueen minuuteista',
      arvo: kokonaisluku(osuus),
      yksikko: '%',
      mediaani: medOsuus === null ? null : kokonaisluku(medOsuus),
      hajonta: hajonta(osuudet),
      vertailujoukko,
    });
  } else if (osuus !== null) {
    ohitetut.push(
      'Osuuslause: osuus ' + kokonaisluku(osuus) + ' % alle ' +
        OSUUS_MAINITAAN + ' %:n rajan ja otteluita vain ' + oma.ottelut + '.',
    );
  }

  // Rivien jarjestys: ensin peliaika (paljonko, miten usein aloittaen,
  // kuinka pitkia pelikertoja), sitten sijoitukset ikaryhmassa.
  // Kayttoliittyma voi nayttaa naista vain osan, joten tarkein on ensin.
  const sijoitusrivi = (
    id: string,
    sija: { sija: number; jaettu: boolean },
    mittari: string,
    arvo: number,
    yksikko: string,
    med: number | null,
    haj: number | null,
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
      hajonta: haj,
      vertailujoukko,
    };
  };

  // Aloitukset ovat kauden viennissa omana sarakkeenaan jokaisella
  // rivilla (tarkistettu kaikilta kausilta molemmista sarjoista), joten
  // luku tulee lahteesta. Sita EI paatella minuuteista: 90 minuuttia voi
  // olla myos taysi vaihtomies-ottelu jatkoajalla, eika 60 minuuttia
  // kerro kumpaan suuntaan vaihto tehtiin.
  //
  // Osoittaja on aloitukset paaseurassa, koska nimittaja on saman seuran
  // ottelut.
  if (joukkueenOttelut !== null && oma.aloituksetPaaseurassa > 0) {
    rivit.push({
      id: 'aloitukset',
      teksti:
        'aloittanut ' + oma.aloituksetPaaseurassa + '/' + joukkueenOttelut +
        ' ottelua',
      nuoli: nuoli(oma.aloituksetPaaseurassa, medAloitukset, kokonaisluku),
      mittari: 'aloitukset',
      arvo: oma.aloituksetPaaseurassa,
      yksikko: 'ottelua',
      mediaani: medAloitukset === null ? null : kokonaisluku(medAloitukset),
      hajonta: hajonta(aloitukset),
      vertailujoukko,
    });
  } else if (joukkueenOttelut !== null) {
    ohitetut.push('Aloituslause: pelaaja ei ole aloittanut yhtaan ottelua.');
  }

  if (minPerOttelu !== null && kokonaisluku(minPerOttelu) >= TIHEYS_MAINITAAN) {
    rivit.push({
      id: 'tiheys',
      teksti: kokonaisluku(minPerOttelu) + ' min/ottelu',
      nuoli: nuoli(minPerOttelu, medTiheys, kokonaisluku),
      mittari: 'minuutit per ottelu',
      arvo: kokonaisluku(minPerOttelu),
      yksikko: 'min/ottelu',
      mediaani: medTiheys === null ? null : kokonaisluku(medTiheys),
      hajonta: hajonta(tiheydet),
      vertailujoukko,
    });
  } else if (minPerOttelu !== null) {
    ohitetut.push(
      'Tiheyslause: ' + kokonaisluku(minPerOttelu) + ' min/ottelu jaa alle ' +
        TIHEYS_MAINITAAN + ' minuutin rajan.',
    );
  } else {
    ohitetut.push('Tiheyslause: pelaajalla ei ole otteluita, joten tiheytta ei ole.');
  }

  if (sijaMaalit) {
    const rivi = sijoitusrivi(
      'sijoitus-maalit',
      sijaMaalit,
      'maalit',
      oma.maalit,
      'maalia',
      medMaalit,
      hajonta(maalit),
    );
    if (rivi) rivit.push(rivi);
  }

  if (sijaMinuutit) {
    const rivi = sijoitusrivi(
      'sijoitus-minuutit',
      sijaMinuutit,
      'minuutit',
      oma.minuutit,
      'minuuttia',
      medMinuutit,
      hajonta(minuutit),
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
      aloituksetPaaseurassa: oma.aloituksetPaaseurassa,
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

// ============================================
// KAUDEN KAIKKI KONTEKSTIT JA ETUSIVUN NOSTO
// ============================================

/**
 * Pienin vertailujoukko, josta nosto voidaan valita. Kahden tai kolmen
 * pelaajan ikaryhmassa mediaani ja hajonta eivat kerro juuri mitaan, ja
 * yksittainen pelaaja nayttaisi poikkeavan rajusti pelkastaan siksi,
 * etta vertailujoukko on pieni.
 */
const NOSTO_MIN_VERTAILUJOUKKO = 5;

export interface Nosto {
  slug: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  joukkue: string;
  /** Rivi, joka poikkeaa eniten ikaryhmansa mediaanista. */
  rivi: Kontekstirivi;
  /** Poikkeama mediaanista oman mittarin hajonnalla (MAD) jaettuna. */
  poikkeama: number;
}

/** Kauden kaikki kontekstit, pelaaja kerrallaan samasta aineistosta. */
export function laskeKaudenKontekstit(
  syote: Omit<KontekstiSyote, 'slug'>,
): Konteksti[] {
  const slugit = Array.from(new Set(syote.suoritukset.map((s) => s.slug)));
  const tulos: Konteksti[] = [];
  for (const slug of slugit) {
    const k = laskeKonteksti({ ...syote, slug });
    if (k) tulos.push(k);
  }
  return tulos;
}

/**
 * Etusivun nosto: suurin poikkeama ikaryhman mediaanista.
 *
 * Valinta tehdaan datasta eika kasin, ja se vaihtuu kun data paivittyy.
 * Poikkeama suhteutetaan oman mittarin hajontaan, jotta maalit,
 * minuutit ja prosentit ovat vertailukelpoisia keskenaan.
 *
 * HUOM: brief maarittelee ikkunaksi "viimeiset viisi kierrosta".
 * Kierroskohtaista dataa ei viela ole (B3), joten ikkuna on toistaiseksi
 * koko kausi. Kun kierrosdata on olemassa, sama funktio saa
 * suodatetun aineiston eika logiikka muutu.
 *
 * Tasatilanteessa valinta on vakaa: suurempi poikkeama, sitten suurempi
 * arvo, sitten slug aakkosissa — muuten sama data voisi tuottaa eri
 * lauseen eri pyynnolla.
 */
export function valitseNostot(
  kontekstit: Konteksti[],
  maara = 3,
): Nosto[] {
  const ehdokkaat: Nosto[] = [];

  for (const k of kontekstit) {
    if (k.faktat.vertailujoukonKoko < NOSTO_MIN_VERTAILUJOUKKO) continue;
    // Yksi ehdokas per pelaaja: han poikkeaa sielta, missa poikkeaa
    // eniten. Muuten sama pelaaja tayttaisi koko valokeilan.
    let omaParas: Nosto | null = null;
    for (const rivi of k.rivit) {
      if (rivi.mediaani === null) continue;
      if (rivi.hajonta === null || rivi.hajonta <= 0) continue;
      const poikkeama = (rivi.arvo - rivi.mediaani) / rivi.hajonta;
      if (poikkeama <= 0) continue;
      const ehdokas: Nosto = {
        slug: k.slug,
        etunimi: k.etunimi,
        sukunimi: k.sukunimi,
        ika: k.ika,
        joukkue: k.joukkue,
        rivi,
        poikkeama: Math.round(poikkeama * 100) / 100,
      };
      if (omaParas === null || parempi(ehdokas, omaParas)) omaParas = ehdokas;
    }
    if (omaParas) ehdokkaat.push(omaParas);
  }

  return ehdokkaat
    .sort((a, b) => (parempi(a, b) ? -1 : parempi(b, a) ? 1 : 0))
    .slice(0, maara);
}

/** Yksi nosto: valokeilan ensimmainen. */
export function valitseNosto(kontekstit: Konteksti[]): Nosto | null {
  return valitseNostot(kontekstit, 1)[0] ?? null;
}

/**
 * Vakaa paremmuusjarjestys: suurempi poikkeama, sitten suurempi arvo,
 * sitten slug aakkosissa. Ilman viimeista ehtoa sama data voisi tuottaa
 * eri lauseen eri pyynnolla.
 */
function parempi(a: Nosto, b: Nosto): boolean {
  if (a.poikkeama !== b.poikkeama) return a.poikkeama > b.poikkeama;
  if (a.rivi.arvo !== b.rivi.arvo) return a.rivi.arvo > b.rivi.arvo;
  return a.slug < b.slug;
}

/**
 * Montako ottelua joukkueet ovat pelanneet. Kierrosnumeroa ei ole
 * kausiviennissa, joten tilanne kerrotaan otteluina — se on sama tieto
 * ilman keksittya kierroslukua. Vaihe voi olla kesken, joten min ja max
 * voivat erota.
 */
export function otteluitaPelattu(
  nimittajat: NimittajaDoc[],
): { min: number; max: number } | null {
  const ottelut = Array.from(joukkueidenOttelut(nimittajat).values());
  if (ottelut.length === 0) return null;
  return {
    min: Math.min.apply(null, ottelut),
    max: Math.max.apply(null, ottelut),
  };
}
