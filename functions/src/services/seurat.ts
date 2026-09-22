// ============================================
// SEURAVERTAILU — sama luku joka paikassa
//
// Seurataulukko ja pienet kaaviot lukevat SAMAA laskentafunktiota
// (laskeSeurakausi). Jos kausinakyma ja kaavio laskisivat osuutensa eri
// koodilla, sivusto voisi nayttaa kahta eri lukua samasta seurasta ja
// samasta kaudesta, eika lukija tietaisi kumpi on oikea. Tama on sama
// periaate kuin trendikaaviossa ja kausinakymassa.
//
// OSUUS = nuorten minuutit / (joukkueen ottelut × 90 × 11)
//
// Nimittaja tulee nimittajat-kokoelmasta, ei pelaajarivien summasta:
// kapasiteetti on seuran ominaisuus, ei pelaajien summa. Osoittaja ja
// nimittaja lasketaan samasta ottelujoukosta — kaikki pelatut vaiheet —
// koska pelaajan minuutit sisaltavat myos jatkosarjan minuutit.
//
// PUUTTUVA KAUSI ON null, EI 0. Seura, joka ei ollut sarjassa jollain
// kaudella, ei saa nayttaa nollalta: nolla vaittaisi, ettei nuorille
// mennyt yhtaan minuuttia. Kaaviossa se on katko.
// ============================================
import type { NimittajaDoc, SuoritusDoc } from './kausiData';
import { joukkueTunniste } from './kausiData';
import { onAkatemia } from './akatemiat';

/** Liukuvan keskiarvon ikkuna kausina. */
export const LIUKUVA_IKKUNA = 3;

/**
 * Seuran tunniste on pysyva kausien yli, koska se johdetaan nimesta
 * samalla saannolla joka kaudella. Nimenmuutos tuottaisi uuden
 * tunnisteen ja katkaisisi seuran viivan kahtia — siksi nimenmuutokset
 * kirjataan TAHAN nimettyyn karttaan, ei paatella nimesta.
 *
 * Kartta on tyhja: kausien 2020–2026 aineistossa ei ole yhtaan
 * nimenmuutosta. tarkistaSeurat.ts valvoo taman ja huomauttaa, jos
 * sama tunniste saa kahden eri nimen tai nimi katoaa kesken kausien.
 */
export const SEURAN_ENTINEN_NIMI: Record<string, string> = {};

/** Vakaa tunniste, joka kestaa nimenmuutoksen jos se on kirjattu. */
export function seuraTunniste(nimi: string): string {
  const nykyinen = SEURAN_ENTINEN_NIMI[nimi.trim()] ?? nimi;
  return joukkueTunniste(nykyinen);
}

export interface Seurakausi {
  tunniste: string;
  nimi: string;
  kausi: number;
  sarja: string;
  akatemia: boolean;
  ottelut: number;
  kapasiteettiMin: number;
  nuortenMinuutit: number;
  /** Osuus prosentteina, yksi desimaali. null = kapasiteettia ei tiedeta. */
  osuus: number | null;
  pelaajia: number;
  /** Minuuteilla painotettu keski-ika, tai null jos minuutteja ei ole. */
  keskiIka: number | null;
}

function pyorista(x: number, desimaaleja: number): number {
  const k = Math.pow(10, desimaaleja);
  return Math.round(x * k) / k;
}

/**
 * Yhden kauden luvut seuroittain. TAMA on ainoa paikka, jossa seuran
 * osuus lasketaan — seuraava kayttaja on joko kausinakyma tai
 * trendikaavio, eivatka ne saa laskea sita uudestaan.
 */
export function laskeSeurakausi(
  kausi: number,
  sarja: string,
  suoritukset: SuoritusDoc[],
  nimittajat: NimittajaDoc[],
): Seurakausi[] {
  const kapasiteetti = new Map<string, number>();
  const ottelut = new Map<string, number>();

  for (const n of nimittajat) {
    kapasiteetti.set(
      n.joukkue,
      (kapasiteetti.get(n.joukkue) || 0) + n.kapasiteetti_min,
    );
    ottelut.set(n.joukkue, (ottelut.get(n.joukkue) || 0) + n.ottelut);
  }

  return Array.from(kapasiteetti.keys())
    .sort()
    .map((joukkue) => {
      const rivit = suoritukset.filter((s) => s.joukkue === joukkue);
      const kap = kapasiteetti.get(joukkue) || 0;
      const min = rivit.reduce((a, s) => a + s.minuutit, 0);
      const painotettu =
        min > 0
          ? pyorista(rivit.reduce((a, s) => a + s.ika * s.minuutit, 0) / min, 1)
          : null;

      return {
        tunniste: seuraTunniste(joukkue),
        nimi: joukkue,
        kausi,
        sarja,
        akatemia: onAkatemia(joukkue),
        ottelut: ottelut.get(joukkue) || 0,
        kapasiteettiMin: kap,
        nuortenMinuutit: min,
        osuus: kap > 0 ? pyorista((min / kap) * 100, 1) : null,
        pelaajia: new Set(rivit.map((s) => s.pelaajaAvain)).size,
        keskiIka: painotettu,
      };
    });
}

export interface Seuratrendi {
  tunniste: string;
  nimi: string;
  akatemia: boolean;
  /** Yksi piste per kausi, vanhin ensin. null = seura ei ollut sarjassa. */
  pisteet: Array<number | null>;
  /** Kolmen kauden liukuva keskiarvo, sama pituus. null = ei tarpeeksi kausia. */
  liukuva: Array<number | null>;
  /** Kaudet, joilta seuralla on luku — lajitteluun ja katkon selittamiseen. */
  kaudetMukana: number[];
}

/**
 * Kolmen kauden liukuva keskiarvo.
 *
 * Keskiarvo lasketaan vain, jos KAIKKI kolme kautta ovat olemassa.
 * Puuttuvan kauden yli ei interpoloida eika sita korvata nollalla:
 * kahden kauden keskiarvo naytettyna kolmen kauden viivana vaittaisi
 * enemman kuin data kertoo.
 */
export function laskeLiukuva(
  pisteet: Array<number | null>,
  ikkuna = LIUKUVA_IKKUNA,
): Array<number | null> {
  return pisteet.map((_, i) => {
    if (i + 1 < ikkuna) return null;
    const osa = pisteet.slice(i + 1 - ikkuna, i + 1);
    if (osa.some((x) => x === null)) return null;
    const summa = (osa as number[]).reduce((a, b) => a + b, 0);
    return pyorista(summa / ikkuna, 1);
  });
}

/** Seurakohtaiset aikasarjat kaudet-jarjestyksessa (vanhin ensin). */
export function laskeSeuratrendit(
  kaudet: number[],
  kausittain: Map<number, Seurakausi[]>,
): Seuratrendi[] {
  const seurat = new Map<string, { nimi: string; akatemia: boolean }>();
  for (const kausi of kaudet) {
    for (const s of kausittain.get(kausi) || []) {
      // Viimeisin kausi voittaa nimen: jos seura on nimetty uudelleen ja
      // muutos on kirjattu karttaan, naytetaan nykyinen nimi.
      seurat.set(s.tunniste, { nimi: s.nimi, akatemia: s.akatemia });
    }
  }

  return Array.from(seurat.entries())
    .map(([tunniste, meta]) => {
      const pisteet = kaudet.map((kausi) => {
        const rivi = (kausittain.get(kausi) || []).find(
          (s) => s.tunniste === tunniste,
        );
        return rivi ? rivi.osuus : null;
      });
      return {
        tunniste,
        nimi: meta.nimi,
        akatemia: meta.akatemia,
        pisteet,
        liukuva: laskeLiukuva(pisteet),
        kaudetMukana: kaudet.filter((_, i) => pisteet[i] !== null),
      };
    })
    .sort((a, b) => {
      // Jarjestys UUSIMMAN kauden luvun mukaan, ei viimeisen tunnetun.
      // Seura, joka ei ole enaa sarjassa, menee perälle eika sekoitu
      // nykyisten joukkoon vanhalla luvullaan — mutta se ei myoskaan
      // katoa, koska sen historia on yha vertailukelpoista.
      const va = a.pisteet[a.pisteet.length - 1] ?? null;
      const vb = b.pisteet[b.pisteet.length - 1] ?? null;
      if (va === null && vb === null) return a.nimi.localeCompare(b.nimi, 'fi');
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va || a.nimi.localeCompare(b.nimi, 'fi');
    });
}

export interface Vertailuviiva {
  kausi: number;
  /** Koko sarjan osuus. */
  kaikki: number | null;
  /**
   * Sama ilman akatemiajoukkueita, tai null jos sarjassa ei OLE
   * akatemiajoukkueita kyseisella kaudella. null tarkoittaa "ei toista
   * viivaa", ei "ei dataa": kaksi identtista lukua vierekkain vaittaisi
   * vertailua, jota ei ole tehty.
   */
  ilmanAkatemioita: number | null;
}

/**
 * Sarjan vertailuviivat: kaikki joukkueet ja ilman akatemioita.
 *
 * Kaksi viivaa on Ykkosliigassa valttamatonta: HJK Klubi 04:n ja SJK
 * Akatemian peliajasta valtaosa menee nuorille, joten yksi keskiarvo
 * nostaisi sarjan tason sellaiseksi, joka ei kerro muiden seurojen
 * kaytannosta.
 *
 * TOINEN VIIVA SYNTYY VAIN, JOS AKATEMIOITA ON. Se paatellaan datasta
 * onAkatemia-funktiolla, EI sarjan nimesta: sarjan nimi ei kerro, mitka
 * joukkueet siina pelaavat, ja akatemia voi nousta tai pudota. Ilman
 * tata Veikkausliiga nayttaisi kaksi identtista lukua vierekkain, mika
 * vaittaisi vertailua jota ei ole tehty.
 */
export function laskeVertailuviivat(
  kaudet: number[],
  kausittain: Map<number, Seurakausi[]>,
): Vertailuviiva[] {
  return kaudet.map((kausi) => {
    const rivit = kausittain.get(kausi) || [];
    const osuus = (joukko: Seurakausi[]): number | null => {
      const kap = joukko.reduce((a, s) => a + s.kapasiteettiMin, 0);
      const min = joukko.reduce((a, s) => a + s.nuortenMinuutit, 0);
      return kap > 0 ? pyorista((min / kap) * 100, 1) : null;
    };
    const akatemioita = rivit.filter((s) => s.akatemia).length;
    return {
      kausi,
      kaikki: osuus(rivit),
      ilmanAkatemioita:
        akatemioita > 0 ? osuus(rivit.filter((s) => !s.akatemia)) : null,
    };
  });
}

/**
 * Kaavioiden yhteinen ylaraja.
 *
 * Sama saanto seka /seurat-sivun pienille kaavioille etta seuran omalle
 * sivulle: ylaraja lasketaan datasta ja pyoristetaan ylospain kymmeneen.
 * Jos seuran oma sivu skaalautuisi omaan maksimiinsa, 5 %:n seura
 * nayttaisi sielta katsottuna samalta kuin 50 %:n seura /seurat-sivulla,
 * ja lukija vertaisi kahta eri mittakaavaa huomaamattaan.
 *
 * Vahintaan 10, jottei matala kausi venyta viivoja kattoon.
 */
export function laskeYlaraja(arvot: Array<number | null>): number {
  const luvut = arvot.filter((x): x is number => x !== null);
  return Math.ceil(Math.max(10, ...luvut) / 10) * 10;
}

/** Yksi kausi seuran omalla sivulla. */
export interface SeuranKausipiste {
  kausi: number;
  /** Sarja, jossa seura pelasi. null = ei kummassakaan sarjassa. */
  sarja: string | null;
  /** Raaka osuus joukkueen otteluiden minuuteista. */
  osuus: number | null;
  /**
   * Sarjan taso samana kautena ja samassa sarjassa — sama luku, joka
   * nakyy /seurat-sivun vertailuviivassa. Ykkosliigassa kaytetaan
   * tasoa KAIKKINE joukkueineen, ei akatemioista puhdistettua: seuraa
   * verrataan siihen sarjaan, jossa se tosiasiassa pelasi.
   */
  sarjanTaso: number | null;
  /**
   * Seuran osuus jaettuna sarjan tasolla. 1,0 = sarjan taso.
   *
   * Tama on ainoa luku, joka on vertailukelpoinen sarjojen yli: raaka
   * osuus nousee usein sarjasta pudotessa ilman etta seuran linja on
   * muuttunut, koska sarjojen taso eroaa toisistaan.
   */
  suhdeluku: number | null;
}

export interface SeuranAikasarja {
  kaudet: number[];
  pisteet: SeuranKausipiste[];
  /**
   * Kolmen kauden liukuva keskiarvo SUHDELUVUSTA, ei raa'asta
   * osuudesta. Raa'alle osuudelle liukuvaa ei lasketa lainkaan: se
   * sekoittaisi kaksi eri sarjatasoa samaan keskiarvoon.
   */
  liukuva: Array<number | null>;
  /** true = seura on pelannut useammassa kuin yhdessa sarjassa. */
  useitaSarjoja: boolean;
}

/**
 * Seuran aikasarja YLI SARJOJEN.
 *
 * Sarjojen lukuja EI lasketa yhteen: jokainen kausi kuuluu yhteen
 * sarjaan, ja sivu kertoo kauden kohdalla, missa sarjassa seura pelasi.
 * Osuus on molemmissa sarjoissa sama asia — osuus oman joukkueen
 * otteluiden minuuteista — joten viiva on jatkuva, mutta sarjan vaihdos
 * on merkittava nakyviin, jottei lukija lue nousua sarjatason
 * muutoksesta johtuvaksi.
 *
 * Jos seura loytyy samalta kaudelta kahdesta sarjasta (ei pitaisi olla
 * mahdollista), valitaan enemman otteluita pelannut ja tilanne
 * raportoidaan kutsujalle epavarmana — ei summata.
 */
export function laskeSeuranAikasarja(
  tunniste: string,
  kaudet: number[],
  kausittainSarjoittain: Map<string, Map<number, Seurakausi[]>>,
): SeuranAikasarja & { paallekkaisetKaudet: number[] } {
  const paallekkaiset: number[] = [];
  const sarjatMukana = new Set<string>();

  // Sarjan taso kaudittain, sarjoittain. Sama laskenta kuin
  // /seurat-sivun vertailuviivassa, jotta suhdeluku nojaa samaan
  // lukuun jonka lukija nakee sielta.
  const tasot = new Map<string, Map<number, number | null>>();
  for (const [sarja, kausittain] of kausittainSarjoittain) {
    const omatKaudet = Array.from(kausittain.keys()).sort((a, b) => a - b);
    const viivat = laskeVertailuviivat(omatKaudet, kausittain);
    tasot.set(sarja, new Map(viivat.map((v) => [v.kausi, v.kaikki])));
  }

  const pisteet: SeuranKausipiste[] = kaudet.map((kausi) => {
    const osumat: Seurakausi[] = [];
    for (const kausittain of kausittainSarjoittain.values()) {
      const rivi = (kausittain.get(kausi) || []).find(
        (s) => s.tunniste === tunniste,
      );
      if (rivi) osumat.push(rivi);
    }
    if (osumat.length === 0) {
      return { kausi, sarja: null, osuus: null, sarjanTaso: null, suhdeluku: null };
    }
    if (osumat.length > 1) paallekkaiset.push(kausi);
    const valittu = osumat.slice().sort((a, b) => b.ottelut - a.ottelut)[0];
    sarjatMukana.add(valittu.sarja);

    const taso = tasot.get(valittu.sarja)?.get(kausi) ?? null;
    const suhdeluku =
      valittu.osuus === null || taso === null || taso <= 0
        ? null
        : pyorista(valittu.osuus / taso, 1);

    return {
      kausi,
      sarja: valittu.sarja,
      osuus: valittu.osuus,
      sarjanTaso: taso,
      suhdeluku,
    };
  });

  return {
    kaudet,
    pisteet,
    // Liukuva SUHDELUVUSTA. Katko katkaisee sen (laskeLiukuva vaatii
    // kaikki kolme), mutta sarjan vaihdos EI: suhdeluku on
    // vertailukelpoinen sarjojen yli, ja juuri siksi seuran linjan
    // seuraaminen onnistuu vaikka sarja vaihtuu.
    liukuva: laskeLiukuva(pisteet.map((p) => p.suhdeluku)),
    useitaSarjoja: sarjatMukana.size > 1,
    paallekkaisetKaudet: paallekkaiset,
  };
}

/**
 * Suhdeluvun akselin ylaraja seuran omista luvuista.
 *
 * Pyoristetaan ylospain puolikkaaseen, ja vahintaan 1,5 jotta sarjan
 * tason viiva (1,0) on aina nakyvissa eika osu kattoon.
 */
export function laskeSuhdeYlaraja(arvot: Array<number | null>): number {
  const luvut = arvot.filter((x): x is number => x !== null);
  return Math.max(1.5, Math.ceil(Math.max(0, ...luvut) * 2) / 2);
}

/**
 * Seuran oman sivun y-akselin ylaraja.
 *
 * Mukaan otetaan vain ne sarjat, joissa seura on pelannut. Jos
 * laskettaisiin aina molemmista, Veikkausliigan seuran sivu
 * skaalautuisi Ykkosliigan akatemioiden mukaan siina missa /seurat
 * nayttaa saman seuran kapeammalla akselilla — ja sama viiva nayttaisi
 * kahdella sivulla eri korkuiselta. Sarjaa vaihtanut seura tarvitsee
 * molempien akselin, ja saa sen.
 */
export function laskeSeuranYlaraja(
  omatSarjat: Set<string>,
  kausittainSarjoittain: Map<string, Map<number, Seurakausi[]>>,
): number {
  const osuudet: Array<number | null> = [];
  for (const [sarja, kausittain] of kausittainSarjoittain) {
    if (omatSarjat.size > 0 && !omatSarjat.has(sarja)) continue;
    for (const rivit of kausittain.values()) {
      for (const r of rivit) osuudet.push(r.osuus);
    }
  }
  return laskeYlaraja(osuudet);
}
