// ============================================
// SOFASCORE — diagnostinen scraper
// Lähde: Sofascoren epävirallinen JSON-API (api.sofascore.com/api/v1)
// Käyttö: GET /api/debug/sofascore?name=Otto+Ruoppi (admin-suojattu)
//
// Tarkoitus: selvittää TOIMIIKO Sofascore-haku Cloud Functions
// -ympäristöstä (datacenter-IP). Sofascore on Cloudflaren takana ja
// saattaa blokata konesali-IP:t — tämä endpoint paljastaa sen suoraan
// palauttamalla raakadatan TAI virheviestin per vaihe.
//
// HUOM: käytetään repoon jo asennettua axiosia (ei lisätä riippuvuutta).
// ============================================
import axios, { AxiosError } from 'axios';

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';

// Sofascore vaatii selainmaisen User-Agentin + Refererin, muuten 403.
const SOFASCORE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.sofascore.com/',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const REQUEST_TIMEOUT_MS = 15000;

/** Yhden hakuosuman siistitty muoto. `raw` sisältää alkuperäisen entityn. */
export interface SofascorePlayerHit {
  id: number;
  name: string;
  slug: string | null;
  team: string | null;
  country: string | null;
  raw: unknown;
}

/** Normalisoi axios-/verkkovirhe diagnostiseksi merkkijonoksi + statukseksi. */
function describeError(err: unknown): { message: string; status: number | null; body: unknown } {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError;
    return {
      message: ax.message,
      status: ax.response?.status ?? null,
      // Sofascoren virherunko voi olla iso HTML (Cloudflare) — leikataan.
      body:
        typeof ax.response?.data === 'string'
          ? (ax.response?.data as string).slice(0, 500)
          : ax.response?.data ?? null,
    };
  }
  return {
    message: err instanceof Error ? err.message : 'Tuntematon virhe',
    status: null,
    body: null,
  };
}

/**
 * VAIHE 1 — hae pelaajan ID nimellä.
 * GET https://api.sofascore.com/api/v1/search/players?q={name}
 * Palauttaa ensimmäisen player-tyyppisen osuman + koko raakavastauksen.
 */
export async function searchPlayer(
  name: string,
): Promise<{ hit: SofascorePlayerHit | null; raw: unknown }> {
  const url = `${SOFASCORE_BASE}/search/players?q=${encodeURIComponent(name)}`;
  console.log(`[sofascore] search GET ${url}`);

  const res = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: SOFASCORE_HEADERS,
  });

  const data = res.data as Record<string, unknown>;

  // Sofascore on palauttanut ajan mittaan kahta muotoa:
  //   { results: [ { type: 'player', entity: {...} } ] }
  //   { players: [ {...} ] }
  // Käsitellään molemmat defensiivisesti.
  const results = Array.isArray(data?.results) ? (data.results as Record<string, unknown>[]) : [];
  const players = Array.isArray(data?.players) ? (data.players as Record<string, unknown>[]) : [];

  let entity: Record<string, unknown> | null = null;
  if (results.length > 0) {
    const playerResult =
      results.find((r) => r.type === 'player' && r.entity) ?? results[0];
    entity = (playerResult?.entity as Record<string, unknown>) ?? null;
  } else if (players.length > 0) {
    entity = players[0];
  }

  const hit: SofascorePlayerHit | null = entity
    ? {
        id: Number(entity.id),
        name: String(entity.name ?? ''),
        slug: (entity.slug as string) ?? null,
        team: ((entity.team as Record<string, unknown> | undefined)?.name as string) ?? null,
        country:
          ((entity.country as Record<string, unknown> | undefined)?.name as string) ?? null,
        raw: entity,
      }
    : null;

  return { hit, raw: res.data };
}

/**
 * VAIHE 2 — hae pelaajan per-ottelu tilastot ID:llä.
 * GET https://api.sofascore.com/api/v1/player/{id}/events/0
 * Palauttaa raakavastauksen sellaisenaan (diagnostiikkaa varten).
 */
export async function getPlayerEvents(playerId: number): Promise<unknown> {
  const url = `${SOFASCORE_BASE}/player/${playerId}/events/0`;
  console.log(`[sofascore] events GET ${url}`);

  const res = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: SOFASCORE_HEADERS,
  });
  return res.data;
}

/** Yhden vaiheen diagnostinen tulos. */
interface StepResult {
  status: 'ok' | 'error' | 'skipped';
  error?: string;
  httpStatus?: number | null;
  body?: unknown;
  raw?: unknown;
}

/** Koko diagnostiikan tulos. */
export interface SofascoreDebugResult {
  ok: boolean;
  query: string;
  playerId: number | null;
  playerName: string | null;
  search: StepResult;
  events: StepResult;
}

/**
 * Orkestroi molemmat vaiheet: nimi → ID → per-ottelu tilastot.
 * EI heitä poikkeusta — palauttaa aina diagnostisen objektin, jotta
 * /api/debug/sofascore voi näyttää raakadatan tai virheviestin.
 */
export async function debugSofascore(name: string): Promise<SofascoreDebugResult> {
  const result: SofascoreDebugResult = {
    ok: false,
    query: name,
    playerId: null,
    playerName: null,
    search: { status: 'error' },
    events: { status: 'skipped' },
  };

  // VAIHE 1 — haku
  let hit: SofascorePlayerHit | null = null;
  try {
    const search = await searchPlayer(name);
    hit = search.hit;
    result.search = { status: 'ok', raw: search.raw };
    result.playerId = hit?.id ?? null;
    result.playerName = hit?.name ?? null;
  } catch (err) {
    const e = describeError(err);
    result.search = { status: 'error', error: e.message, httpStatus: e.status, body: e.body };
    return result;
  }

  if (!hit || !Number.isFinite(hit.id)) {
    result.search.error = `Pelaajaa "${name}" ei löytynyt Sofascoren haulla`;
    result.events = { status: 'skipped', error: 'Ei pelaaja-ID:tä — vaihe 2 ohitettu' };
    return result;
  }

  // VAIHE 2 — per-ottelu tilastot
  try {
    const events = await getPlayerEvents(hit.id);
    result.events = { status: 'ok', raw: events };
    result.ok = true;
  } catch (err) {
    const e = describeError(err);
    result.events = { status: 'error', error: e.message, httpStatus: e.status, body: e.body };
  }

  return result;
}
