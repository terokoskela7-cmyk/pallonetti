// ============================================
// VEIKKAUSLIIGA.COM SCRAPER
// Lähde: virallinen pelaajatilasto-taulukko
//   https://www.veikkausliiga.com/tilastot/{year}/veikkausliiga/pelaajat/
// Käyttö: GET /api/scrape/veikkausliiga?year=2026 (admin-suojattu)
//
// HUOM: tehtävänannossa pyydettiin node-fetchiä, mutta repoon on jo
// asennettu axios (käytössä fbrefApi.ts:ssä) — käytetään sitä jotta
// emme lisää ylimääräistä riippuvuutta.
// ============================================
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as admin from 'firebase-admin';

const BASE_URL = 'https://www.veikkausliiga.com';

/** Yhden pelaajan rivi taulukosta */
export interface VeikkausliigaPlayer {
  rank: number;
  name: string;
  team: string;
  appearances: number;   // O  — ottelut
  minutes: number;       // A  — pelimuutit
  goals: number;         // M  — maalit
  assists: number;       // S  — syötöt
  starts: number;        // AK — avauskokoonpano
  subIn: number;         // VS — vaihtoon
  subOut: number;        // VU — vaihdettu ulos
  fouls: number;         // R  — rikkeet
  yellowCards: number;   // KK — keltaiset kortit
  redCards: number;      // PK — punaiset kortit
  offsides: number;      // PA — paitsiot
  penalties: number;     // RP — rangaistuspotkut
  penaltyGoals: number;  // RPM — rangaistuspotkumaalit
}

/** Sarakkeet järjestyksessä — vastaa taulukon TD-rakennetta */
const COLUMNS = [
  'rank',
  'name',
  'team',
  'appearances',
  'minutes',
  'goals',
  'assists',
  'starts',
  'subIn',
  'subOut',
  'fouls',
  'yellowCards',
  'redCards',
  'offsides',
  'penalties',
  'penaltyGoals',
] as const;

/** "Sukunimi, Etunimi" → "Etunimi Sukunimi". Säilyttää alkuperäisen jos pilkkua ei ole. */
function flipName(raw: string): string {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return raw.trim();
}

/** Firestore-yhteensopiva document-ID — vain ascii + alaviivat */
function makeDocId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // poista combining-diakriitit (ä → a, ö → o jne.)
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 200) || 'unknown';
}

/** Robusti integer-parse — palauttaa 0 jos arvo ei ole numero */
function toInt(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d-]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/** Etsi HTML:stä taulukko jossa on pelaajatilastot.
 *  Tunnistetaan: tbody-rivissä on vähintään 14 td-solua (16 saraketta - vara). */
function findPlayerTable($: cheerio.CheerioAPI) {
  let result: ReturnType<typeof $> | null = null;
  $('table').each((_, table) => {
    const $table = $(table);
    if ($table.find('tbody tr').first().find('td').length >= 14) {
      result = $table;
      return false; // break each
    }
    return;
  });
  return result;
}

/** Scrapeta Veikkausliiga.com:n pelaajatilastot annetulta kaudelta. */
export async function scrapeVeikkausliigaPlayers(
  year: number,
): Promise<VeikkausliigaPlayer[]> {
  const url = `${BASE_URL}/tilastot/${year}/veikkausliiga/pelaajat/?sort-v=A&sort=A`;
  console.log(`[veikkausliiga-scraper] GET ${url}`);

  const response = await axios.get<string>(url, {
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    },
  });

  const $ = cheerio.load(response.data);
  const table = findPlayerTable($);
  if (!table) {
    throw new Error('Pelaajataulukkoa ei löytynyt — sivun rakenne on muuttunut');
  }

  const players: VeikkausliigaPlayer[] = [];
  table.find('tbody tr').each((_, row) => {
    const cells = $(row)
      .find('td')
      .map((__, td) => $(td).text().trim())
      .get();

    if (cells.length < COLUMNS.length) {
      // Vajaa rivi — ohitetaan
      return;
    }

    const rawName = cells[1];
    const name = flipName(rawName);
    if (!name) return;

    players.push({
      rank: toInt(cells[0]),
      name,
      team: cells[2],
      appearances: toInt(cells[3]),
      minutes: toInt(cells[4]),
      goals: toInt(cells[5]),
      assists: toInt(cells[6]),
      starts: toInt(cells[7]),
      subIn: toInt(cells[8]),
      subOut: toInt(cells[9]),
      fouls: toInt(cells[10]),
      yellowCards: toInt(cells[11]),
      redCards: toInt(cells[12]),
      offsides: toInt(cells[13]),
      penalties: toInt(cells[14]),
      penaltyGoals: toInt(cells[15]),
    });
  });

  console.log(`[veikkausliiga-scraper] Parsittiin ${players.length} pelaajaa`);
  return players;
}

/** Tallenna scrape-tulos Firestoreen.
 *  Rakenne: veikkausliiga_players/{year}/players/{docId}
 *  Lisäksi: parent-dokumenttiin meta (count, updatedAt) */
export async function saveVeikkausliigaPlayers(
  year: number,
  players: VeikkausliigaPlayer[],
): Promise<{ count: number; updatedAt: string }> {
  const db = admin.firestore();
  const yearRef = db.collection('veikkausliiga_players').doc(String(year));

  // Kirjoita pelaajat batch-eränä — yli 500 per batch jaetaan automaattisesti
  const BATCH_LIMIT = 450;
  for (let i = 0; i < players.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const slice = players.slice(i, i + BATCH_LIMIT);
    for (const player of slice) {
      const docId = makeDocId(player.name);
      const ref = yearRef.collection('players').doc(docId);
      batch.set(ref, {
        ...player,
        season: year,
        source: 'veikkausliiga.com',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const updatedAt = new Date().toISOString();
  // Parent-meta — kätevä /official-stats/:year-endpointille statuksen tarkistukseen
  await yearRef.set({
    season: year,
    source: 'veikkausliiga.com',
    count: players.length,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `[veikkausliiga-scraper] Tallennettiin ${players.length} pelaajaa Firestoreen`,
  );
  return { count: players.length, updatedAt };
}

/** Hae tallennetut pelaajat Firestoresta. Käytetään julkisessa endpointissa. */
export async function getOfficialStats(
  year: number,
): Promise<{
  players: VeikkausliigaPlayer[];
  meta: { count: number; updatedAt: string | null; source: string } | null;
}> {
  const db = admin.firestore();
  const yearRef = db.collection('veikkausliiga_players').doc(String(year));

  const [metaSnap, playersSnap] = await Promise.all([
    yearRef.get(),
    yearRef.collection('players').orderBy('rank', 'asc').get(),
  ]);

  const players = playersSnap.docs.map((d) => {
    const data = d.data() as VeikkausliigaPlayer & {
      updatedAt?: admin.firestore.Timestamp;
    };
    // Pudotetaan Timestamp-objekti pois palautuksesta — UI ei tarvitse sitä per pelaaja
    const { updatedAt: _unused, ...rest } = data;
    return rest as VeikkausliigaPlayer;
  });

  const metaData = metaSnap.data();
  const meta = metaData
    ? {
        count: (metaData.count as number) ?? players.length,
        updatedAt:
          (metaData.updatedAt as admin.firestore.Timestamp | undefined)
            ?.toDate()
            .toISOString() ?? null,
        source: (metaData.source as string) ?? 'veikkausliiga.com',
      }
    : null;

  return { players, meta };
}
