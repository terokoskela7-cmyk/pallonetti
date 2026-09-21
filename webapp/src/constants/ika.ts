// ============================================
// IKÄHAARUKKA — yksi lähde koko sovellukselle
//
// Sivuston päämittari on 17–21-vuotiaat. Haarukkaa ei kovakoodata
// komponentteihin: jos lähdeaineiston rajaus joskus muuttuu, se muuttuu
// täällä eikä kahdessatoista paikassa.
//
// Alle 21 -lukua (ikä ≤ 20) käytetään VAIN kansainvälisessä vertailussa,
// ja se nimetään aina auki. Se ei ole sama asia kuin päämittari vaan aina
// pienempi: eri ikäjoukko, sama nimittäjä. Kauden luvut haetaan
// rajapinnasta, eikä niitä kirjoiteta kommenttiin vanhenemaan.
// ============================================

/** Seurannan kohde: 17–21-vuotiaat. */
export const NUORET_MIN = 17;
export const NUORET_MAX = 21;

/** Ikähaarukan nimi käyttöliittymässä, esim. otsikoissa. */
export const NUORET_LABEL = NUORET_MIN + '–' + NUORET_MAX + ' v';

/** Pitkä muoto, esim. "17–21-vuotiaat". */
export const NUORET_LABEL_PITKA = NUORET_MIN + '–' + NUORET_MAX + '-vuotiaat';

/**
 * CIES-vertailun ikäraja: alle 21-vuotias = enintään 20-vuotias.
 * Tätä EI saa esittää päämittarina.
 */
export const ALLE_21_MAX = 20;
export const ALLE_21_LABEL = 'alle 21-vuotiaat';

/**
 * CIES Football Observatory 2025: Tanskan Superliga, alle 21-vuotiaiden
 * osuus peliajasta. Vertailuluku, ei tavoite.
 */
export const CIES_TANSKA_PCT = 11.7;

/**
 * Suodatinpainikkeiden ikäkaistat. Kaistat, eivät kumulatiivisia rajoja:
 * "19 v" tarkoittaa tasan 19-vuotiaita, ei kaikkia enintään 19-vuotiaita.
 * Näin painikkeet kertovat ikävuosia, eivät valmennusjärjestelmän koodeja.
 */
export interface Ikakaista {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const IKAKAISTAT: Ikakaista[] = [
  { id: 'ika-17-18', label: '17–18 v', min: 17, max: 18 },
  { id: 'ika-19', label: '19 v', min: 19, max: 19 },
  { id: 'ika-20-21', label: '20–21 v', min: 20, max: 21 },
];

/** Kuuluuko ikä kaistaan. */
export function kaistalla(ika: number, kaista: Ikakaista): boolean {
  return ika >= kaista.min && ika <= kaista.max;
}
