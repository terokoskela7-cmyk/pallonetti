// ============================================
// EXCEL-IMPORT — Veikkausliiga-pelaajadata (kumulatiivinen)
// Käyttö: POST /api/admin/import-excel (admin-suojattu, ks. index.ts)
//
// Excel on AINA kumulatiivinen kauden alusta. Yksi pelaaja voi esiintyä
// useassa rivissä eri "sarjan vaiheissa" (Runkosarja / Mestaruussarja /
// Karsintasarja) — nämä aggregoidaan yhteen per pelaaja.
//
// Sarakejärjestys (0-indeksoitu):
//   0 Etunimi | 1 Sukunimi | 2 Ikä | 3 Kausi | 4 Sarja | 5 Sarjan vaihe
//   6 Joukkue | 7 Pelatut minuutit | 8 min% (skip) | 9 Aloitukset
//   10 Pelatut ottelut | 11 Kokoonpanossa (skip) | 12 Maalit
//   13 Joukkueen ottelut (skip)
//
// HUOM: xlsx-paketti (SheetJS) tuo omat tyyppinsä — ei erillistä @types-pakettia.
// ============================================
import * as XLSX from 'xlsx';
import * as admin from 'firebase-admin';

/** Yhden pelaajan aggregoitu (kumulatiivinen) rivi. */
export interface PlayerAgg {
  etunimi: string;
  sukunimi: string;
  ika: number;
  joukkue: string;
  minTotal: number;
  ottelutTotal: number;
  aloituksetTotal: number;
  maaliTotal: number;
}

/** Tehtävänannon mukainen slug: "etunimi-sukunimi", ä/ö/å→a/o/a, muut→'-'. */
export function toSlug(etu: string, suku: string): string {
  return `${etu}-${suku}`
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** Robusti number-parse — hyväksyy sekä numerot että merkkijonot (pilkku→piste). */
function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Trimmattu string tai '' — käsittelee null/undefined/number-solut. */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Parsii xlsx-bufferin ja aggregoi sarjan vaiheet yhteen per pelaaja.
 * Palauttaa Mapin slug → PlayerAgg. Ohittaa header- ja tyhjät rivit.
 */
export function parseExcelBuffer(buffer: Buffer): Map<string, PlayerAgg> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel-tiedostossa ei ole yhtään välilehteä');
  }
  const sheet = wb.Sheets[sheetName];

  // header:1 → rivit taulukkoina (solu sarakeindeksin mukaan). raw:true säilyttää
  // numerot numeroina; defval:'' varmistaa ettei tyhjät solut jää undefiniksi.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  });

  const agg = new Map<string, PlayerAgg>();

  for (const row of rows) {
    const etunimi = toStr(row[0]);
    // Ohita tyhjät ja header-rivi
    if (!etunimi || etunimi.toLowerCase() === 'etunimi') continue;

    const sukunimi = toStr(row[1]);
    const slug = toSlug(etunimi, sukunimi);
    if (!slug) continue;

    const ika = toNum(row[2]);
    const joukkue = toStr(row[6]);
    const min = toNum(row[7]);
    const aloitukset = toNum(row[9]);
    const ottelut = toNum(row[10]);
    const maalit = toNum(row[12]);

    const existing = agg.get(slug);
    if (existing) {
      existing.minTotal += min;
      existing.ottelutTotal += ottelut;
      existing.aloituksetTotal += aloitukset;
      existing.maaliTotal += maalit;
      // Täydennä ikä/joukkue jos edelliseltä vaiheelta puuttui
      if (!existing.ika && ika) existing.ika = ika;
      if (!existing.joukkue && joukkue) existing.joukkue = joukkue;
    } else {
      agg.set(slug, {
        etunimi,
        sukunimi,
        ika,
        joukkue,
        minTotal: min,
        ottelutTotal: ottelut,
        aloituksetTotal: aloitukset,
        maaliTotal: maalit,
      });
    }
  }

  return agg;
}

/** Yhteenvetorivi paluuarvoa varten. */
export interface ImportedPlayerSummary {
  slug: string;
  name: string;
  minTotal: number;
  maaliTotal: number;
}

/**
 * Kirjoittaa aggregoidut pelaajat Firestoreen kahteen kokoelmaan batch-erinä.
 *
 *  1) seasons/{season}/players/{slug}                — kanoninen "viimeisin" tila
 *  2) seasons/{season}/rounds/{round}/players/{slug} — tämän kierroksen kumulatiivinen snapshot
 *
 * Idempotentti: set() slug-docId:llä ylikirjoittaa, ei luo duplikaatteja.
 * Muiden kierrosten dataa ei kosketa. 2 kirjoitusta/pelaaja → CHUNK=250
 * pitää batchin ≤ 500 operaatiossa.
 */
export async function writeRoundData(
  season: number,
  round: number,
  players: PlayerAgg[],
): Promise<{ imported: number; players: ImportedPlayerSummary[] }> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const seasonRef = db.collection('seasons').doc(String(season));
  const roundRef = seasonRef.collection('rounds').doc(String(round));

  const summary: ImportedPlayerSummary[] = [];
  const CHUNK = 250; // 2 writes/player → ≤ 500 ops/batch

  for (let i = 0; i < players.length; i += CHUNK) {
    const batch = db.batch();
    const slice = players.slice(i, i + CHUNK);

    for (const p of slice) {
      const slug = toSlug(p.etunimi, p.sukunimi);

      // Kokoelma 1 — kanoninen viimeisin tila
      batch.set(seasonRef.collection('players').doc(slug), {
        etunimi: p.etunimi,
        sukunimi: p.sukunimi,
        ika: p.ika,
        joukkue: p.joukkue,
        minTotal: p.minTotal,
        ottelutTotal: p.ottelutTotal,
        aloituksetTotal: p.aloituksetTotal,
        maaliTotal: p.maaliTotal,
        lastUpdatedRound: round,
        updatedAt: now,
      });

      // Kokoelma 2 — tämän kierroksen kumulatiivinen snapshot
      batch.set(roundRef.collection('players').doc(slug), {
        min: p.minTotal,
        ottelut: p.ottelutTotal,
        aloitukset: p.aloituksetTotal,
        maalit: p.maaliTotal,
        cumMin: p.minTotal, // Excel on aina kumulatiivinen → sama kuin min
        cumOttelut: p.ottelutTotal,
        cumMaalit: p.maaliTotal,
        updatedAt: now,
      });

      summary.push({
        slug,
        name: `${p.etunimi} ${p.sukunimi}`.trim(),
        minTotal: p.minTotal,
        maaliTotal: p.maaliTotal,
      });
    }

    await batch.commit();
  }

  // Kierroksen meta-dokumentti (tekee rounds/{round}-parentista olemassaolevan
  // ja auttaa frontendia listaamaan importatut kierrokset). Oma set() jotta
  // player-batch pysyy ≤ 500 operaatiossa.
  await roundRef.set(
    {
      round,
      playerCount: players.length,
      updatedAt: now,
    },
    { merge: true },
  );

  return { imported: players.length, players: summary };
}
