// ============================================
// SIIRROT JA LAINAT (B5)
//
// Kesken kauden ulkomaille siirtyneet pelaajat. Jokaisella rivilla on
// julkinen lahde, ja UI nayttaa sen linkkina: ilman lahdetta merkintaa ei
// tehda lainkaan.
//
// Lahdeaineisto on repon datatiedosto, ei Firestore. Rivit ovat kasin
// tarkistettuja ja niita on muutama vuodessa, joten tuonti ja tietokanta
// olisivat turhaa koneistoa. Samalla tieto on katselmoitavissa PR:ssa.
//
// Yhdistaminen pelaajaan: pelaajaAvain (etunimi + sukunimi, pienet
// kirjaimet, skandit sailytetaan) JA sen lisaksi kauden seura. Pelkka nimi
// ei riita: kaksi eri pelaajaa voi olla samanniminen, ja vaara merkinta
// vaittaisi pelaajan siirtyneen ulkomaille.
// ============================================
import { pelaajaAvaimeksi } from './kausiImport';
import siirrot2026 from '../data/siirrot-2026.json';

export interface Siirto {
  /** Nimi lahteessa, sellaisenaan. */
  pelaaja: string;
  /** Veikkausliiga-seura, josta pelaaja lahti. */
  seura: string;
  uusi_seura: string;
  maa: string;
  tyyppi: 'siirto' | 'laina';
  /** ISO-paiva tai null, jos lahde ei kerro tarkkaa paivaa. */
  pvm: string | null;
  lahde_url: string;
}

/** Kausi -> kauden aikana tapahtuneet siirrot. */
const KAUSITTAIN: Record<string, Siirto[]> = {
  '2026': siirrot2026 as Siirto[],
};

/** Nimen normalisointi on sama kuin tuonnissa, jotta avaimet tasmaavat. */
export function siirronAvain(pelaaja: string): string {
  const osat = String(pelaaja || '').trim().split(/\s+/);
  if (osat.length < 2) return pelaajaAvaimeksi(osat[0] || '', '');
  return pelaajaAvaimeksi(osat.slice(0, -1).join(' '), osat[osat.length - 1]);
}

/** Seuranimien vertailu: kirjainkoko ja ylimaaraiset valilyonnit eivat ratkaise. */
function seuraAvain(nimi: string): string {
  return String(nimi || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function kaudenSiirrot(kausi: number | string): Siirto[] {
  return KAUSITTAIN[String(kausi)] ?? [];
}

/**
 * Pelaajan siirto kaudella, tai null.
 *
 * `joukkueet` on pelaajan kauden seurat. Jos lahtoseura ei ole niiden
 * joukossa, merkintaa ei tehda: kyseessa on eri pelaaja tai vaara kausi.
 */
export function haeSiirto(
  kausi: number | string,
  etunimi: string,
  sukunimi: string,
  joukkueet: string[],
): Siirto | null {
  const avain = pelaajaAvaimeksi(etunimi, sukunimi);
  if (!avain.trim()) return null;
  const omat = new Set((joukkueet || []).filter(Boolean).map(seuraAvain));
  for (const s of kaudenSiirrot(kausi)) {
    if (siirronAvain(s.pelaaja) !== avain) continue;
    if (omat.size > 0 && !omat.has(seuraAvain(s.seura))) continue;
    return s;
  }
  return null;
}
