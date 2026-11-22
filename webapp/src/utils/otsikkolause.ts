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
// ============================================
import type { TrendiKausi } from '@/services/api';

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
): Otsikkolause | null {
  if (!trendit) return null;
  const pisteet = trendit
    .filter((t) => t.sarja === sarja && t.osuus1721 !== null)
    .sort((a, b) => a.kausi - b.kausi);
  const nyt = pisteet.find((t) => t.kausi === kausi);
  if (!nyt || nyt.osuus1721 === null) return null;

  const aiemmat = pisteet.filter((t) => t.kausi < kausi) as Array<
    TrendiKausi & { osuus1721: number }
  >;
  const edellinenPiste = aiemmat.length > 0 ? aiemmat[aiemmat.length - 1] : null;

  let jatko: string | null = null;
  if (aiemmat.length >= ENNATYS_MIN_KAUSIA) {
    const arvot = aiemmat.map((t) => t.osuus1721);
    const alku = aiemmat[0].kausi;
    if (nyt.osuus1721 > Math.max(...arvot)) {
      jatko = 'enemmän kuin kertaakaan vuodesta ' + alku;
    } else if (nyt.osuus1721 < Math.min(...arvot)) {
      jatko = 'vähemmän kuin kertaakaan vuodesta ' + alku;
    }
  }

  return {
    osuus: nyt.osuus1721,
    jatko,
    edellinen: edellinenPiste
      ? { kausi: edellinenPiste.kausi, osuus: edellinenPiste.osuus1721 }
      : null,
    kesken: nyt.kesken,
  };
}
