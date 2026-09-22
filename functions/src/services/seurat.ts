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
