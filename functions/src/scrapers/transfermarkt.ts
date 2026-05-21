// ============================================
// TRANSFERMARKT.COM SCRAPER (direct HTML, U23-fokus)
// Pipeline:
//   1) schnellsuche nimellä → {tmId, marketValue, url}
//   2) profile-sivu → koko TransfermarktPlayer (sopimus, lainat, agentti…)
//   3) Firestore tallennus:
//      transfermarkt_players/{tmId}              — koko profiili 7 päivän TTL:llä
//      transfermarkt_index/{season}/names/{slug} — nimi→tmId-hakuindeksi
//
// Batch-skriptaus ei käy koko Veikkausliigan kokoonpanoja läpi vaan vain
// U23-pelaajat (max 20) joista youthAggregation antaa valmiin listan.
// 2 sekunnin viive pelaajien välillä TM:n rajoja kunnioittaen.
// ============================================
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import * as admin from 'firebase-admin';
import { dataAggregator } from '../services/dataAggregator';

const TM_BASE = 'https://www.transfermarkt.com';
const CACHE_TTL_DAYS = 7;
const BATCH_DELAY_MS = 2000;

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

// ============================================
// TYPES
// ============================================
export interface TransfermarktSearchResult {
  tmId: string;
  marketValue: number | null;
  marketValueRaw: string | null;
  url: string;
}

export interface TransfermarktPlayer {
  tmId: string;
  name: string;
  url: string;
  imageUrl: string | null;
  marketValue: number | null;
  marketValueRaw: string | null;
  shirtNumber: number | null;
  position: string | null;
  nationality: string[];
  birthPlace: string | null;
  height: string | null;
  foot: string | null;
  agent: string | null;
  contractExpires: string | null;
  loanFrom: string | null;
  loanExpires: string | null;
  internationalTeam: string | null;
  caps: number | null;
  goals: number | null;
  fetchedAt: string;
  expiresAt: string;
  source: 'transfermarkt.com';
}

export interface TransfermarktIndexEntry {
  tmId: string;
  name: string;
  marketValue: number | null;
  updatedAt: string;
}

// ============================================
// HELPERS
// ============================================
function parseMarketValue(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s ]+/g, '').toLowerCase();
  // Esim. "€600k", "€1.20m", "€1,20m", "€1.5bn", "-", "—"
  const match = cleaned.match(/€?([\d.,]+)\s*(k|m|bn|b)?/i);
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

/** Lookup arvon useilla mahdollisilla labeleilla (TM:n DOM on muuttunut viime
 *  vuosina) — kokeillaan ensin data-header-rakennetta ja sitten th/td-tablea. */
function pickByLabel($: cheerio.CheerioAPI, labels: string[]): string | null {
  for (const label of labels) {
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

    const th = $(`th, .definition-list__item__title`)
      .filter((_, el) =>
        $(el).text().trim().toLowerCase().startsWith(label.toLowerCase()),
      )
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
  const shirt =
    $('.data-header__shirt-number').first().text().trim() ||
    $('span.dataRueckennummer').first().text().trim();
  if (shirt) {
    const m = shirt.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function parseCapsGoals(
  raw: string | null,
): { caps: number; goals: number } | null {
  if (!raw) return null;
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

/** Firestore-yhteensopiva slug nimestä — vain ascii + alaviivat */
export function nameSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 200) || 'unknown'
  );
}

// ============================================
// VAIHE 1 — SEARCH (schnellsuche → {tmId, marketValue, url})
// ============================================
export async function searchTransfermarkt(
  name: string,
): Promise<TransfermarktSearchResult | null> {
  if (!name.trim()) return null;
  const url = `${TM_BASE}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`;
  console.log(`[tm] search: ${url}`);

  try {
    const response = await axios.get<string>(url, {
      timeout: 15000,
      headers: COMMON_HEADERS,
      maxRedirects: 5,
    });
    const $ = cheerio.load(response.data);

    // Ensimmäinen pelaajalinkki: a[href*="/profil/spieler/"]
    const firstLink = $('a[href*="/profil/spieler/"]').first();
    if (firstLink.length === 0) return null;

    const href = firstLink.attr('href') ?? '';
    const idMatch = href.match(/\/spieler\/(\d+)/);
    if (!idMatch) return null;
    const tmId = idMatch[1];
    const profileUrl = href.startsWith('http') ? href : `${TM_BASE}${href}`;

    // Markkina-arvo: etsi sama rivi (tr) ja siitä td.rechts.hauptlink
    const row = firstLink.closest('tr');
    let marketValueRaw =
      row.find('td.rechts.hauptlink').first().text().trim() || '';
    if (!marketValueRaw) {
      // Fallback: viimeinen td.rechts samalta riviltä
      marketValueRaw = row.find('td.rechts').last().text().trim();
    }
    const marketValue = marketValueRaw ? parseMarketValue(marketValueRaw) : null;

    return {
      tmId,
      marketValue,
      marketValueRaw: marketValueRaw || null,
      url: profileUrl,
    };
  } catch (error) {
    const message = error instanceof AxiosError ? error.message : String(error);
    console.error(`[tm] search failed for "${name}":`, message);
    return null;
  }
}

// ============================================
// VAIHE 1 — PROFILE SCRAPE
// ============================================
export async function scrapePlayerProfile(
  tmId: string,
): Promise<TransfermarktPlayer> {
  const url = `${TM_BASE}/x/profil/spieler/${tmId}`;
  console.log(`[tm] profile: ${url}`);

  const response = await axios.get<string>(url, {
    timeout: 20000,
    headers: COMMON_HEADERS,
    maxRedirects: 5,
  });
  const $ = cheerio.load(response.data);

  // Nimi
  const rawName = $('h1.data-header__headline-wrapper, h1[class*="headline"]')
    .first()
    .text()
    .trim();
  const name = rawName.replace(/#\s*\d+/, '').trim() || 'Tuntematon';

  // Kuva
  const imageUrl =
    $('img.data-header__profile-image').first().attr('src') ??
    $('div.data-header__profile-image img').first().attr('src') ??
    null;

  // Markkina-arvo: ensisijaisesti .tm-player-market-value-development__current
  // (uudempi DOM), fallback .data-header__market-value-wrapper.
  const marketValueRaw =
    $('.tm-player-market-value-development__current').first().text().trim() ||
    $('a.data-header__market-value-wrapper').first().text().trim() ||
    null;
  const marketValue = marketValueRaw ? parseMarketValue(marketValueRaw) : null;

  // Position: ensisijaisesti .detail-position__position, fallback label.
  const position =
    $('.detail-position__position').first().text().trim() ||
    pickByLabel($, ['Main position:', 'Position:']);

  // Sopimus + laina + perustiedot
  const contractExpires = pickByLabel($, ['Contract expires:']);
  const loanFrom = pickByLabel($, ['On loan from:']);
  const loanExpires = pickByLabel($, ['Contract there expires:']);
  const height = pickByLabel($, ['Height:']);
  const foot = pickByLabel($, ['Foot:'])?.toLowerCase() ?? null;
  const birthPlace = pickByLabel($, ['Place of birth:']);
  const nationality = splitList(pickByLabel($, ['Citizenship:', 'Nationality:']));

  // Maajoukkuetilastot
  const internationalTeam = pickByLabel($, ['Current international:']);
  const capsRaw = pickByLabel($, ['Caps/Goals:', 'Caps / Goals:']);
  const capsGoals = parseCapsGoals(capsRaw);

  // Agentti: profiilissa "Player agent:" tai "Agent:". DOM-luokkien hajoamisen
  // varalta etsitään labelilla ensin, sitten varafallback.
  const agent =
    pickByLabel($, ['Player agent:', 'Agent:']) ||
    $('.detail-position__club a, .detail-position__club span').first().text().trim() ||
    null;

  const shirtNumber = parseShirtNumber($);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  return {
    tmId,
    name,
    url,
    imageUrl: imageUrl || null,
    marketValue,
    marketValueRaw: marketValueRaw || null,
    shirtNumber,
    position: position || null,
    nationality,
    birthPlace,
    height,
    foot,
    agent: agent || null,
    contractExpires,
    loanFrom,
    loanExpires,
    internationalTeam,
    caps: capsGoals?.caps ?? null,
    goals: capsGoals?.goals ?? null,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: 'transfermarkt.com',
  };
}

// ============================================
// FIRESTORE — profile + index
// ============================================
export async function savePlayerProfile(
  profile: TransfermarktPlayer,
): Promise<void> {
  await admin
    .firestore()
    .collection('transfermarkt_players')
    .doc(profile.tmId)
    .set(profile);
}

export async function getStoredProfile(
  tmId: string,
): Promise<TransfermarktPlayer | null> {
  const doc = await admin
    .firestore()
    .collection('transfermarkt_players')
    .doc(tmId)
    .get();
  if (!doc.exists) return null;
  const data = doc.data() as TransfermarktPlayer;
  if (new Date(data.expiresAt) < new Date()) return null;
  return data;
}

export async function saveIndexEntry(
  season: number,
  name: string,
  entry: { tmId: string; marketValue: number | null },
): Promise<void> {
  await admin
    .firestore()
    .collection('transfermarkt_index')
    .doc(String(season))
    .collection('names')
    .doc(nameSlug(name))
    .set({
      tmId: entry.tmId,
      name,
      marketValue: entry.marketValue,
      updatedAt: new Date().toISOString(),
    });
}

export async function getIndexEntry(
  season: number,
  name: string,
): Promise<TransfermarktIndexEntry | null> {
  const doc = await admin
    .firestore()
    .collection('transfermarkt_index')
    .doc(String(season))
    .collection('names')
    .doc(nameSlug(name))
    .get();
  if (!doc.exists) return null;
  return doc.data() as TransfermarktIndexEntry;
}

export async function getAllIndexEntries(
  season: number,
): Promise<TransfermarktIndexEntry[]> {
  const snap = await admin
    .firestore()
    .collection('transfermarkt_index')
    .doc(String(season))
    .collection('names')
    .get();
  return snap.docs.map((d) => d.data() as TransfermarktIndexEntry);
}

// ============================================
// PUBLIC ENTRY: cache-first single-player fetch
// ============================================
export async function getOrFetchPlayer(args: {
  name: string;
  season: number;
  forceRefresh?: boolean;
}): Promise<TransfermarktPlayer | null> {
  // 1) Lookup index
  if (!args.forceRefresh) {
    const indexed = await getIndexEntry(args.season, args.name);
    if (indexed) {
      const cached = await getStoredProfile(indexed.tmId);
      if (cached) return cached;
    }
  }

  // 2) Live search + scrape
  const search = await searchTransfermarkt(args.name);
  if (!search) return null;

  await sleep(800);
  const profile = await scrapePlayerProfile(search.tmId);

  await savePlayerProfile(profile);
  await saveIndexEntry(args.season, args.name, {
    tmId: search.tmId,
    marketValue: search.marketValue ?? profile.marketValue,
  });

  return profile;
}

// ============================================
// VAIHE 2 — BATCH: kaikki U23-pelaajat youthAggregationista
// ============================================
export async function scrapeAllU23Players(
  season: number,
  limit?: number,
  offset?: number,
): Promise<
  Array<{ name: string; tmId: string; marketValue: number | null }>
> {
  const agg = await dataAggregator.getYouthAggregation(season);
  // topYouthPlayers on backendissä jo cap:attu 20:een. Sovelletaan vielä
  // tämän päälle valinnainen limit/offset-paginointi jotta yksittäinen
  // refresh ei kestä liian kauan Cloud Functions -timeout-rajaan nähden
  // (n. 60 s @ 2 s/pelaaja → batch 5 mahtuu reilusti).
  const cap = 20;
  const start = Math.max(0, offset ?? 0);
  const end = limit !== undefined ? Math.min(cap, start + limit) : cap;
  const players = agg.topYouthPlayers.slice(start, end);
  console.log(
    `[tm-batch] season=${season} slice=[${start},${end}) total=${agg.topYouthPlayers.length}`,
  );

  const results: Array<{
    name: string;
    tmId: string;
    marketValue: number | null;
  }> = [];

  for (const p of players) {
    try {
      // Hakusana: pelkkä sukunimi (viimeinen sana). Luotettavampi kuin
      // koko nimi koska API-Football voi palauttaa "O. Ruoppi" mutta TM
      // listaa "Otto Ruoppi" — etunimien kirjoituseroavaisuudet eivät
      // haittaa kun haetaan vain sukunimellä.
      const surname =
        p.playerName.split(/\s+/).filter(Boolean).pop() ?? p.playerName;
      console.log(
        `[tm-batch] processing: ${p.playerName} (haku: "${surname}")`,
      );
      const search = await searchTransfermarkt(surname);
      if (!search) {
        console.warn(`[tm-batch] no TM hit for "${surname}" (${p.playerName})`);
        await sleep(BATCH_DELAY_MS);
        continue;
      }

      // Pieni viive search→profile välillä
      await sleep(800);
      const profile = await scrapePlayerProfile(search.tmId);

      await savePlayerProfile(profile);
      await saveIndexEntry(season, p.playerName, {
        tmId: search.tmId,
        marketValue: search.marketValue ?? profile.marketValue,
      });

      results.push({
        name: p.playerName,
        tmId: search.tmId,
        marketValue: search.marketValue ?? profile.marketValue,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[tm-batch] failed for ${p.playerName}:`, message);
    }

    // 2 s viive pelaajien välillä (rate limit)
    await sleep(BATCH_DELAY_MS);
  }

  console.log(
    `[tm-batch] season=${season} processed=${players.length} stored=${results.length}`,
  );
  return results;
}
