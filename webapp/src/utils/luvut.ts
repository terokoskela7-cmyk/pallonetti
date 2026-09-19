// ============================================
// LUKUJEN MUOTOILU — suomalainen esitys
//
// Sivusto on suomenkielinen, joten desimaalierotin on pilkku eikä piste.
// toFixed() tuottaa aina pisteen, joten sitä ei käytetä suoraan
// käyttöliittymässä.
// ============================================

const LOCALE = 'fi-FI';

/** Prosenttiluku, esim. 15.9 → "15,9 %". null → "ei dataa". */
export function pros(
  arvo: number | null | undefined,
  desimaaleja = 1,
): string {
  if (arvo === null || arvo === undefined || Number.isNaN(arvo)) {
    return 'ei dataa';
  }
  return (
    arvo.toLocaleString(LOCALE, {
      minimumFractionDigits: desimaaleja,
      maximumFractionDigits: desimaaleja,
    }) + ' %'
  );
}

/** Kokonaisluku tuhaterottimin, esim. 21780 → "21 780". */
export function luku(arvo: number | null | undefined): string {
  if (arvo === null || arvo === undefined || Number.isNaN(arvo)) {
    return 'ei dataa';
  }
  return arvo.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

/** Desimaaliluku, esim. 20.3 → "20,3". */
export function desimaali(
  arvo: number | null | undefined,
  desimaaleja = 1,
): string {
  if (arvo === null || arvo === undefined || Number.isNaN(arvo)) {
    return 'ei dataa';
  }
  return arvo.toLocaleString(LOCALE, {
    minimumFractionDigits: desimaaleja,
    maximumFractionDigits: desimaaleja,
  });
}
