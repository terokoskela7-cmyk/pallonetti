// ============================================
// PALLOTALENTTI.FI - Firebase Backend
// API endpoints + scheduled functions
// ============================================
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { dataAggregator } from './services/dataAggregator';
import { cacheService } from './services/cacheService';
import { footballApi } from './api/footballApi';
import { fbrefApi } from './api/fbrefApi';
import { transfermarktApi } from './api/transfermarktApi';
import {
  scrapeVeikkausliigaPlayers,
  saveVeikkausliigaPlayers,
  scrapeAndSave,
  getOfficialStats,
} from './scrapers/veikkausliiga';
import {
  getOrFetchPlayer as tmGetOrFetchPlayer,
  scrapeAllU23Players,
  getAllIndexEntries,
} from './scrapers/transfermarkt';

// Region: kaikki funktiot deployataan europe-west1:een (sama kuin TalentMaster-sisarprojekti)
const REGION = 'europe-west1';

// Initialize Firebase Admin (guard prevents double-init when container reuses module)
if (!admin.apps.length) {
  admin.initializeApp();
}

// API_VERSION: muuta tätä joka deployssa, jotta Firebase tunnistaa muutoksen.
// RAPIDAPI_KEY-tarkistus on siirretty footballApi-luokan request-interceptoriin,
// koska module-load-aikana process.env ei välttämättä ole vielä asetettu.
const API_VERSION = '1.6.1'; // fix: topYouthPlayers-epävakaus (cache poisoning + clearType + ID-join)

// ============================================
// Express API App
// ============================================
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pallotalentti-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SEASONS
// ============================================

/** GET /api/seasons - List all available seasons */
app.get('/api/seasons', (_req, res) => {
  const seasons = footballApi.getAllSeasons();
  res.json({
    success: true,
    data: seasons,
    cached: false,
    source: 'config',
    timestamp: new Date().toISOString(),
  });
});

/** GET /api/seasons/:year - Get season details */
app.get('/api/seasons/:year', (req, res) => {
  const year = parseInt(req.params.year);
  const season = footballApi.getSeasonInfo(year);
  if (!season) {
    res.status(404).json({
      success: false,
      error: `Season ${year} not found`,
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.json({
    success: true,
    data: season,
    cached: false,
    source: 'config',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// STANDINGS
// ============================================

/** GET /api/standings/:season - League table */
app.get('/api/standings/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const standings = await dataAggregator.getStandings(season);
    res.json({
      success: true,
      data: standings,
      cached: false, // Will be set by cache service
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Standings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standings',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// TEAMS
// ============================================

/** GET /api/teams/:season - List teams */
app.get('/api/teams/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const teams = await footballApi.getTeams(season);
    res.json({
      success: true,
      data: teams.map((t) => ({
        id: String(t.team.id),
        name: t.team.name,
        shortName: t.team.code,
        tla: t.team.code,
        venue: t.venue.name,
        founded: t.team.founded,
        clubColors: '',
        website: '',
        crestUrl: t.team.logo,
        address: t.venue.address,
      })),
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teams',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/teams/:season/:teamId/players - Team players */
app.get('/api/teams/:season/:teamId/players', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const teamId = req.params.teamId;
    const players = await dataAggregator.getTeamPlayers(season, teamId);
    res.json({
      success: true,
      data: players,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Team players error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team players',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// PLAYERS
// ============================================

/** GET /api/players/:season - All players with stats */
app.get('/api/players/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const { teamId, position, minAge, maxAge, minMinutes, sortBy, limit } = req.query;

    let players = await dataAggregator.getPlayerStats(season, teamId as string);

    // Apply filters
    if (position) {
      players = players.filter((p) =>
        p.teamName.toLowerCase().includes((position as string).toLowerCase())
      );
    }
    if (minMinutes) {
      players = players.filter((p) => p.minutesPlayed >= parseInt(minMinutes as string));
    }

    // Sort
    const sortField = (sortBy as string) || 'minutesPlayed';
    players.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] as number;
      const bVal = b[sortField as keyof typeof b] as number;
      return (bVal || 0) - (aVal || 0);
    });

    // Limit
    const result = limit ? players.slice(0, parseInt(limit as string)) : players;

    res.json({
      success: true,
      data: result,
      count: result.length,
      cached: false,
      source: 'api-football+fbref',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Players error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch players',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/players/:season/market-values - Players with market values */
app.get('/api/players/:season/market-values', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const players = await dataAggregator.getPlayersWithMarketValues(season);
    res.json({
      success: true,
      data: players,
      cached: false,
      source: 'api-football+transfermarkt',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market values error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market values',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/player/:playerId/season/:season - Yksittäisen pelaajan kauden
 *  tilastot suoraan API-Footballista. Cachetetaan Firestore-kokoelmaan
 *  `players_cache/{season}_{playerId}` 24 tunniksi. Frontend voi käyttää tätä
 *  kehityskäyrän ja täydellisen pelaajakortin rakentamiseen. */
app.get('/api/player/:playerId/season/:season', async (req, res) => {
  const playerId = parseInt(req.params.playerId, 10);
  const season = parseInt(req.params.season, 10);

  if (isNaN(playerId) || isNaN(season)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid playerId or season — both must be integers',
      timestamp: new Date().toISOString(),
    });
  }

  const docRef = admin
    .firestore()
    .collection('players_cache')
    .doc(`${season}_${playerId}`);

  try {
    // 1. Tarkista cache
    const cached = await docRef.get();
    if (cached.exists) {
      const cachedData = cached.data() as {
        data: unknown;
        expiresAt: string;
      };
      if (new Date(cachedData.expiresAt) > new Date()) {
        return res.json({
          success: true,
          data: cachedData.data,
          cached: true,
          source: 'api-football',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Hae API-Footballista
    const fresh = await footballApi.getPlayerById(playerId, season);

    // 3. Tallenna 24 h ajaksi
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await docRef.set({
      data: fresh,
      cachedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: 'api-football',
    });

    return res.json({
      success: true,
      data: fresh,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Player ${playerId} season ${season} fetch error:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch player season data',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/player/:playerId/fixtures?season=2026 - Pelaajan kierroskohtaiset
 *  tilastot kaudelta. Hakee joukkueen kaikki ottelut, lukee per-ottelun
 *  /fixtures/players-vastauksesta pelaajan rivin, palauttaa siistityn arrayn.
 *  Cachetetaan Firestoreen `player_fixtures/{season}_{playerId}` 24 h ajaksi. */
app.get('/api/player/:playerId/fixtures', async (req, res) => {
  const playerId = req.params.playerId;
  const season = parseInt(String(req.query.season ?? new Date().getFullYear()), 10);
  if (!playerId || isNaN(season)) {
    return res.status(400).json({
      success: false,
      error: 'playerId tai season puuttuu/virheellinen',
    });
  }

  const docRef = admin
    .firestore()
    .collection('player_fixtures')
    .doc(`${season}_${playerId}`);

  try {
    // 1. Cache check
    const cached = await docRef.get();
    if (cached.exists) {
      const cachedData = cached.data() as {
        data: unknown;
        expiresAt: string;
      };
      if (new Date(cachedData.expiresAt) > new Date()) {
        return res.json({
          success: true,
          data: cachedData.data,
          cached: true,
          source: 'api-football',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Etsi pelaajan teamId youthAggregationista
    const agg = await dataAggregator.getYouthAggregation(season);
    const player = agg.topYouthPlayers.find((p) => p.playerId === playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Pelaajaa ei löytynyt youthAggregationista (ei top-20:ssa)',
      });
    }
    const teamId = parseInt(player.teamId, 10);
    if (isNaN(teamId)) {
      return res
        .status(500)
        .json({ success: false, error: 'teamId on virheellinen' });
    }

    // 3. Hae joukkueen ottelut, suodata FT-tilanteeseen
    const allFixtures = await footballApi.getTeamFixtures(teamId, season);
    const finished = allFixtures.filter(
      (f) => f.fixture.status.short === 'FT',
    );

    // 4. Per ottelu: hae player-stats ja poimi pelaajan rivi.
    //    Promise.all rinnakkain — API-Football Pro tukee n. 30 req/min.
    const results = await Promise.all(
      finished.map(async (f) => {
        let entry: {
          minutes: number;
          goals: number;
          assists: number;
          rating: number | null;
        } | null = null;
        try {
          const stats = await footballApi.getFixturePlayerStats(f.fixture.id);
          for (const teamGroup of stats) {
            for (const p of teamGroup.players) {
              if (String(p.player.id) === playerId) {
                const s = p.statistics[0];
                entry = {
                  minutes: s?.games?.minutes ?? 0,
                  goals: s?.goals?.total ?? 0,
                  assists: s?.goals?.assists ?? 0,
                  rating: s?.games?.rating
                    ? parseFloat(s.games.rating)
                    : null,
                };
                break;
              }
            }
            if (entry) break;
          }
        } catch (err) {
          console.error(
            `[player-fixtures] stats fetch failed for fixture ${f.fixture.id}:`,
            err instanceof Error ? err.message : err,
          );
        }
        return {
          round: f.league.round,
          date: f.fixture.date,
          minutes: entry?.minutes ?? 0,
          goals: entry?.goals ?? 0,
          assists: entry?.assists ?? 0,
          rating: entry?.rating ?? null,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          score:
            f.goals.home != null && f.goals.away != null
              ? `${f.goals.home}-${f.goals.away}`
              : null,
        };
      }),
    );

    // 5. Tallenna cacheen 24 h ajaksi
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await docRef.set({
      data: results,
      cachedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: 'api-football',
    });

    return res.json({
      success: true,
      data: results,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error(`[player-fixtures] failed for ${playerId}:`, message);
    return res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/team-market-values - Team market value totals */
app.get('/api/team-market-values', async (_req, res) => {
  try {
    const values = await dataAggregator.getTeamMarketValues();
    res.json({
      success: true,
      data: values,
      cached: false,
      source: 'transfermarkt',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Team market values error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team market values',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// YOUTH STATS (Core feature - like Bolldata)
// ============================================

/** GET /api/youth-stats/:season - Youth playing time by team */
app.get('/api/youth-stats/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const { ageGroup } = req.query;
    const stats = await dataAggregator.getYouthStats(season);

    // Filter by age group if specified
    let result = stats;
    if (ageGroup) {
      const ag = ageGroup as string;
      result = stats.map((s) => ({
        ...s,
        // Return only the requested age group's percentage
        youthPercentage:
          ag === 'u23'
            ? s.youthPercentageU23
            : ag === 'u21'
            ? s.youthPercentageU21
            : ag === 'u20'
            ? s.youthPercentageU20
            : ag === 'u19'
            ? s.youthPercentageU19
            : ag === 'u18'
            ? s.youthPercentageU18
            : s.youthPercentageU21,
      }));
    }

    res.json({
      success: true,
      data: result,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Youth stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch youth stats',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/youth-stats/:season/all - Youth playing time for 3 leagues
 * Palauttaa Veikkausliiga (244), Ykkösliiga (245), Ykkönen (246) yhtenä objektina.
 * Cache: 3 erillistä cache-avainta (per liiga), TTL 6h.
 */
app.get('/api/youth-stats/:season/all', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    // League ID:t API-Footballin /leagues?country=Finland -endpointista (2026-05-17):
    //   Veikkausliiga=244, Ykkösliiga=1087 (NOT 245), Ykkönen=245 (NOT 246)
    const [veikkausliiga, ykkosliiga, ykkonen] = await Promise.all([
      dataAggregator.getYouthStats(season, 244),
      dataAggregator.getYouthStats(season, 1087),
      dataAggregator.getYouthStats(season, 245),
    ]);
    res.json({
      success: true,
      data: { veikkausliiga, ykkosliiga, ykkonen },
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Youth stats (all leagues) error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch youth stats for all leagues',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/youth-aggregation/:season - League-wide youth summary */
app.get('/api/youth-aggregation/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const aggregation = await dataAggregator.getYouthAggregation(season);
    res.json({
      success: true,
      data: aggregation,
      cached: false,
      source: 'aggregator',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Youth aggregation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch youth aggregation',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/u21-round-trend/:season — kierroskohtainen U21 peliaika-%.
 *
 * Iteroi kauden päättyneet (FT) Veikkausliiga-ottelut ja laskee per kierros
 * U21-pelaajien minuutit suhteessa kaikkiin pelattuihin minuutteihin. U21 =
 * syntymävuosi >= (season - 21), eli kaudella 2026 syntynyt 2005 tai myöhemmin.
 * Sama ikäraja kuin youthPercentageU21-KPI (ikä <= 21) — trendi ja KPI
 * mittaavat täsmälleen samaa joukkoa.
 * Sama datalähde kuin youth-stats (API-Football). Cachetetaan Firestore-
 * kokoelmaan `u21_round_trend/{season}` 6 tunniksi (raskas: ~1 kutsu/ottelu).
 *
 * Palauttaa: { round, u21Pct, u21Mins, totalMins }[] kierroksittain (vain
 * kierrokset joissa totalMins > 0).
 */
app.get('/api/u21-round-trend/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    return res.status(400).json({
      success: false,
      error: 'season on virheellinen',
      timestamp: new Date().toISOString(),
    });
  }

  const docRef = admin
    .firestore()
    .collection('u21_round_trend')
    .doc(String(season));

  // "Regular Season - 7" → 7
  const parseRound = (round: string): number => {
    const m = round.match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  };

  try {
    // 1. Cache check
    const cached = await docRef.get();
    if (cached.exists) {
      const cachedData = cached.data() as { data: unknown; expiresAt: string };
      if (new Date(cachedData.expiresAt) > new Date()) {
        return res.json({
          success: true,
          data: cachedData.data,
          cached: true,
          source: 'api-football',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Syntymävuodet U21-luokitusta varten (sama datalähde kuin youth-stats).
    //    U21 = syntynyt season-21 tai myöhemmin (2026 → 2005). Sama joukko kuin
    //    youthPercentageU21-KPI (ikä <= 21).
    const U21_MIN_BIRTH_YEAR = season - 21;
    const players = await footballApi.getPlayers(season);
    const birthYearById = new Map<number, number>();
    for (const p of players) {
      const year = p.player.birth?.date
        ? parseInt(p.player.birth.date.split('-')[0], 10)
        : NaN;
      if (!isNaN(year)) birthYearById.set(p.player.id, year);
    }

    // 3. Kauden päättyneet ottelut.
    const fixtures = await footballApi.getFixtures(season);
    const finished = fixtures.filter((f) => f.fixture.status.short === 'FT');

    // 4. Per ottelu: hae pelaajaminuutit ja summaa kierroksittain.
    //    Rajattu rinnakkaisuus suojaa API-Football-rate-limitiltä ja
    //    Cloud Functions -timeoutilta kun otteluita on kymmeniä.
    const roundAgg = new Map<number, { u21: number; total: number }>();
    const CONCURRENCY = 8;
    for (let i = 0; i < finished.length; i += CONCURRENCY) {
      const batch = finished.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (f) => {
          const round = parseRound(f.league.round);
          if (round <= 0) return;
          let stats;
          try {
            stats = await footballApi.getFixturePlayerStats(f.fixture.id);
          } catch (err) {
            console.error(
              `[u21-round-trend] fixture ${f.fixture.id} stats failed:`,
              err instanceof Error ? err.message : err,
            );
            return;
          }
          const acc = roundAgg.get(round) ?? { u21: 0, total: 0 };
          for (const teamGroup of stats) {
            for (const pl of teamGroup.players) {
              const mins = pl.statistics?.[0]?.games?.minutes ?? 0;
              if (!mins) continue;
              acc.total += mins;
              const by = birthYearById.get(pl.player.id);
              if (by !== undefined && by >= U21_MIN_BIRTH_YEAR) acc.u21 += mins;
            }
          }
          roundAgg.set(round, acc);
        }),
      );
    }

    // 5. Muodosta array, vain kierrokset joissa pelattuja minuutteja.
    const trend = [...roundAgg.entries()]
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([round, v]) => ({
        round,
        u21Pct: Math.round((v.u21 / v.total) * 1000) / 10,
        u21Mins: v.u21,
        totalMins: v.total,
      }));

    // 6. Tallenna cacheen 6 h ajaksi.
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await docRef.set({
      data: trend,
      cachedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: 'api-football',
    });

    return res.json({
      success: true,
      data: trend,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[u21-round-trend] failed:', message);
    return res.status(500).json({
      success: false,
      error: 'Failed to compute U21 round trend',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// MATCHES
// ============================================

/** GET /api/matches/:season - All matches */
app.get('/api/matches/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const { status, teamId } = req.query;
    const matches = await dataAggregator.getMatches(season, status as string);

    // Filter by team if specified
    const result = teamId
      ? matches.filter(
          (m) => m.homeTeamId === teamId || m.awayTeamId === teamId
        )
      : matches;

    res.json({
      success: true,
      data: result,
      count: result.length,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch matches',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/matches/:season/upcoming - Upcoming fixtures */
app.get('/api/matches/:season/upcoming', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const matches = await dataAggregator.getMatches(season, 'upcoming');
    res.json({
      success: true,
      data: matches,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Upcoming matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming matches',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/matches/:season/recent - Recent results */
app.get('/api/matches/:season/recent', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const matches = await dataAggregator.getMatches(season, 'recent');
    res.json({
      success: true,
      data: matches,
      cached: false,
      source: 'api-football',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Recent matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent matches',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// FBref ADVANCED STATS
// ============================================

/** GET /api/fbref/:season/players - FBref detailed stats */
app.get('/api/fbref/:season/players', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const stats = await fbrefApi.scrapePlayerStats(season);
    const transformed = fbrefApi.transformToPlayerStats(stats, season);
    res.json({
      success: true,
      data: transformed,
      cached: false,
      source: 'fbref',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('FBref error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FBref stats',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/fbref/:season/standings - FBref standings */
app.get('/api/fbref/:season/standings', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const standings = await fbrefApi.scrapeStandings(season);
    res.json({
      success: true,
      data: standings || [],
      cached: false,
      source: 'fbref',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('FBref standings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FBref standings',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// TRANSFERMARKT
// ============================================

/** GET /api/transfermarkt/players - All players with market values */
app.get('/api/transfermarkt/players', async (_req, res) => {
  try {
    const players = await transfermarktApi.getAllVeikkausliigaPlayers();
    res.json({
      success: true,
      data: players,
      cached: false,
      source: 'transfermarkt',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Transfermarkt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Transfermarkt data',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/transfermarkt/team-values - Team market values */
app.get('/api/transfermarkt/team-values', async (_req, res) => {
  try {
    const values = await transfermarktApi.getTeamMarketValues();
    res.json({
      success: true,
      data: values,
      cached: false,
      source: 'transfermarkt',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Transfermarkt team values error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team values',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// ADMIN / MAINTENANCE
// ============================================

/** POST /api/admin/refresh/:season - Force refresh all data */
app.post('/api/admin/refresh/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const result = await dataAggregator.refreshSeason(season);
    res.json({
      success: true,
      data: result,
      message: `Refreshed data for season ${season}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh data',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/admin/cache-stats - Cache statistics */
app.get('/api/admin/cache-stats', async (_req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// VEIKKAUSLIIGA.COM SCRAPER
// ============================================

/** Admin-key middleware. Vaadi process.env.ADMIN_KEY ja x-admin-key -header. */
function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    console.warn('[admin] ADMIN_KEY ei ole konfiguroitu — admin-endpointit pois käytöstä');
    res.status(503).json({
      success: false,
      error: 'Admin-endpoint ei ole konfiguroitu palvelimelle',
    });
    return;
  }
  const provided = req.header('x-admin-key');
  if (provided !== expected) {
    res.status(401).json({ success: false, error: 'Virheellinen tai puuttuva x-admin-key' });
    return;
  }
  next();
}

/** GET /api/scrape/veikkausliiga?year=2026 - Käynnistä scrape, tallenna Firestoreen */
app.get('/api/scrape/veikkausliiga', requireAdminKey, async (req, res) => {
  try {
    const year = parseInt(String(req.query.year ?? ''), 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ success: false, error: 'year-parametri puuttuu tai on virheellinen' });
      return;
    }
    const players = await scrapeVeikkausliigaPlayers(year);
    const result = await saveVeikkausliigaPlayers(year, players);
    res.json({
      success: true,
      count: result.count,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[scrape/veikkausliiga] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/official-stats/:year - Julkinen: Veikkausliiga.com:n tallennetut tilastot */
app.get('/api/official-stats/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      res.status(400).json({ success: false, error: 'year-parametri on virheellinen' });
      return;
    }
    const { players, meta } = await getOfficialStats(year);
    res.json({
      success: true,
      data: players,
      meta,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[official-stats] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// TRANSFERMARKT SCRAPER (v2 — U23-fokus, name-index)
// ============================================

/** GET /api/transfermarkt/player/:name — julkinen, cache-first.
 *  Etsii transfermarkt_index/{season}/names/{slug} → tmId, lukee
 *  transfermarkt_players/{tmId}. Jos ei cachessa, tekee live-haun.
 *  season-query (oletus nykyvuosi). */
app.get('/api/transfermarkt/player/:name', async (req, res) => {
  const name = req.params.name?.trim();
  const season = parseInt(
    String(req.query.season ?? new Date().getFullYear()),
    10,
  );
  if (!name) {
    return res
      .status(400)
      .json({ success: false, error: 'name-parametri puuttuu URL-polusta' });
  }
  if (isNaN(season)) {
    return res
      .status(400)
      .json({ success: false, error: 'season-parametri on virheellinen' });
  }
  try {
    const profile = await tmGetOrFetchPlayer({ name, season });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Pelaajaa ei löytynyt Transfermarktista',
      });
    }
    return res.json({
      success: true,
      data: profile,
      source: 'transfermarkt.com',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[tm/player] failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/** POST /api/transfermarkt/refresh — admin: ajaa scrapeAllU23Players.
 *  Query/body: season (oletus nykyvuosi), limit (esim. 5), offset (esim. 0).
 *  Batchaa työn pieniin osiin jotta Cloud Functions -timeout (60 s) ei osu:
 *    POST /api/transfermarkt/refresh?season=2026&limit=5&offset=0
 *    POST /api/transfermarkt/refresh?season=2026&limit=5&offset=5  ...
 *  Ilman limit/offset käsittelee koko U23-listan (max 20). */
app.post('/api/transfermarkt/refresh', requireAdminKey, async (req, res) => {
  const seasonRaw =
    (req.body && req.body.season) ?? req.query.season ?? new Date().getFullYear();
  const season = parseInt(String(seasonRaw), 10);
  if (isNaN(season)) {
    return res
      .status(400)
      .json({ success: false, error: 'season-parametri on virheellinen' });
  }

  const limitRaw =
    (req.body && req.body.limit) ?? req.query.limit ?? undefined;
  const offsetRaw =
    (req.body && req.body.offset) ?? req.query.offset ?? undefined;
  const limit =
    limitRaw !== undefined ? parseInt(String(limitRaw), 10) : undefined;
  const offset =
    offsetRaw !== undefined ? parseInt(String(offsetRaw), 10) : undefined;
  if (
    (limit !== undefined && (isNaN(limit) || limit < 1)) ||
    (offset !== undefined && (isNaN(offset) || offset < 0))
  ) {
    return res.status(400).json({
      success: false,
      error: 'limit/offset on virheellinen (limit >= 1, offset >= 0)',
    });
  }

  try {
    const players = await scrapeAllU23Players(season, limit, offset);
    return res.json({
      success: true,
      count: players.length,
      offset: offset ?? 0,
      limit: limit ?? null,
      players,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[tm/refresh] failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/transfermarkt/league/:season — julkinen, palauttaa kauden
 *  kaikki indeksoidut U23-pelaajat (name, tmId, marketValue). */
app.get('/api/transfermarkt/league/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    return res
      .status(400)
      .json({ success: false, error: 'season on virheellinen' });
  }
  try {
    const entries = await getAllIndexEntries(season);
    return res.json({
      success: true,
      data: entries,
      count: entries.length,
      source: 'transfermarkt.com',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[tm/league] failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/** POST /api/admin/cache-cleanup - Clean expired cache */
app.post('/api/admin/cache-cleanup', async (_req, res) => {
  try {
    const deleted = await cacheService.cleanup();
    res.json({
      success: true,
      data: { deleted },
      message: `Cleaned up ${deleted} expired cache entries`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup cache',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// Firebase Functions Export
// ============================================

/** Main API function - handles all /api/* routes */
export const api = functions.region(REGION).https.onRequest(app);

/** Scheduled: Refresh data every 2 hours during season */
export const scheduledDataRefresh = functions.region(REGION).pubsub
  .schedule('0 */2 * * *') // Every 2 hours
  .timeZone('Europe/Helsinki')
  .onRun(async (context) => {
    console.log('Starting scheduled data refresh:', context.timestamp);
    try {
      // Refresh current season (2026)
      await dataAggregator.refreshSeason(2026);
      // Also refresh previous season for comparison
      await dataAggregator.refreshSeason(2025);
      console.log('Scheduled refresh completed successfully');
    } catch (error) {
      console.error('Scheduled refresh failed:', error);
    }
  });

/** Scheduled: Cache cleanup daily */
export const scheduledCacheCleanup = functions.region(REGION).pubsub
  .schedule('0 3 * * *') // Daily at 3 AM Helsinki
  .timeZone('Europe/Helsinki')
  .onRun(async () => {
    console.log('Starting cache cleanup');
    try {
      const deleted = await cacheService.cleanup();
      console.log(`Cache cleanup completed: ${deleted} entries removed`);
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  });

/** Scheduled: Ajaa kerran päivässä yöllä — virallinen Veikkausliiga.com data */
export const scheduledVeikkausliigaScrape = functions
  .region(REGION)
  .pubsub.schedule('0 1 * * *') // klo 01:00 Helsingin aikaa (timeZone alla muuntaa)
  .timeZone('Europe/Helsinki')
  .onRun(async () => {
    const year = new Date().getFullYear();
    console.log(`[scheduledVeikkausliigaScrape] starting for year=${year}`);
    try {
      const result = await scrapeAndSave(year);
      console.log(
        `[scheduledVeikkausliigaScrape] saved ${result.count} players @ ${result.updatedAt}`,
      );
    } catch (error) {
      console.error('[scheduledVeikkausliigaScrape] failed:', error);
    }
  });

// Transfermarkt-cron poistettu — ajetaan manuaalisesti admin-endpointilla
// POST /api/transfermarkt/refresh (x-admin-key). Cron palautetaan kun Cloud
// Scheduler -oikeudet on konfiguroitu Firebase Consolessa.

/** HTTP: Manual trigger for data refresh */
export const refreshData = functions.region(REGION).https.onRequest(async (req, res) => {
  const season = parseInt(req.query.season as string) || 2026;
  try {
    console.log(`Manual refresh triggered for season ${season}`);
    const result = await dataAggregator.refreshSeason(season);
    res.json({
      success: true,
      data: result,
      message: `Refreshed data for season ${season}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'Refresh failed',
      timestamp: new Date().toISOString(),
    });
  }
});
