// ============================================
// SISÄISET LINKIT — valinta kulkee mukana
//
// Osoiterivi on kauden ja sarjan AINOA lähde: `useKausi` lukee ne
// `?sarja=`- ja `?kausi=`-parametreista. Siksi jokaisen sisäisen linkin
// on kuljetettava ne mukanaan. Jos yksikin linkki pudottaa parametrin,
// käyttäjä palaa huomaamattaan oletukseen — Veikkausliigaan ja uusimpaan
// kauteen — kesken selailun, eikä mikään kerro että näkymä vaihtui.
//
// Parametria EI lisätä käsin linkki kerrallaan. Se unohtuisi seuraavasta
// linkistä, ja juuri niin kävi ennen tätä tiedostoa.
// ============================================

/** Parametrit, jotka kulkevat linkistä toiseen. */
export const SAILYVAT_PARAMETRIT = ['sarja', 'kausi'] as const;

/**
 * Lisää säilyvät parametrit polkuun.
 *
 * Kohteen omat parametrit voittavat: jos linkki asettaa itse `?kausi=`,
 * sitä ei ylikirjoiteta. Ulkoisia osoitteita ei kosketa.
 */
export function sailytaValinta(
  to: string,
  nykyiset: URLSearchParams,
): string {
  // Ulkoinen osoite tai ankkuri: ei meidän reitityksemme, ei kosketa.
  if (/^[a-z]+:/i.test(to) || to.startsWith('#')) return to;

  const [polku, omaKysely = ''] = to.split('?');
  const kysely = new URLSearchParams(omaKysely);

  for (const avain of SAILYVAT_PARAMETRIT) {
    const arvo = nykyiset.get(avain);
    if (arvo !== null && arvo !== '' && !kysely.has(avain)) {
      kysely.set(avain, arvo);
    }
  }

  const merkkijono = kysely.toString();
  return merkkijono === '' ? polku : polku + '?' + merkkijono;
}
