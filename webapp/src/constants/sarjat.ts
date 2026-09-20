// ============================================
// SARJAT — yksi lähde käyttöliittymälle
//
// Sarjalista ei ole kovakoodattu: se johdetaan /api/kaudet-vastauksesta,
// jotta uusi sarja ilmestyy valitsimeen tuonnin jälkeen ilman
// koodimuutosta. Täällä on vain se, mitä lista ei kerro: tunnisteen
// muoto URL-parametrissa ja järjestys, jossa sarjat näytetään.
// ============================================

/** Oletussarja: ilman parametria sivusto näyttää Veikkausliigan. */
export const OLETUSSARJA = 'Veikkausliiga';

/**
 * Näyttöjärjestys. Sarjat, joita ei ole listalla, tulevat perään
 * aakkosjärjestyksessä — uusi sarja ei siis katoa näkyvistä.
 */
const JARJESTYS = ['Veikkausliiga', 'Ykkösliiga'];

/** Sama normalisointi kuin backendissä: "Ykkösliiga" → "ykkosliiga". */
export function sarjaAvain(sarja: string): string {
  return String(sarja || OLETUSSARJA)
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function jarjestaSarjat(sarjat: string[]): string[] {
  return sarjat.slice().sort((a, b) => {
    const ia = JARJESTYS.indexOf(a);
    const ib = JARJESTYS.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, 'fi');
  });
}
