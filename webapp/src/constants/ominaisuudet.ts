// ============================================
// OMINAISUUSKYTKIMET
//
// Yksi paikka, josta näkyvyyttä ohjataan. Palautus on yhden rivin
// muutos, eikä sitä tarvitse etsiä kymmenestä komponentista.
// ============================================

/**
 * Markkina-arvot piilossa, kunnes niille löytyy luvallinen lähde.
 *
 * Syy: transfermarkt-api.vercel.app palauttaa 402 DEPLOYMENT_DISABLED
 * eli palvelu on lakannut olemasta, suora Transfermarkt-haku rikkoo
 * sivuston käyttöehtoja (ja estyy 403:een), ja tallessa olevat 30 arvoa
 * ovat toukokuulta 2026 eli vanhentuneita.
 *
 * Vanhentunut euromäärä pelaajan kohdalla on pahempi kuin ei mitään:
 * se näyttää ajantasaiselta eikä kerro olevansa vanha.
 *
 * Kun luvallinen lähde löytyy, tämä käännetään takaisin trueksi.
 * Backend-reittejä ja transfermarkt_players-kokoelmaa EI ole poistettu,
 * joten palautus ei vaadi datan uudelleenhakua.
 */
export const MARKKINA_ARVOT_NAKYVISSA = false;
