// ============================================
// TRANSFERMARKT.COM SCRAPER (direct HTML)
// Hakee pelaajan TM-ID:n nimellä ja parsii profiilisivun
// 13 kenttää (markkina-arvo, sopimus, lainat, kansallisuus,
// maajoukkuetilastot jne.). Tallentaa Firestore-cachelle 7 päivän
// TTL:llä.
//
// HUOM (oikeudellinen): TM:n robots.txt rajoittaa skrapausta. Tämä
// scraper on tarkoitettu pieneen, ei-kaupalliseen julkiseen
// data-alustaan — pyynnöt rate-limitataan ja kunnioitetaan TM:n
// taakkaa (>=500 ms peräkkäisten requestien välillä).
// ============================================
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import * as admin from 'firebase-admin';

const TM_BASE = 'https://www.transfermarkt.com';
const COMPETITION_ID = 'FI1'; // Veikkausliiga TM-tunnus
const CACHE_TTL_DAYS = 7;
const REQUEST_DELAY_MS = 600;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const COMMON_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TransfermarktProfile {
  tmId: number;
  name: string;
  imageUrl: string | null;
  marketValue: number | null; // euroissa
  marketValueRaw: string | null;
  shirtNumber: number | null;
  positions: { main: string | null; other: string[] };
  nationality: string[];
  birthPlace: string | null;
  height: string | null; // esim. "1,80 m"
  foot: 'right' | 'left' | 'both' | string | null;
  agent: string | null;
  currentClub: string | null;
  joined: string | null;
  contractExpires: string | null;
  loanFrom: string | null;
  loanExpires: string | null;
  internationalCaps: { caps: number; goals: number } | null;
  currentInternational: string | null;
  fetchedAt: string;
  expiresAt: string;
  source: 'transfermarkt.com';
}

// ============================================
// SEARCH — schnellsuche → ensimmäinen /spieler/(\d+)
// ============================================
export async function searchPlayerTmId(
  name: string,
): Promise<number | null> {
  if (!name.trim()) return null;
  const url = `${TM_BASE}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`;
  console.log(`[tm-scraper] search: ${url}`);

  try {
    const response = await axios.get<string>(url, {
      timeout: 15000,
      headers: COMMON_HEADERS,
      maxRedirects: 5,
    });
    const $ = cheerio.load(response.data);
    let foundId: number | null = null;

    // 1) Suora link-haku: ensimmäinen /spieler/N link
    $('a[href*="/profil/spieler/"]').each((_, a) => {
      if (foundId !== null) return;
      const href = $(a).attr('href') ?? '';
      const m = href.match(/\/spieler\/(\d+)/);
      if (m) {
        const id = parseInt(m[1], 10);
        if (!isNaN(id)) foundId = id;
      }
    });

    return foundId;
  } catch (error) {
    const message = error instanceof AxiosError ? error.message : String(error);
    console.error(`[tm-scraper] search failed for "${name}":`, message);
    return null;
  }
}

// ============================================
// PARSE HELPERS — etsi arvo labelin perusteella
// ============================================
function parseMarketValue(raw: string): number | null {
  if (!raw) return null;
  // Esim. "€600k", "€1.20m", "€1.5bn", "-", "—"
  const cleaned = raw.replace(/[ \s]+/g, '').toLowerCase();
  const match = cleaned.match(/€?\s*([\d.,]+)\s*(k|m|bn|b)?/i);
  if (!match) return null;
  const numStr = match[1].replace(/,/g, '.');
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  const suffix = (match[2] ?? '').toLowerCase();
  if (suffix === 'k') return Math.round(num * 1_000);
  if (suffix === 'm') return Math.round(num * 1_000_000);
  if (suffix === 'bn' || suffix === 'b') return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

function pickByLabel($: cheerio.CheerioAPI, labels: string[]): string | null {
  for (const label of labels) {
    // Pattern: <li class="data-header__label">{label}<span class="data-header__content">VALUE</span></li>
    const li = $(`li.data-header__label`)
      .filter((_, el) => {
        const text = $(el).clone().children().remove().end().text().trim();
        return text.toLowerCase().startsWith(label.toLowerCase());
      })
      .first();
    if (li.length) {
      const content = li.find('.data-header__content').text().trim();
      if (content) return content;
    }

    // Pattern: <th>{label}</th><td>VALUE</td>
    const th = $(`th, .definition-list__item__title`)
      .filter((_, el) => $(el).text().trim().toLowerCase().startsWith(label.toLowerCase()))
      .first();
    if (th.length) {
      const td = th.next('td, .definition-list__item__definition').first();
      const text = td.text().trim();
      if (text) return text;
    }
  }
  return null;
}

function parseShirtNumber($: cheerio.CheerioAPI): number | null {
  // Profiilin H1:ssä on usein "#34 Player Name" tai erillinen .data-header__shirt-number
  const shirt =
    $('.data-header__shirt-number').first().text().trim() ||
    $('span.dataRueckennummer').first().text().trim();
  if (shirt) {
    const m = shirt.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  const headerText = $('h1.data-header__headline-wrapper, h1[class*="headline"]')
    .first()
    .text();
  const hm = headerText.match(/#\s*(\d+)/);
  return hm ? parseInt(hm[1], 10) : null;
}

function parseCapsGoals(raw: string | null): { caps: number; goals: number } | null {
  if (!raw) return null;
  // Esim. "8 / 2" tai "8/2" tai "Caps / Goals 8 / 2"
  const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  return { caps: parseInt(m[1], 10), goals: parseInt(m[2], 10) };
}

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,·]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================
// PROFILE SCRAPE
// ============================================
export async function scrapePlayerProfile(
  tmId: number,
): Promise<TransfermarktProfile> {
  const url = `${TM_BASE}/x/profil/spieler/${tmId}`;
  console.log(`[tm-scraper] profile: ${url}`);

  const response = await axios.get<string>(url, {
    timeout: 20000,
    headers: COMMON_HEADERS,
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);

  // Nimi: H1 headline (jos sisältää #-numeron, riisutaan)
  const rawName = $('h1.data-header__headline-wrapper, h1[class*="headline"]')
    .first()
    .text()
    .trim();
  const name = rawName.replace(/#\s*\d+/, '').trim() || 'Tuntematon';

  // Kuva: <img class="data-header__profile-image">
  const imageUrl =
    $('img.data-header__profile-image').first().attr('src') ??
    $('div.data-header__profile-image img').first().attr('src') ??
    null;

  // Markkina-arvo: data-header marquee linkki
  const marketValueRaw =
    $('a.data-header__market-value-wrapper').first().text().trim() ||
    $('.market-value-wrapper, .tm-player-market-value-development__current-value')
      .first()
      .text()
      .trim() ||
    null;
  const marketValue = marketValueRaw ? parseMarketValue(marketValueRaw) : null;

  // Päädata label/value-pareista
  const birthPlace = pickByLabel($, ['Place of birth:']);
  const height = pickByLabel($, ['Height:']);
  const foot = pickByLabel($, ['Foot:'])?.toLowerCase() ?? null;
  const mainPosition = pickByLabel($, ['Main position:', 'Position:']);
  const otherPosRaw = pickByLabel($, ['Other position:']);
  const citizenshipRaw = pickByLabel($, ['Citizenship:', 'Nationality:']);
  const currentClub = pickByLabel($, ['Current club:']);
  const joined = pickByLabel($, ['Joined:']);
  const contractExpires = pickByLabel($, ['Contract expires:']);
  const loanFrom = pickByLabel($, ['On loan from:']);
  const loanExpires = pickByLabel($, ['Contract there expires:']);
  const agent = pickByLabel($, ['Player agent:', 'Agent:']);
  const capsRaw = pickByLabel($, ['Caps/Goals:', 'Caps / Goals:']);
  const currentInternational = pickByLabel($, ['Current international:']);

  const shirtNumber = parseShirtNumber($);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  return {
    tmId,
    name,
    imageUrl: imageUrl || null,
    marketValue,
    marketValueRaw: marketValueRaw || null,
    shirtNumber,
    positions: {
      main: mainPosition,
      other: splitList(otherPosRaw),
    },
    nationality: splitList(citizenshipRaw),
    birthPlace,
    height,
    foot,
    agent,
    currentClub,
    joined,
    contractExpires,
    loanFrom,
    loanExpires,
    internationalCaps: parseCapsGoals(capsRaw),
    currentInternational,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: 'transfermarkt.com',
  };
}

// ============================================
// FIRESTORE — single player
// ============================================
export async function savePlayerProfile(
  profile: TransfermarktProfile,
): Promise<void> {
  await admin
    .firestore()
    .collection('transfermarkt_players')
    .doc(String(profile.tmId))
    .set(profile);
  console.log(`[tm-scraper] saved player ${profile.tmId} (${profile.name})`);
}

export async function getStoredProfile(
  tmId: number,
): Promise<TransfermarktProfile | null> {
  const doc = await admin
    .firestore()
    .collection('transfermarkt_players')
    .doc(String(tmId))
    .get();
  if (!doc.exists) return null;
  const data = doc.data() as TransfermarktProfile;
  if (new Date(data.expiresAt) < new Date()) return null;
  return data;
}

/** Yhdistetty haku: tmId → suora, name → schnellsuche → suora.
 *  Cache-first; jos miss/expired tehdään fresh scrape. */
export async function getOrFetchPlayer(args: {
  tmId?: number;
  name?: string;
  forceRefresh?: boolean;
}): Promise<TransfermarktProfile | null> {
  let tmId = args.tmId;

  if (!tmId && args.name) {
    tmId = (await searchPlayerTmId(args.name)) ?? undefined;
    if (!tmId) {
      console.warn(`[tm-scraper] search returned no tmId for "${args.name}"`);
      return null;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (!tmId) return null;

  if (!args.forceRefresh) {
    const cached = await getStoredProfile(tmId);
    if (cached) return cached;
  }

  const profile = await scrapePlayerProfile(tmId);
  await savePlayerProfile(profile);
  return profile;
}

// ============================================
// LEAGUE — Veikkausliiga startseite + team rosters
// ============================================
export interface TmLeaguePlayer {
  tmId: number;
  name: string;
  team: string;
  teamTmId: number;
  marketValue: number | null;
  marketValueRaw: string | null;
}

interface ScrapedTeam {
  teamId: number;
  teamName: string;
  teamUrl: string;
}

async function scrapeLeagueTeams(season: number): Promise<ScrapedTeam[]> {
  const url = `${TM_BASE}/veikkausliiga/startseite/wettbewerb/${COMPETITION_ID}/plus/?saison_id=${season}`;
  console.log(`[tm-scraper] league teams: ${url}`);

  const response = await axios.get<string>(url, {
    timeout: 20000,
    headers: COMMON_HEADERS,
  });
  const $ = cheerio.load(response.data);

  const teams: ScrapedTeam[] = [];
  const seen = new Set<number>();

  // Joukkuelinkit Veikkausliiga-sivulla: /<slug>/startseite/verein/<id>
  $('a[href*="/startseite/verein/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = href.match(/\/startseite\/verein\/(\d+)/);
    if (!m) return;
    const teamId = parseInt(m[1], 10);
    if (seen.has(teamId)) return;
    seen.add(teamId);

    // Joukkueen nimi: img-alt jos olemassa, muuten link-teksti
    const img = $(a).find('img').first();
    const teamName = img.attr('alt')?.trim() || $(a).text().trim();
    if (!teamName) return;

    teams.push({
      teamId,
      teamName,
      teamUrl: href.startsWith('http') ? href : `${TM_BASE}${href}`,
    });
  });

  return teams;
}

async function scrapeTeamRoster(
  team: ScrapedTeam,
  season: number,
): Promise<TmLeaguePlayer[]> {
  // Pidetään team-URL sellaisenaan mutta varmistetaan saison_id
  const url = team.teamUrl.includes('saison_id=')
    ? team.teamUrl
    : `${team.teamUrl}/saison_id/${season}`;
  console.log(`[tm-scraper] team roster: ${url}`);

  const response = await axios.get<string>(url, {
    timeout: 20000,
    headers: COMMON_HEADERS,
  });
  const $ = cheerio.load(response.data);

  const players: TmLeaguePlayer[] = [];
  const seen = new Set<number>();

  // Joukkueen pelaajataulukon rivit — etsi spieler-linkki + lähimmän rivin markkina-arvo
  $('table.items tbody tr').each((_, row) => {
    const link = $(row).find('a[href*="/profil/spieler/"]').first();
    const href = link.attr('href') ?? '';
    const m = href.match(/\/spieler\/(\d+)/);
    if (!m) return;
    const tmId = parseInt(m[1], 10);
    if (seen.has(tmId)) return;
    seen.add(tmId);

    const name = link.text().trim() || link.attr('title')?.trim() || '';
    // Markkina-arvo: viimeisin TD jossa "€" tai class joka sisältää "rechts hauptlink"
    const valueCell = $(row).find('td.rechts.hauptlink, td.rechts').last();
    const marketValueRaw = valueCell.text().trim() || null;
    const marketValue = marketValueRaw ? parseMarketValue(marketValueRaw) : null;

    if (!name) return;
    players.push({
      tmId,
      name,
      team: team.teamName,
      teamTmId: team.teamId,
      marketValue,
      marketValueRaw,
    });
  });

  return players;
}

export async function scrapeVeikkausliiga(
  season: number,
): Promise<TmLeaguePlayer[]> {
  const teams = await scrapeLeagueTeams(season);
  console.log(`[tm-scraper] found ${teams.length} teams for season ${season}`);

  const allPlayers: TmLeaguePlayer[] = [];
  for (const team of teams) {
    try {
      await sleep(REQUEST_DELAY_MS);
      const roster = await scrapeTeamRoster(team, season);
      allPlayers.push(...roster);
      console.log(
        `[tm-scraper] ${team.teamName}: ${roster.length} pelaajaa`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[tm-scraper] failed for team ${team.teamName} (${team.teamId}):`,
        message,
      );
    }
  }

  return allPlayers;
}

export async function saveLeague(
  season: number,
  players: TmLeaguePlayer[],
): Promise<{ count: number; updatedAt: string }> {
  const db = admin.firestore();
  const seasonRef = db.collection('transfermarkt_league').doc(String(season));

  // Kirjoita pelaajat batch-eränä
  const BATCH_LIMIT = 450;
  for (let i = 0; i < players.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const slice = players.slice(i, i + BATCH_LIMIT);
    for (const p of slice) {
      const ref = seasonRef.collection('players').doc(String(p.tmId));
      batch.set(ref, {
        ...p,
        season,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const updatedAt = new Date().toISOString();
  await seasonRef.set({
    season,
    source: 'transfermarkt.com',
    count: players.length,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `[tm-scraper] saved ${players.length} league players for season ${season}`,
  );
  return { count: players.length, updatedAt };
}

export async function scrapeAndSaveLeague(
  season: number,
): Promise<{ count: number; updatedAt: string }> {
  const players = await scrapeVeikkausliiga(season);
  return saveLeague(season, players);
}

export async function getStoredLeague(
  season: number,
): Promise<{
  players: TmLeaguePlayer[];
  meta: { count: number; updatedAt: string | null; source: string } | null;
}> {
  const db = admin.firestore();
  const seasonRef = db.collection('transfermarkt_league').doc(String(season));
  const [metaSnap, playersSnap] = await Promise.all([
    seasonRef.get(),
    seasonRef.collection('players').get(),
  ]);

  const players = playersSnap.docs.map((d) => {
    const data = d.data() as TmLeaguePlayer & {
      updatedAt?: admin.firestore.Timestamp;
    };
    const { updatedAt: _u, ...rest } = data;
    return rest as TmLeaguePlayer;
  });

  const metaData = metaSnap.data();
  const meta = metaData
    ? {
        count: (metaData.count as number) ?? players.length,
        updatedAt:
          (metaData.updatedAt as admin.firestore.Timestamp | undefined)
            ?.toDate()
            .toISOString() ?? null,
        source: (metaData.source as string) ?? 'transfermarkt.com',
      }
    : null;

  return { players, meta };
}
