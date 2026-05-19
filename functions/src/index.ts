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

// Region: kaikki funktiot deployataan europe-west1:een (sama kuin TalentMaster-sisarprojekti)
const REGION = 'europe-west1';

// Initialize Firebase Admin (guard prevents double-init when container reuses module)
if (!admin.apps.length) {
  admin.initializeApp();
}

// API_VERSION: muuta tätä joka deployssa, jotta Firebase tunnistaa muutoksen.
// RAPIDAPI_KEY-tarkistus on siirretty footballApi-luokan request-interceptoriin,
// koska module-load-aikana process.env ei välttämättä ole vielä asetettu.
const API_VERSION = '1.1.0'; // youth-stats pagination + 3 sarjaa

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
