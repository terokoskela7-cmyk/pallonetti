// ============================================
// NIMIEN NÄYTTÖASU
//
// Lähdeaineistossa nimet ovat epäyhtenäisiä: "OSKU MAUKONEN",
// "alex RAMULA", "Aapo BOSTRÖM". Kirjoitusasu vaihtelee rivistä toiseen
// eikä se kerro mitään — se on viennin ominaisuus, ei pelaajan nimi.
//
// Tämä muuntaa vain NÄYTÖN. Tallennettua dataa ei muuteta: haku,
// tunnisteet ja vertailut käyttävät edelleen alkuperäistä arvoa, joten
// muunnos ei voi rikkoa yhdistämistä lähteisiin.
//
// Säännöt:
//   - jokainen sana alkaa isolla, loput pieniä
//   - väliviivalliset osat käsitellään erikseen: "Le Goff-Conan"
//   - heittomerkin jälkeen iso: "O'Brien"
//   - lyhenteitä ei arvata: "de", "van" ja muut etuliitteet saavat ison
//     alkukirjaimen kuten muutkin sanat ("De Nascimento"), koska
//     pienellä kirjoittaminen olisi oletus jota lähde ei tue
// ============================================

/** Ison alkukirjaimen tarvitsevat osat erotetaan näillä merkeillä. */
const EROTTIMET = /([-'’])/;

function isollaAlkuun(osa: string): string {
  if (osa.length === 0) return osa;
  return osa.charAt(0).toLocaleUpperCase('fi-FI') + osa.slice(1).toLocaleLowerCase('fi-FI');
}

function sana(s: string): string {
  // Väliviivat ja heittomerkit säilytetään, ja niiden molemmat puolet
  // alkavat isolla: "Le Goff-Conan", "O'Brien".
  return s
    .split(EROTTIMET)
    .map((osa) => (EROTTIMET.test(osa) ? osa : isollaAlkuun(osa)))
    .join('');
}

/**
 * Nimi näyttömuodossa. Tyhjä tai puuttuva arvo palautuu tyhjänä, ei
 * tekstinä "undefined".
 */
export function naytaNimi(nimi: string | null | undefined): string {
  if (!nimi) return '';
  return String(nimi)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(sana)
    .join(' ');
}

/** Etu- ja sukunimi yhtenä näyttönimenä. */
export function naytaKokoNimi(
  etunimi: string | null | undefined,
  sukunimi: string | null | undefined,
): string {
  return naytaNimi(((etunimi ?? '') + ' ' + (sukunimi ?? '')).trim());
}
