// ============================================
// PELAAJAN POLKU — kaudet ja sarjat, joissa sama pelaaja esiintyy
//
// Projektion avain on nimestä tehty slug, eikä datassa ole syntymäaikaa.
// Sama slug voi siis olla kaksi eri pelaajaa (kaimat eri sarjoissa).
// Siksi rivi hyväksytään polkuun vain, jos ikä sopii yhteen: kausi − ikä
// (≈ syntymävuosi) saa poiketa viiterivistä enintään yhdellä, koska ikä on
// laskettu kauden aikana eikä syntymäpäivää tunneta.
// ============================================

export interface PolkuKausi {
  kausi: number;
  sarja: string;
  joukkue: string;
  joukkueet: string[];
  ika: number;
  minTotal: number;
  ottelutTotal: number;
  aloituksetTotal: number;
  /** null = projektio tuotu ennen kentän lisäämistä. */
  kokoonpanossaTotal: number | null;
  maaliTotal: number;
}

/** Sallittu ero syntymävuosiarviossa (kausi − ikä). */
export const SYNTYMAVUODEN_TOLERANSSI = 1;

/**
 * Suodattaa ehdokkaista viiterivin kanssa yhteensopivat ja järjestää ne
 * uusin kausi ensin (saman kauden sisällä sarjan nimen mukaan).
 * Jos viiterivin ikää ei tiedetä (0), ikävertailua ei voi tehdä, ja
 * palautetaan vain viiterivi itse — mieluummin lyhyt kuin väärä polku.
 */
export function valitsePolku(viite: PolkuKausi, ehdokkaat: PolkuKausi[]): PolkuKausi[] {
  const sama = (a: PolkuKausi) => a.kausi === viite.kausi && a.sarja === viite.sarja;
  if (!(viite.ika > 0)) return [viite];
  const viiteVuosi = viite.kausi - viite.ika;
  const hyvaksytyt = ehdokkaat.filter(
    (e) =>
      !sama(e) &&
      e.ika > 0 &&
      Math.abs(e.kausi - e.ika - viiteVuosi) <= SYNTYMAVUODEN_TOLERANSSI,
  );
  return [viite, ...hyvaksytyt].sort(
    (a, b) => b.kausi - a.kausi || a.sarja.localeCompare(b.sarja),
  );
}
