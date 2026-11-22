// ============================================
// SUOMESSA KOULUTETTU — UEFA "association-trained"
//
// Määritelmä (sovittu 22.11.2026): pelaaja on Suomessa koulutettu, kun hän
// on pelannut suomalaisen seuran joukkueessa vähintään KOLMELLA kaudella,
// joilla hän oli 15–21-vuotias. Tiukka sääntö: alle kolme kautta on
// "ei vahvistettu", myös nuorella, joka voi vielä täyttää ehdon.
//
// Lähde: sama vientityökalu kuin kausituonnissa, mutta kaikista sarjoista
// (nuorten sarjat P14–P21, Kakkonen, Kolmonen jne.). Kausi lasketaan, jos
// pelaajalla on sillä kaudella yksikin rivi suomalaisen seuran joukkueessa
// virallisessa sarjassa. Minuutteja ei vaadita.
//
// Ei lasketa:
//   - futsal ja naisten sarjat (eri laji / eri pelaaja-aineisto)
//   - harjoitusottelut
//   - maajoukkueet ja aluejoukkueet ("Suomi (P2008)", "Pohjanmaa (P2008)"):
//     ne eivät ole seuroja
//   - talvikaudet muodossa "2022-23" (futsal)
//
// Tallennetaan vain pelaajista, jotka ovat jo sivuston datassa: muiden
// alaikäisten pelaajien seurahistoriaa ei tuoda.
// ============================================
import * as XLSX from 'xlsx';

export const KOULUTUS_MIN_IKA = 15;
export const KOULUTUS_MAX_IKA = 21;
export const KOULUTUS_MIN_KAUSIA = 3;

export interface KoulutusRivi {
  palloid: string;
  kausi: number;
  ika: number;
  sarja: string;
  joukkue: string;
}

export interface KoulutusLuku {
  rivit: KoulutusRivi[];
  /** Ohitetut rivit syittäin (raportointia varten). */
  ohitetut: Record<string, number>;
}

/** Maajoukkue tai aluejoukkue: "Suomi (P2008)", "Länsi (P2008)" ym. */
const VALINTAJOUKKUE = /\((P|T)\d{4}\)/;

function syy(o: Record<string, number>, s: string): void {
  o[s] = (o[s] ?? 0) + 1;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Lukee vientitiedoston rivit. Sarakkeet kuten kausituonnissa. */
export function parsiKoulutusExcel(puskuri: Buffer): KoulutusLuku {
  const wb = XLSX.read(puskuri, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  return suodataKoulutusRivit(data);
}

export function suodataKoulutusRivit(data: Record<string, unknown>[]): KoulutusLuku {
  const rivit: KoulutusRivi[] = [];
  const ohitetut: Record<string, number> = {};
  for (const d of data) {
    const palloid = str(d['palloid']);
    const kausiRaaka = str(d['Kausi']);
    const sarja = str(d['Sarja']);
    const joukkue = str(d['Joukkue']);
    const ika = Number(d['Pelaajan ikä kaudella']);
    if (!palloid || !kausiRaaka) {
      syy(ohitetut, 'tyhjä tai selite');
      continue;
    }
    if (!/^\d{4}$/.test(kausiRaaka)) {
      syy(ohitetut, 'talvikausi (futsal)');
      continue;
    }
    if (/futsal/i.test(sarja)) {
      syy(ohitetut, 'futsal');
      continue;
    }
    if (/^naisten|^tytöt|^t\d/i.test(sarja)) {
      syy(ohitetut, 'naisten tai tyttöjen sarja');
      continue;
    }
    if (/harjoitus/i.test(sarja)) {
      syy(ohitetut, 'harjoitusottelu');
      continue;
    }
    if (VALINTAJOUKKUE.test(joukkue)) {
      syy(ohitetut, 'maa- tai aluejoukkue');
      continue;
    }
    if (!(ika >= KOULUTUS_MIN_IKA && ika <= KOULUTUS_MAX_IKA)) {
      syy(ohitetut, 'ikä 15–21 ulkopuolella');
      continue;
    }
    rivit.push({ palloid, kausi: parseInt(kausiRaaka, 10), ika, sarja, joukkue });
  }
  return { rivit, ohitetut };
}

export interface KoulutusDoc {
  palloid: string;
  /** kausi → seurat (joukkueiden nimet), joissa pelaaja oli 15–21-vuotiaana. */
  kaudet: Record<string, string[]>;
  kausiaSuomessa: number;
  koulutettuSuomessa: boolean;
}

/**
 * Kokoaa rivit pelaajittain. `sallitut` = sivuston datassa olevat palloidit;
 * muut jätetään pois. Kaikki tiedostot annetaan yhdellä kertaa: dokumentti
 * kirjoitetaan kokonaan uudelleen, joten uudelleenajo on idempotentti.
 */
export function kokoaKoulutus(
  rivit: KoulutusRivi[],
  sallitut: Set<string> | null,
): Map<string, KoulutusDoc> {
  const tulos = new Map<string, KoulutusDoc>();
  for (const r of rivit) {
    if (sallitut && !sallitut.has(r.palloid)) continue;
    const d = tulos.get(r.palloid) ?? {
      palloid: r.palloid,
      kaudet: {},
      kausiaSuomessa: 0,
      koulutettuSuomessa: false,
    };
    const k = String(r.kausi);
    const seurat = new Set(d.kaudet[k] ?? []);
    seurat.add(r.joukkue);
    d.kaudet[k] = [...seurat].sort();
    tulos.set(r.palloid, d);
  }
  for (const d of tulos.values()) {
    d.kausiaSuomessa = Object.keys(d.kaudet).length;
    d.koulutettuSuomessa = d.kausiaSuomessa >= KOULUTUS_MIN_KAUSIA;
  }
  return tulos;
}
