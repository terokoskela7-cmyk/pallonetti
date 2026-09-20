// ============================================
// VERTAILURIVIN SANAMUODOT
//
// Rivi kertoo kolme asiaa samassa yksikossa: alle 21 -osuuden, siita
// Suomen kansalaisille menneen osuuden, ja Tanskan CIES-luvun. Muoto
// riippuu siita, kuinka suuri "ei tietoa" -osa on:
//
//   alle 0,5 prosenttiyksikkoa -> yksi luku (epavarmuus ei nay pyoristyksessa)
//   vahintaan 0,5              -> vali FIN … FIN + ei tietoa
//
// Vali ei ole arvio vaan rajat: alaraja on varmistettu, ylaraja sisaltaa
// kaikki joiden kansalaisuutta ei voitu varmentaa.
// ============================================
import { pros } from './luvut';
import { ALLE_21_LABEL, CIES_TANSKA_PCT } from '@/constants/ika';

/** Raja, jonka alapuolella epavarmuutta ei esiteta valina. */
export const EI_TIETOA_RAJA = 0.5;

export interface Kolmijako {
  fin: number;
  muu: number;
  eiTietoa: number;
}

/** Alkukirjain isoksi: rivi alkaa lauseena. */
function isollaAlkuun(teksti: string): string {
  return teksti.charAt(0).toUpperCase() + teksti.slice(1);
}

/**
 * Vertailurivin teksti. `jako` on null, kun kaudelta ei ole
 * kansalaisuustietoa — silloin sita ei arvata vaan sanotaan auki.
 */
export function vertailurivinTeksti(
  osuusAlle21: number | null,
  jako: Kolmijako | null,
): string {
  const otsikko = isollaAlkuun(ALLE_21_LABEL);
  const tanska = ' · Tanska ' + pros(CIES_TANSKA_PCT) + ' (CIES 2025)';
  if (osuusAlle21 === null) {
    return otsikko + ' ' + pros(null) + tanska;
  }
  const alku = otsikko + ' ' + pros(osuusAlle21);
  if (jako === null) {
    return alku + ' · Suomen kansalaisten osuus: ei tietoa' + tanska;
  }
  if (jako.eiTietoa < EI_TIETOA_RAJA) {
    return alku + ' · Suomen kansalaisille ' + pros(jako.fin) + tanska;
  }
  const ylaraja = Math.round((jako.fin + jako.eiTietoa) * 10) / 10;
  return (
    alku +
    ' · Suomen kansalaisille ' +
    pros(jako.fin, 1).replace(' %', '') +
    '–' +
    pros(ylaraja) +
    tanska
  );
}

/** Selite rivin alle. Sama riippumatta kauden luvuista. */
export const VERTAILURIVIN_SELITE =
  'Osuus liigan minuuttikapasiteetista. Suomen kansalaisten osuus on ' +
  'Veikkausliigan rekisterin mukainen: kaksoiskansalaisuus ei näy, ja ' +
  'kansalaisuus on nykyinen merkintä eikä kauden aikainen. Tanskan luku on ' +
  'CIES:n mittari maajoukkuekelpoisista alle 21-vuotiaista kaudella 2025.';
