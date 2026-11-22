// ============================================
// ALOITUKSET JA KOKOONPANOT
//
// Kaksi mittaria, jotka kertovat peliajasta enemmän kuin minuutit:
//
// - Aloitusosuus: nuorten aloitukset jaettuna aloituspaikoilla
//   (ottelut × 11). Erottaa avauskokoonpanon pelaajan vaihtopelaajasta.
// - Penkkikerrat: ottelut, joissa pelaaja oli kokoonpanossa mutta ei
//   pelannut (kokoonpanossa − pelatut ottelut).
//
// Molemmat lasketaan samasta kausiviennistä kuin minuutit, joten ne
// toimivat kaikissa sarjoissa ja kaikilla kausilla, joilta vienti on
// tuotu. Vanhoista dokumenteista kokoonpanossa-kenttä voi puuttua:
// silloin penkkikerrat on null ("ei tiedetä"), ei 0.
// ============================================

/** Aloituspaikkoja per ottelu. */
export const ALOITTAJIA = 11;

export interface KokoonpanoRivi {
  ottelut: number;
  kokoonpanossa?: number;
}

/**
 * Kerrat, jolloin pelaaja oli kokoonpanossa mutta ei pelannut.
 * null, jos yhdeltäkin riviltä puuttuu kokoonpanotieto: osittainen
 * summa näyttäisi pienemmältä kuin todellinen.
 */
export function penkkikerrat(rivit: KokoonpanoRivi[]): number | null {
  let summa = 0;
  for (const r of rivit) {
    if (typeof r.kokoonpanossa !== 'number') return null;
    // Vienti voi pyöristää tai rivi voi olla ristiriitainen; negatiivinen
    // erotus ei ole penkkikerta.
    summa += Math.max(0, r.kokoonpanossa - r.ottelut);
  }
  return summa;
}

/**
 * Nuorten osuus aloituspaikoista prosentteina, yksi desimaali.
 * null, jos otteluita ei tiedetä.
 */
export function aloitusosuus(aloitukset: number, ottelut: number): number | null {
  if (!(ottelut > 0)) return null;
  return Math.round((aloitukset / (ottelut * ALOITTAJIA)) * 1000) / 10;
}
