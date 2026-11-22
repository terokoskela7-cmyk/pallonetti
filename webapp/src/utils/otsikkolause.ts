// ============================================
// ETUSIVUN OTSIKKOLAUSE
//
// Etusivun pääotsikko muodostetaan kausitrendistä: valitun kauden
// 17–21-vuotiaiden osuus ja sen asema sarjan omassa historiassa.
//
// Ennätysväite ("enemmän kuin kertaakaan vuodesta 2020") tehdään vain
// kun se pitää: verrataan valittua kautta EDELTÄVIIN kausiin, ja niitä
// on oltava vähintään kaksi. Muuten otsikko on pelkkä luku — väärä
// ennätys on pahempi kuin ei ennätystä.
//
// MITTARI: 'suomi' = Suomen kansalaisten 17–21-vuotiaiden osuus
// (jako1721.fin), 'kaikki' = kaikki 17–21-vuotiaat. Suomi-mittarissa
// ennätysvertailu tehdään vain kausiin, joilta kansalaisuustieto on.
//
// 'koulutettu' = Suomessa koulutettujen (UEFA association-trained)
// 17–21-vuotiaiden osuus, PÄÄMITTARI. Sillä ei tehdä ennätysväitettä:
// koulutushistoria alkaa 2020, joten varhaisempien kausien pelaajilta
// puuttuu nuoruusvuosia ja niiden luku on vertailussa alakanttiin.
// ============================================
import type { TrendiKausi } from '@/services/api';

export type Mittari = 'kaikki' | 'suomi' | 'koulutettu';

/** Kauden arvo valitulla mittarilla, tai null jos sitä ei ole. */
export function mittarinArvo(t: TrendiKausi, mittari: Mittari): number | null {
  if (mittari === 'suomi') return t.jako1721 ? t.jako1721.fin : null;
  if (mittari === 'koulutettu') return t.koulutettu1721 ?? null;
  return t.osuus1721;
}

/** Edeltäviä kausia vähintään, jotta ennätysväite tehdään. */
const ENNATYS_MIN_KAUSIA = 2;

export interface Otsikkolause {
  /** Valitun kauden osuus, %. */
  osuus: number;
  /** Jatko pääluvun perään, esim. "enemmän kuin kertaakaan vuodesta 2020". */
  jatko: string | null;
  /** Edellinen kausi samasta sarjasta, jos se on datassa. */
  edellinen: { kausi: number; osuus: number } | null;
  /** Kausi on kesken: ennätys voi vielä muuttua. */
  kesken: boolean;
}

export function muodostaOtsikkolause(
  trendit: TrendiKausi[] | null,
  sarja: string,
  kausi: number,
  mittari: Mittari = 'kaikki',
): Otsikkolause | null {
  if (!trendit) return null;
  const pisteet = trendit
    .filter((t) => t.sarja === sarja && mittarinArvo(t, mittari) !== null)
    .map((t) => ({ kausi: t.kausi, kesken: t.kesken, arvo: mittarinArvo(t, mittari) as number }))
    .sort((a, b) => a.kausi - b.kausi);
  const nyt = pisteet.find((t) => t.kausi === kausi);
  if (!nyt) return null;

  const aiemmat = pisteet.filter((t) => t.kausi < kausi);
  const edellinenPiste = aiemmat.length > 0 ? aiemmat[aiemmat.length - 1] : null;

  let jatko: string | null = null;
  if (mittari !== 'koulutettu' && aiemmat.length >= ENNATYS_MIN_KAUSIA) {
    const arvot = aiemmat.map((t) => t.arvo);
    const alku = aiemmat[0].kausi;
    if (nyt.arvo > Math.max(...arvot)) {
      jatko = 'enemmän kuin kertaakaan vuodesta ' + alku;
    } else if (nyt.arvo < Math.min(...arvot)) {
      jatko = 'vähemmän kuin kertaakaan vuodesta ' + alku;
    }
  }

  return {
    osuus: nyt.arvo,
    jatko,
    edellinen: edellinenPiste ? { kausi: edellinenPiste.kausi, osuus: edellinenPiste.arvo } : null,
    kesken: nyt.kesken,
  };
}
