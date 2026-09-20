// ============================================
// AKATEMIAJOUKKUEET — käyttöliittymän merkinnät
//
// Sama lista kuin backendissä (functions/src/services/akatemiat.ts).
// Kahdessa paikassa siksi, ettei listaa tarvitse hakea verkosta pelkkää
// merkintää varten; jos lista muuttuu, molemmat päivitetään.
//
// Lista on nimetty vakio eikä nimestä pääteltävä sääntö: "Akatemia"-sanan
// etsiminen nimestä olisi arvaus, joka muuttuisi äänettömästi.
// ============================================

export const AKATEMIAJOUKKUEET = ['HJK Klubi 04', 'SJK Akatemia'];

function avain(nimi: string): string {
  return String(nimi || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const AVAIMET = new Set(AKATEMIAJOUKKUEET.map(avain));

export function onAkatemia(joukkue: string): boolean {
  return AVAIMET.has(avain(joukkue));
}

/** Selitys, joka näkyy merkinnän yhteydessä. */
export const AKATEMIA_SELITE =
  'Akatemiajoukkue: seuran oma kasvattajajoukkue, jonka peliajasta valtaosa ' +
  'menee nuorille. Liigaluku näytetään myös ilman näitä joukkueita.';
