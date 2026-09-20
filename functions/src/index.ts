// ============================================
// PALLOTALENTTI.FI - Firebase Backend
// API endpoints + scheduled functions
// ============================================
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Busboy from 'busboy';
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
  scrapeAllYouthPlayers,
  getAllIndexEntries,
} from './scrapers/transfermarkt';
import { debugSofascore } from './scrapers/sofascore';
import {
  lueKausi,
  laskeJoukkueidenOsuudet,
  laskeKaudenPelaajat,
  laskeJoukkueet,
  laskeLiigaYhteenveto,
  laskeTopPelaajat,
  paatteleIkahaarukka,
} from './services/kausiData';
import { haeSiirto } from './services/siirrot';
import {
  laskeTrendit,
  laskeKolmijako,
  luokitteleKansalaisuudet,
} from './services/trendit';
import { ALLE_21_MAX, NUORET_MAX } from './services/ikarajat';
import { parseExcelBuffer, writeRoundData } from './services/excelImport';
import { parsiKausiExcel, VIESTI_VAARA_SARJA } from './services/kausiImport';
import {
  esikatseleKausituonti,
  kirjoitaKausituonti,
} from './services/kausiImportKirjoitus';
import {
  luoAgent,
  asetaAgent,
  haeLista,
  haeProfiili,
  nimetTasmaavat,
  seuraAvain,
  vahvistaSeura,
} from './services/kansalaisuus';

// Region: kaikki funktiot deployataan europe-west1:een (sama kuin TalentMaster-sisarprojekti)
const REGION = 'europe-west1';

/**
 * Markkina-arvojen paivitys pois kaytosta. Lahde on kuollut
 * (transfermarkt-api.vercel.app -> 402 DEPLOYMENT_DISABLED) ja suora
 * Transfermarkt-haku rikkoo kayttoehtoja. Kokoelmaa transfermarkt_players
 * EI poisteta, joten palautus ei vaadi datan uudelleenhakua.
 */
const MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA = false;

// Initialize Firebase Admin (guard prevents double-init when container reuses module)
if (!admin.apps.length) {
  admin.initializeApp();
}

// API_VERSION: muuta tätä joka deployssa, jotta Firebase tunnistaa muutoksen.
// RAPIDAPI_KEY-tarkistus on siirretty footballApi-luokan request-interceptoriin,
// koska module-load-aikana process.env ei välttämättä ole vielä asetettu.
const API_VERSION = '1.9.0'; // feat: season-players endpoints (Firestore Excel-data, Vaihe B)

// ============================================
// Express API App
// ============================================
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check. Kaksi polkua tarkoituksella: Hosting-rewrite valittaa
// pyynnon muodossa /api/health (rewrite ei riisu etuliitetta), kun taas
// funktiota suoraan kutsuttaessa polku on /health.
app.get(['/health', '/api/health'], (_req, res) => {
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
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const { suoritukset, nimittajat } = await lueKausi(admin.firestore(), season);
    const teams = laskeJoukkueet(season, suoritukset, nimittajat);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: teams,
      // Tyhjä ei ole nolla: frontend näyttää "ei dataa" eikä laske 0 %.
      dataSaatavilla: teams.length > 0,
      count: teams.length,
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[teams] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

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

/** GET /api/players/:season — kauden pelaajat kausituonnin datasta.
 *  Kausisumma lasketaan yli vaiheiden JA seurojen; siirtyneen pelaajan
 *  joukkueet[] säilyttää molemmat seurat. */
app.get('/api/players/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const { teamId, minAge, maxAge, minMinutes, limit } = req.query;
    const { suoritukset } = await lueKausi(admin.firestore(), season);
    const kaikki = laskeKaudenPelaajat(suoritukset);

    let players = kaikki;
    if (teamId) {
      const haettu = String(teamId).toLowerCase();
      players = players.filter(
        (p) =>
          p.joukkue.toLowerCase() === haettu ||
          p.joukkueet.some((j) => j.toLowerCase() === haettu),
      );
    }
    if (minAge) players = players.filter((p) => p.ika >= parseInt(String(minAge), 10));
    if (maxAge) players = players.filter((p) => p.ika <= parseInt(String(maxAge), 10));
    if (minMinutes) {
      players = players.filter((p) => p.minTotal >= parseInt(String(minMinutes), 10));
    }
    // laskeKaudenPelaajat palauttaa jo minuuttijärjestyksessä.
    const result = limit ? players.slice(0, parseInt(String(limit), 10)) : players;

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: result,
      dataSaatavilla: kaikki.length > 0,
      count: result.length,
      ikahaarukka: paatteleIkahaarukka(suoritukset),
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[players] failed:', message);
    res.status(500).json({ success: false, error: message });
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
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const db = admin.firestore();
    const { suoritukset, nimittajat } = await lueKausi(db, season);
    const stats = laskeJoukkueidenOsuudet(
      season,
      suoritukset,
      nimittajat,
      new Date().toISOString(),
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: stats,
      // Tyhjä lista EI tarkoita nollaa vaan puuttuvaa dataa. Frontend
      // näyttää tällöin "ei dataa" eikä laske osuudeksi 0,0 %.
      dataSaatavilla: stats.length > 0,
      // Lähde on suodatettu 17-21-vuotiaisiin, joten U23-lukua ei ole.
      // Se palaa sellaisenaan jos vienti tehdään haarukalla 17-23.
      ikahaarukka: paatteleIkahaarukka(suoritukset),
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[youth-stats] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/youth-stats/:season/all
 *
 * Kausituonnin lahde kattaa vain Veikkausliigan. Ykkosliiga ja Ykkonen
 * palautetaan tyhjina JA merkitaan erikseen puuttuviksi, jottei tyhjaa
 * listaa lueta nollaksi.
 */
app.get('/api/youth-stats/:season/all', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const db = admin.firestore();
    const { suoritukset, nimittajat } = await lueKausi(db, season);
    const veikkausliiga = laskeJoukkueidenOsuudet(
      season,
      suoritukset,
      nimittajat,
      new Date().toISOString(),
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: { veikkausliiga, ykkosliiga: [], ykkonen: [] },
      dataSaatavilla: {
        veikkausliiga: veikkausliiga.length > 0,
        ykkosliiga: false,
        ykkonen: false,
      },
      ikahaarukka: paatteleIkahaarukka(suoritukset),
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[youth-stats/all] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/youth-aggregation/:season — liigatason yhteenveto kausituonnista. */
app.get('/api/youth-aggregation/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const { suoritukset, nimittajat } = await lueKausi(admin.firestore(), season);
    const yhteenveto = laskeLiigaYhteenveto(season, suoritukset, nimittajat);
    const teamBreakdown = laskeJoukkueidenOsuudet(
      season,
      suoritukset,
      nimittajat,
      new Date().toISOString(),
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      // Sailytetaan YouthAggregation-sopimus: etusivu lukee topYouthPlayers-
      // ja teamBreakdown-kentat. U23-kentat jatetaan pois, koska lahde on
      // suodatettu 17-21-vuotiaisiin — ks. ikahaarukka.
      data: {
        season,
        league: 'Veikkausliiga',
        totalPlayersAnalyzed: yhteenveto.pelaajia,
        pelaajatNuoret: yhteenveto.pelaajia,
        totalMinutesPlayed: yhteenveto.kapasiteettiMinuutit,
        minuutitNuoret: yhteenveto.nuortenMinuutit,
        osuusNuoret: yhteenveto.nuortenOsuus,
        osuusNuoretRunkosarja: yhteenveto.nuortenOsuusRunkosarja,
        teamBreakdown,
        topYouthPlayers: laskeTopPelaajat(season, suoritukset, 20),
        vaiheet: yhteenveto.vaiheet,
        ikahaarukka: yhteenveto.ikahaarukka,
        updatedAt: new Date().toISOString(),
      },
      dataSaatavilla: nimittajat.length > 0,
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[youth-aggregation] failed:', message);
    res.status(500).json({ success: false, error: message });
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

  const forceRefresh = req.query.refresh === '1';
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
    // 1. Cache check (ohitetaan jos ?refresh=1)
    if (!forceRefresh) {
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
    }

    // 2. Syntymävuodet U21-luokitusta varten (sama datalähde kuin youth-stats).
    //    U21 = syntynyt season-21 tai myöhemmin (2026 → 2005). Sama joukko kuin
    //    youthPercentageU21-KPI (ikä <= 21).
    //    Käytetään dataAggregatorin cachettua pelaajalistaa — yhdenmukainen ja
    //    nopeampi kuin erillinen getPlayers-kutsu.
    const U21_MIN_BIRTH_YEAR = season - 21;
    const birthYearById = await dataAggregator.getPlayerBirthYearMap(season);
    console.log(`[u21-round-trend] birthYear map: ${birthYearById.size} players`);

    // 3. Kauden päättyneet ottelut.
    const fixtures = await footballApi.getFixtures(season);
    const finished = fixtures.filter((f) => f.fixture.status.short === 'FT');

    // 4. Per ottelu: hae pelaajaminuutit ja summaa kierroksittain.
    //    Rajattu rinnakkaisuus suojaa API-Football-rate-limitiltä ja
    //    Cloud Functions -timeoutilta kun otteluita on kymmeniä.
    const roundAgg = new Map<number, { u21: number; total: number; unknown: number }>();
    let skippedPlayers = 0;
    let skippedMinutes = 0;
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
          const acc = roundAgg.get(round) ?? { u21: 0, total: 0, unknown: 0 };
          for (const teamGroup of stats) {
            for (const pl of teamGroup.players) {
              const mins = pl.statistics?.[0]?.games?.minutes ?? 0;
              if (!mins) continue;
              const by = birthYearById.get(pl.player.id);
              if (by === undefined) {
                // Pelaajaa ei löytynyt kausirosterista tai syntymävuosi puuttuu.
                // Ei lasketa mukaan kumpaankaan — yhdenmukainen footballApi.ts:n
                // getYouthStats:in kanssa joka ohittaa pelaajat joilla ei
                // kelvollista ikätietoa.
                acc.unknown += mins;
                skippedPlayers++;
                skippedMinutes += mins;
                continue;
              }
              acc.total += mins;
              if (by >= U21_MIN_BIRTH_YEAR) acc.u21 += mins;
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

    console.log(
      `[u21-round-trend] computed ${trend.length} rounds, ` +
        `${skippedPlayers} unknown players skipped (${skippedMinutes} min)`,
    );

    // 6. Tallenna cacheen 6 h ajaksi.
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await docRef.set({
      data: trend,
      cachedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: 'api-football',
      meta: {
        skippedPlayers,
        skippedMinutes,
        birthYearMapSize: birthYearById.size,
      },
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
// SEASON PLAYERS (Firestore Excel-import data, Vaihe B)
// Lähde: seasons/{season}/players ja seasons/{season}/rounds/*/players
// Julkisia endpointteja (ei admin-key). Cache 1 h.
// ============================================

/** Firestore-dokumentti → SeasonPlayer-muoto. doc.id on slug. */
function toSeasonPlayer(id: string, data: admin.firestore.DocumentData | undefined) {
  const d = data ?? {};
  return {
    slug: id,
    etunimi: (d.etunimi as string) ?? '',
    sukunimi: (d.sukunimi as string) ?? '',
    ika: (d.ika as number) ?? 0,
    joukkue: (d.joukkue as string) ?? '',
    minTotal: (d.minTotal as number) ?? 0,
    ottelutTotal: (d.ottelutTotal as number) ?? 0,
    aloituksetTotal: (d.aloituksetTotal as number) ?? 0,
    maaliTotal: (d.maaliTotal as number) ?? 0,
    lastUpdatedRound: (d.lastUpdatedRound as number) ?? 0,
  };
}

/**
 * GET /api/kaudet — saatavilla olevat kaudet, uusin ensin.
 *
 * Lähde on kaudet-kokoelma, jonka kausituonti kirjoittaa. Näin uusi kausi
 * ilmestyy valitsimeen tuonnin jälkeen ilman koodimuutosta, eikä listaa
 * tarvitse kovakoodata frontendiin.
 */
/**
 * GET /api/kansalaisuudet/:season — minuuteilla painotettu osuus, joka meni
 * Suomen kansalaisille.
 *
 * Lähde on seasons/{kausi}/kansalaisuudet, jonka haeKansalaisuudet-skripti
 * kirjoittaa Veikkausliigan rekisteristä. Kaikilla kausilla sitä ei ole:
 * silloin saatavilla on false eikä lukuja esitetä.
 *
 * Mukaan lasketaan kaikki joilla suomalainen === 'kylla', myös ne joilla
 * seura jäi vahvistamatta. Luku on ALARAJA: 'ei tietoa' -pelaajat voivat
 * myös olla Suomen kansalaisia, eikä yksiarvoinen lähde kerro
 * kaksoiskansalaisuutta.
 */
app.get('/api/kansalaisuudet/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const db = admin.firestore();
    const kansSnap = await db
      .collection('seasons')
      .doc(String(season))
      .collection('kansalaisuudet')
      .get();

    if (kansSnap.empty) {
      res.set('Cache-Control', 'public, max-age=600');
      res.json({
        success: true,
        data: { saatavilla: false, kausi: season },
        source: 'veikkausliiga-rekisteri',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Sama luokittelu kuin trendinakymassa: rekisterin koodi ja seuran
    // vahvistus. Yksi saanto, jottei sivusto nayta kahta eri lukua samasta
    // asiasta. (Tarkistettu kaikilla kausilla: tama ja vanha
    // suomalainen === 'kylla' -saanto antavat saman prosentin.)
    const luokat = luokitteleKansalaisuudet(kansSnap.docs);

    const { suoritukset, nimittajat } = await lueKausi(db, season);
    const kapasiteetti = nimittajat.reduce(
      (a, n) => a + n.kapasiteetti_min,
      0,
    );
    const minuutit = (ikaRaja: number, vainSuomalaiset: boolean): number =>
      suoritukset
        .filter(
          (s) =>
            s.ika <= ikaRaja &&
            (!vainSuomalaiset || luokat.fin.has(s.slug)),
        )
        .reduce((a, s) => a + s.minuutit, 0);

    const osuus = (osa: number): number | null =>
      kapasiteetti > 0 ? Math.round((osa / kapasiteetti) * 1000) / 10 : null;

    // Kolmijako lasketaan ensin, jotta Suomen kansalaisten osuus voidaan
    // ottaa siita: muuten sama luku pyoristyisi kahdella eri tavalla ja
    // Tietoa-sivu nayttaisi eri prosentin kuin /peliaika-sivun taulukko.
    const jako = laskeKolmijako(suoritukset, kapasiteetti, luokat, ALLE_21_MAX);

    res.set('Cache-Control', 'public, max-age=600');
    res.json({
      success: true,
      data: {
        saatavilla: true,
        kausi: season,
        pelaajia: kansSnap.size,
        suomalaisia: luokat.fin.size,
        /** 17–21-vuotiaiden osuus kapasiteetista, kaikki pelaajat. */
        osuus1721: osuus(minuutit(NUORET_MAX, false)),
        /** Sama, vain Suomen kansalaisille menneet minuutit. */
        osuus1721Suomalaiset: osuus(minuutit(NUORET_MAX, true)),
        /** Alle 21 (ikä ≤ 20) — CIES-vertailun luku, kaikki pelaajat. */
        osuusAlle21: osuus(minuutit(ALLE_21_MAX, false)),
        /** Sama, vain Suomen kansalaisille — sama luku kuin kolmijaon FIN. */
        osuusAlle21Suomalaiset:
          jako !== null ? jako.fin : osuus(minuutit(ALLE_21_MAX, true)),
        /** Alle 21 -osuuden kolmijako: FIN / muu maakoodi / ei tietoa. */
        alle21Jako: jako,
      },
      source: 'veikkausliiga-rekisteri',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[kansalaisuudet] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/trendit — yksi piste per kausi, vanhin ensin.
 *
 * Luvut lasketaan samalla koodilla kuin kauden omassa nakymassa, jotta
 * trendipiste ja kausinakyman luku ovat aina sama luku. Laskenta tehdaan
 * palvelimella: selain ei laske osuuksia.
 *
 * Puuttuva arvo on null eika 0 — nolla vaittaisi, ettei nuorille mennyt
 * yhtaan minuuttia.
 */
app.get('/api/trendit', async (_req, res) => {
  try {
    const trendit = await laskeTrendit(admin.firestore());
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: trendit,
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[trendit] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

app.get('/api/kaudet', async (_req, res) => {
  try {
    const snap = await admin.firestore().collection('kaudet').get();
    const kaudet = snap.docs
      .map((doc) => {
        const d = doc.data();
        // tuotu_pvm on Firestore-Timestamp. Ilman muunnosta se serialisoituu
        // muodossa {_seconds, _nanoseconds}, jota frontend ei osaa lukea.
        const tuotu = d.tuotu_pvm;
        const tuotuPvm =
          tuotu && typeof tuotu.toDate === 'function'
            ? (tuotu.toDate() as Date).toISOString()
            : typeof tuotu === 'string'
              ? tuotu
              : null;
        return {
          kausi: (d.vuosi as number) ?? parseInt(doc.id, 10),
          sarja: (d.sarja as string) ?? 'Veikkausliiga',
          pelaajat: (d.pelaajat as number) ?? null,
          joukkueet: (d.joukkueet as number) ?? null,
          tuotuPvm,
        };
      })
      .filter((k) => !isNaN(k.kausi))
      .sort((a, b) => b.kausi - a.kausi);

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      data: kaudet,
      oletus: kaudet.length > 0 ? kaudet[0].kausi : null,
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[kaudet] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/season-players/:season — kaikki kauden pelaajat. */
app.get('/api/season-players/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const snap = await admin
      .firestore()
      .collection('seasons')
      .doc(String(season))
      .collection('players')
      .get();
    // Vanhentuneiksi merkityt projektiot on tuotu aiemmin mutta ne eivät
    // enää ole lähdeaineistossa. Suodatus tehdään muistissa, ei where-
    // kyselyllä: valtaosalta dokumenteista kenttä puuttuu kokonaan, ja
    // puuttuva kenttä tarkoittaa "ei vanhentunut".
    const players = snap.docs
      .filter((doc) => doc.data().vanhentunut !== true)
      .map((doc) => toSeasonPlayer(doc.id, doc.data()));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: players,
      count: players.length,
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[season-players] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/season-players/:season/:slug/rounds — pelaajan kierrosdata
 *  kaikilta kierroksilta (kehityskäyrä). Järjestetty round-nousevasti. */
app.get('/api/season-players/:season/:slug/rounds', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  const slug = req.params.slug;
  if (isNaN(season) || !slug) {
    res
      .status(400)
      .json({ success: false, error: 'season tai slug puuttuu/virheellinen' });
    return;
  }
  try {
    const roundsSnap = await admin
      .firestore()
      .collection('seasons')
      .doc(String(season))
      .collection('rounds')
      .get();

    const entries = await Promise.all(
      roundsSnap.docs.map(async (rdoc) => {
        const round = parseInt(rdoc.id, 10);
        if (isNaN(round)) return null;
        const pdoc = await rdoc.ref.collection('players').doc(slug).get();
        if (!pdoc.exists) return null;
        const d = pdoc.data() ?? {};
        return {
          round,
          cumMin: (d.cumMin as number) ?? (d.min as number) ?? 0,
          cumMaalit: (d.cumMaalit as number) ?? (d.maalit as number) ?? 0,
          cumOttelut: (d.cumOttelut as number) ?? (d.ottelut as number) ?? 0,
        };
      }),
    );

    const rounds = entries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.round - b.round);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: rounds,
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[season-players/rounds] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/season-players/:season/:slug — yksittäinen pelaaja tai 404. */
app.get('/api/season-players/:season/:slug', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  const slug = req.params.slug;
  if (isNaN(season) || !slug) {
    res
      .status(400)
      .json({ success: false, error: 'season tai slug puuttuu/virheellinen' });
    return;
  }
  try {
    const doc = await admin
      .firestore()
      .collection('seasons')
      .doc(String(season))
      .collection('players')
      .doc(slug)
      .get();
    // Vanhentunut projektio käsitellään kuin puuttuvaa: pelaaja ei ole
    // tämän kauden aineistossa, jolloin käyttöliittymä kertoo sen.
    if (!doc.exists || doc.data()?.vanhentunut === true) {
      res.status(404).json({ success: false, error: 'Pelaajaa ei löytynyt' });
      return;
    }
    // Siirto tai laina kesken kauden (B5). Lahde on repon datatiedosto,
    // jossa jokaisella rivilla on julkinen lahde-URL. Jos pelaajalle ei
    // loydy rivia, kentta on null eika sivulla nay merkintaa.
    const d = doc.data() ?? {};
    const siirto = haeSiirto(
      season,
      (d.etunimi as string) ?? '',
      (d.sukunimi as string) ?? '',
      [...((d.joukkueet as string[]) ?? []), (d.joukkue as string) ?? ''],
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: { ...toSeasonPlayer(doc.id, d), siirto },
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[season-players/:slug] failed:', message);
    res.status(500).json({ success: false, error: message });
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

/**
 * POISTETTAVAKSI MERKITTY (2026-09-19).
 *
 * Perustuu transfermarktApi:n kovakoodattuun TEAM_IDS-karttaan ja
 * transfermarkt-api.vercel.app -valityspalveluun. Palauttaa tuotannossa
 * tyhjaa. Mikaan ei kutsu tata: frontend kayttaa vain
 * getTransfermarktPlayer- ja getTransfermarktLeague-reitteja, jotka
 * lukevat Firestoren transfermarkt_players-kokoelmasta.
 *
 * EI korjata — poistetaan API-Football-siivouksen yhteydessa.
 */
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

/**
 * POISTETTAVAKSI MERKITTY (2026-09-19).
 *
 * Perustuu transfermarktApi:n kovakoodattuun TEAM_IDS-karttaan ja
 * transfermarkt-api.vercel.app -valityspalveluun. Palauttaa tuotannossa
 * tyhjaa. Mikaan ei kutsu tata: frontend kayttaa vain
 * getTransfermarktPlayer- ja getTransfermarktLeague-reitteja, jotka
 * lukevat Firestoren transfermarkt_players-kokoelmasta.
 *
 * EI korjata — poistetaan API-Football-siivouksen yhteydessa.
 */
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

/** POST /api/transfermarkt/refresh — admin: ajaa scrapeAllYouthPlayers.
 *  Query/body: season (oletus nykyvuosi), limit (esim. 5), offset (esim. 0).
 *  Batchaa työn pieniin osiin jotta Cloud Functions -timeout (60 s) ei osu:
 *    POST /api/transfermarkt/refresh?season=2026&limit=5&offset=0
 *    POST /api/transfermarkt/refresh?season=2026&limit=5&offset=5  ...
 *  Ilman limit/offset käsittelee koko U23-listan (max 20). */
app.post('/api/transfermarkt/refresh', requireAdminKey, async (req, res) => {
  // Runko ohitetaan, funktiota ei poisteta — sama malli kuin
  // AJASTETTU_REFRESH_KAYTOSSA. Markkina-arvojen haku on pysaytetty:
  // transfermarkt-api.vercel.app on kuollut (402 DEPLOYMENT_DISABLED) ja
  // suora haku rikkoo Transfermarktin kayttoehtoja (403). Palautetaan
  // kun luvallinen lahde loytyy.
  if (!MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA) {
    console.log(
      '[transfermarkt/refresh] ohitettu — kytketty pois 2026-09-20, ' +
        'ks. MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA',
    );
    return res.status(503).json({
      success: false,
      error:
        'Markkina-arvojen paivitys on pysaytetty: lahteelle ei ole lupaa. ' +
        'Ks. MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA.',
    });
  }
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
    const players = await scrapeAllYouthPlayers(season, limit, offset);
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

// ============================================
// DEBUG / DIAGNOSTIIKKA
// ============================================

/** GET /api/debug/sofascore?name=Otto+Ruoppi — admin: testaa toimiiko
 *  Sofascore-haku Cloud Functions -ympäristöstä. Hakee pelaajan ID:n
 *  nimellä ja per-ottelu tilastot, palauttaa raakadatan tai virheviestin
 *  per vaihe. Ei cachea — aina live-kutsu diagnostiikkaa varten. */
app.get('/api/debug/sofascore', requireAdminKey, async (req, res) => {
  const name = String(req.query.name ?? '').trim();
  if (!name) {
    res.status(400).json({
      success: false,
      error: 'name-query puuttuu (esim. ?name=Otto+Ruoppi)',
    });
    return;
  }
  try {
    const result = await debugSofascore(name);
    res.status(result.ok ? 200 : 502).json({
      success: result.ok,
      data: result,
      source: 'sofascore.com',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[debug/sofascore] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});


/**
 * Hakee kansalaisuuden vain pelaajille, joilla ei ole dokumenttia.
 *
 * Budjetoitu: Cloud Functions -aikaraja on 60 s, joten haku tekee
 * enintaan RAJA pelaajaa kerralla ja kertoo montako jai jaljelle.
 * Epaonnistunut haku EI kaada tuontia - pelaaja jaa "ei tietoa" -tilaan
 * ja nakyy yhteenvedossa.
 *
 * Seura varmennetaan profiilin kauden rivilta, sama saanto kuin
 * komentoriviskriptissa (jaettu moduuli services/kansalaisuus.ts).
 */
async function haeUusienKansalaisuudet(
  db: admin.firestore.Firestore,
  tulos: { kaudet: Array<{ kausi: string }>; projektiot: Array<{ kausi: string; slug: string; pelaajaAvain: string; joukkue: string; joukkueet: string[]; ika: number; etunimi: string; sukunimi: string; minTotal: number }> },
): Promise<{
  haettu: number;
  onnistui: number;
  eiTietoa: number;
  jaljella: number;
  ohitettuNollaMinuuttia: number;
}> {
  const RAJA = 15;
  const VIIVE_MS = 1200;
  let haettu = 0;
  let onnistui = 0;
  let eiTietoa = 0;
  let jaljella = 0;
  let ohitettuNollaMinuuttia = 0;

  try {
    asetaAgent(await luoAgent());
  } catch (e) {
    console.error('[kansalaisuus] agentin luonti epaonnistui:', e);
    // Koko haku ohitetaan; tuonti on jo kirjoitettu.
    return {
      haettu: 0,
      onnistui: 0,
      eiTietoa: 0,
      jaljella: -1,
      ohitettuNollaMinuuttia: 0,
    };
  }

  for (const k of tulos.kaudet) {
    const kansKok = db
      .collection('seasons')
      .doc(k.kausi)
      .collection('kansalaisuudet');
    const on = new Set((await kansKok.get()).docs.map((d) => d.id));
    // Pelaaja jolla on 0 minuuttia EI ole Veikkausliigan tilastolistalla,
    // koska lista sisaltaa vain pelanneet. Hanta ei siis voi varmentaa, ja
    // ilman tata rajausta han kuluttaisi hakubudjettia joka tuonnilla
    // ikuisesti - kaudella 2026 heita on 40 / 146.
    //
    // Kun pelaaja saa minuutteja, han tulee mukaan seuraavassa tuonnissa.
    const kaikkiUudet = tulos.projektiot.filter(
      (p) => p.kausi === k.kausi && !on.has(p.slug),
    );
    ohitettuNollaMinuuttia += kaikkiUudet.filter((p) => p.minTotal === 0).length;

    // Eniten pelanneet ensin: budjetti kannattaa kayttaa niihin, joiden
    // minuutit painavat eniten kolmijaossa.
    const uudet = kaikkiUudet
      .filter((p) => p.minTotal > 0)
      .sort((a, b) => b.minTotal - a.minTotal);
    if (uudet.length === 0) continue;

    let lista: Awaited<ReturnType<typeof haeLista>>;
    try {
      lista = await haeLista(k.kausi);
    } catch (e) {
      console.error('[kansalaisuus] listan haku epaonnistui:', e);
      jaljella += uudet.length;
      continue;
    }

    for (const p of uudet) {
      if (haettu >= RAJA) {
        jaljella++;
        continue;
      }
      haettu++;
      const nimi = (p.etunimi + ' ' + p.sukunimi).trim();
      const omatSeurat = new Set(
        [p.joukkue, ...(p.joukkueet || [])].filter(Boolean).map(seuraAvain),
      );
      try {
        const ehdokkaat = lista.filter((r) => nimetTasmaavat(nimi, r.nimi));
        let tallennettu = false;
        for (const e of ehdokkaat) {
          const prof = await haeProfiili(e.polku, e.vlId);
          await new Promise((r) => setTimeout(r, VIIVE_MS));
          // Sama hybridisaanto kuin komentoriviskriptissa: yksi funktio,
          // yksi saanto (services/kansalaisuus.ts).
          const vahvistus = vahvistaSeura(
            [p.joukkue, ...(p.joukkueet || [])],
            e.seura,
            prof.kaudenSeurat?.[k.kausi] ?? [],
          );
          const ikaProfiilista =
            prof.syntymavuosi !== null
              ? parseInt(k.kausi, 10) - prof.syntymavuosi
              : null;
          if (
            vahvistus.vahvistettu &&
            ikaProfiilista === p.ika &&
            prof.kansalaisuudet.length > 0
          ) {
            const koodi = prof.kansalaisuudet[0];
            await kansKok.doc(p.slug).set({
              slug: p.slug,
              nimi,
              joukkue: p.joukkue,
              ika: p.ika,
              vlKansalaisuus: koodi,
              suomalainen: koodi === 'FIN' ? 'kylla' : 'ei tietoa',
              varmuus: 'yksi lahde',
              ristiriita: false,
              lahteet: [
                { lahde: 'veikkausliiga.com', id: e.vlId, arvo: koodi },
              ],
              seura_vahvistettu: true,
              seura_vahvistus_lahde: vahvistus.lahde,
              varmennus: 'nimi+seura+ika',
              // Pelipaikka on NYKYTIETO, ei kauden aikainen - sama varauma
              // kuin kansalaisuudella. Puuttuva arvo on null, ei arvaus:
              // pelipaikkaa ei paatella tilastoista.
              pelipaikka: prof.pelipaikka ?? null,
              pelipaikka_lahde:
                prof.pelipaikka !== null ? 'veikkausliiga.com profiili' : null,
              syntynyt: prof.syntynyt,
              paivitetty: new Date().toISOString(),
            });
            onnistui++;
            tallennettu = true;
            break;
          }
        }
        if (!tallennettu) eiTietoa++;
      } catch (e) {
        // Yksittainen epaonnistuminen ei kaada tuontia.
        console.error('[kansalaisuus] ' + p.slug + ' epaonnistui:', e);
        eiTietoa++;
      }
    }
  }
  return { haettu, onnistui, eiTietoa, jaljella, ohitettuNollaMinuuttia };
}

// ============================================
// KAUSITUONTI — esikatselu ja vahvistus (admin)
//
// Kaksi reittia: esikatselu ei kirjoita mitaan, vahvistus kirjoittaa.
// Molemmat kayttavat samaa kausiImport-koodia kuin komentoriviskriptit,
// joten toista toteutusta ei ole.
//
// Kayttoliittymassa annettu vahvistus vastaa CLAUDE.md 3.5:n vaatimaa
// kayttajan hyvaksyntaa.
// ============================================

/** Tiedoston kokoraja. Veikkausliigan vienti on kymmenia kilotavuja. */
const TUONTI_MAX_TAVUA = 5 * 1024 * 1024;

/** Yksinkertainen rajoitus admin-avaimen vaarille yrityksille. */
const adminYritykset = new Map<string, { n: number; eka: number }>();
const ADMIN_IKKUNA_MS = 10 * 60 * 1000;
const ADMIN_MAX_YRITYSTA = 5;

function adminRajoitus(req: Request, res: Response, next: NextFunction): void {
  const ip = String(req.ip || req.header('x-forwarded-for') || 'tuntematon');
  const nyt = Date.now();
  const tila = adminYritykset.get(ip);
  if (tila && nyt - tila.eka < ADMIN_IKKUNA_MS && tila.n >= ADMIN_MAX_YRITYSTA) {
    res.status(429).json({
      success: false,
      error: 'Liian monta virheellista yritysta. Odota 10 minuuttia.',
    });
    return;
  }
  const annettu = req.header('x-admin-key');
  if (annettu !== process.env.ADMIN_KEY) {
    if (!tila || nyt - tila.eka >= ADMIN_IKKUNA_MS) {
      adminYritykset.set(ip, { n: 1, eka: nyt });
    } else {
      tila.n++;
    }
  } else {
    adminYritykset.delete(ip);
  }
  next();
}

/** Lukee multipart-pyynnon: tiedosto + kentat. */
async function lueTuontiTiedosto(
  req: Request,
): Promise<{ buffer: Buffer; nimi: string; kentat: Record<string, string> }> {
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    throw new Error('Odotettiin multipart/form-data -pyyntoa');
  }
  if (rawBody.length > TUONTI_MAX_TAVUA) {
    throw new Error(
      'Tiedosto on liian suuri (' +
        Math.round(rawBody.length / 1024) +
        ' kt, raja ' +
        Math.round(TUONTI_MAX_TAVUA / 1024) +
        ' kt)',
    );
  }
  const bb = Busboy({ headers: req.headers });
  const kentat: Record<string, string> = {};
  const palat: Buffer[] = [];
  let nimi = '';
  bb.on('field', (k, v) => {
    kentat[k] = v;
  });
  bb.on('file', (_k, stream, info) => {
    nimi = info.filename ?? '';
    stream.on('data', (d: Buffer) => palat.push(d));
  });
  await new Promise<void>((resolve, reject) => {
    bb.on('close', resolve);
    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(rawBody);
  });
  const buffer = Buffer.concat(palat);
  if (buffer.length === 0 || !nimi.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Tiedosto puuttuu tai ei ole .xlsx-muotoinen');
  }
  return { buffer, nimi, kentat };
}

/**
 * Parsii tiedoston ja antaa selkean virheen vaarasta tiedostosta.
 * Seurayhteenveto pelaajatiedoston sijaan on tavallisin erehdys.
 */
function parsiTuonti(buffer: Buffer): ReturnType<typeof parsiKausiExcel> {
  const tulos = parsiKausiExcel(buffer);
  // Vaara sarja on oma tilanteensa: kayttaja on lahettanyt oikean
  // muotoisen tiedoston vaarasta sarjasta, joten viesti kertoo sen
  // sellaisenaan eika seurayhteenvetoarvauksen takaa.
  if (tulos.virheet.includes(VIESTI_VAARA_SARJA)) {
    throw new Error(VIESTI_VAARA_SARJA);
  }
  if (tulos.virheet.length > 0) {
    const puuttuvat = tulos.virheet.slice(0, 5).join('; ');
    throw new Error(
      'Tiedosto ei kelpaa pelaajatiedostoksi. ' +
        'Tarkista ettet lahettanyt seurayhteenvetoa. Virheet: ' +
        puuttuvat,
    );
  }
  return tulos;
}

/** POST /api/admin/kausituonti/esikatselu — ei kirjoita mitaan. */
app.post(
  '/api/admin/kausituonti/esikatselu',
  adminRajoitus,
  requireAdminKey,
  async (req, res) => {
    try {
      const { buffer, nimi } = await lueTuontiTiedosto(req);
      const tulos = parsiTuonti(buffer);
      const db = admin.firestore();
      const esikatselu = await esikatseleKausituonti(db, tulos, {
        tuontiId: 'esikatselu',
        lahdeTiedosto: nimi,
      });

      // Montako uutta pelaajaa on ilman kansalaisuustietoa.
      let uusiaIlmanKansalaisuutta = 0;
      for (const k of tulos.kaudet) {
        const kans = await db
          .collection('seasons')
          .doc(k.kausi)
          .collection('kansalaisuudet')
          .get();
        const on = new Set(kans.docs.map((d) => d.id));
        uusiaIlmanKansalaisuutta += tulos.projektiot.filter(
          (p) => p.kausi === k.kausi && !on.has(p.slug),
        ).length;
      }

      res.json({
        success: true,
        data: { ...esikatselu, uusiaIlmanKansalaisuutta, tiedosto: nimi },
        kirjoitettu: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const viesti = error instanceof Error ? error.message : 'Tuntematon virhe';
      console.error('[kausituonti/esikatselu] failed:', viesti);
      res.status(400).json({ success: false, error: viesti });
    }
  },
);

/** POST /api/admin/kausituonti/vahvista — kirjoittaa. */
app.post(
  '/api/admin/kausituonti/vahvista',
  adminRajoitus,
  requireAdminKey,
  async (req, res) => {
    try {
      const { buffer, nimi } = await lueTuontiTiedosto(req);
      const tulos = parsiTuonti(buffer);
      const db = admin.firestore();
      const tuontiId =
        new Date().toISOString().replace(/[:.]/g, '-') + '_' + nimi;

      const yhteenveto = await kirjoitaKausituonti(db, tulos, {
        tuontiId,
        lahdeTiedosto: nimi,
      });

      // Kansalaisuushaku vain pelaajille joilla ei ole dokumenttia.
      // Ei saa kaataa tuontia: epaonnistuminen jaa "ei tietoa" -tilaan.
      const kansalaisuus = await haeUusienKansalaisuudet(db, tulos);

      // Valimuistin tyhjennys: kausi- ja trendinakymat lukevat naita, ja
      // data muuttuu vain tuonnin yhteydessa. Ilman tyhjennysta uusi
      // kierros nakyisi vasta TTL:n umpeuduttua.
      const tyhjennetyt: string[] = [];
      for (const tyyppi of ['youth_stats', 'players', 'standings']) {
        try {
          await cacheService.clearType(tyyppi);
          tyhjennetyt.push(tyyppi);
        } catch (e) {
          console.error('[kausituonti] valimuistin tyhjennys ' + tyyppi + ':', e);
        }
      }

      res.json({
        success: true,
        data: {
          tuontiId,
          kirjoitettu: yhteenveto.kirjoitettu,
          tilannekuvat: yhteenveto.tilannekuvat,
          tilannekuvatOhitettu: yhteenveto.tilannekuvatOhitettu,
          vanhentuneet: yhteenveto.vanhentuneet.length,
          kansalaisuus,
          valimuistiTyhjennetty: tyhjennetyt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const viesti = error instanceof Error ? error.message : 'Tuntematon virhe';
      console.error('[kausituonti/vahvista] failed:', viesti);
      res.status(400).json({ success: false, error: viesti });
    }
  },
);

// ============================================
// EXCEL-IMPORT (Veikkausliiga kumulatiivinen data)
// ============================================

/** POST /api/admin/import-excel — admin: tuo .xlsx (multipart/form-data).
 *  Kentät: file (.xlsx), round (1–27). Parsii + aggregoi sarjan vaiheet ja
 *  kirjoittaa Firestoreen (seasons/2026/players + seasons/2026/rounds/{round}).
 *  Idempotentti — saman kierroksen uudelleenajo ylikirjoittaa. */
app.post('/api/admin/import-excel', requireAdminKey, async (req, res) => {
  // Cloud Functions on jo lukenut request-bodyn → busboy syötetään
  // req.rawBody-Bufferista (raakastreamiä ei enää voi lukea).
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.status(400).json({
      success: false,
      error: 'rawBody puuttuu — odotettiin multipart/form-data -pyyntöä',
    });
    return;
  }

  let bb: ReturnType<typeof Busboy>;
  try {
    bb = Busboy({ headers: req.headers });
  } catch {
    res
      .status(400)
      .json({ success: false, error: 'Virheellinen multipart/form-data' });
    return;
  }

  const fields: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let fileBuffer: Buffer | null = null;
  let fileName = '';

  bb.on('field', (name, val) => {
    fields[name] = val;
  });
  bb.on('file', (_name, stream, info) => {
    fileName = info.filename ?? '';
    stream.on('data', (d: Buffer) => chunks.push(d));
    stream.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  // busboy v1 emittoi 'close' kun kaikki kentät+tiedostot on käsitelty.
  // 'finish' kuunnellaan varmuuden vuoksi (vanhemmat versiot).
  await new Promise<void>((resolve, reject) => {
    bb.on('close', resolve);
    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(rawBody);
  }).catch((err) => {
    console.error('[import-excel] busboy error:', err);
  });

  // Validoi round (1–27)
  const round = parseInt(String(fields.round ?? ''), 10);
  if (isNaN(round) || round < 1 || round > 27) {
    res.status(400).json({
      success: false,
      error: 'round puuttuu tai on virheellinen (sallittu 1–27)',
    });
    return;
  }

  // Validoi tiedosto (.xlsx)
  if (!fileBuffer || !fileName.toLowerCase().endsWith('.xlsx')) {
    res.status(400).json({
      success: false,
      error: 'Tiedosto puuttuu tai ei ole .xlsx-muotoinen',
    });
    return;
  }

  try {
    const aggMap = parseExcelBuffer(fileBuffer);
    const players = Array.from(aggMap.values());
    const { imported, players: summary } = await writeRoundData(
      2026,
      round,
      players,
    );
    res.json({
      success: true,
      round,
      imported,
      players: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[import-excel] failed:', message);
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

/**
 * Main API function - handles all /api/* routes.
 *
 * Muistia ja aikaa on enemman kuin oletus (256 MB / 60 s): trendireitti
 * lukee seitseman kauden suoritukset ja nimittajat, ja kylmakaynnistyksen
 * kanssa oletusraja tuli vastaan. Nama arvot koskevat koko API-funktiota,
 * joten ne eivat ole reittikohtainen kiertotie vaan yhteinen varmuusvara.
 */
export const api = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(app);

/**
 * Kytkin ajastetulle API-Football-refreshille.
 *
 * POIS PÄÄLTÄ 2026-09-19. Syy: API-Football palauttaa tyhjää kaikille
 * endpointeille, ja refreshSeason() aloittaa poistamalla cachen
 * (clearType) ennen uudelleenhakua. Ajo siis tuhoaa edellisen kelvollisen
 * cachen kahden tunnin välein eikä korvaa sitä millään. Lisäksi tyhjä
 * youth-aggregaatio tallentuu cacheen, koska sen "transientti tyhjä"
 * -suoja laukeaa vain osittaisesta tyhjyydestä, ei täydestä.
 *
 * Todennettu tuotannosta: kaikki 10 cache-dokumenttia kirjoitettu
 * uudelleen tyhjinä, youth_agg_v2_2026 sisältää pelkkiä nollia.
 *
 * Funktiota EI poisteta, vain sen runko ohitetaan — kun API-Football
 * korvataan omilla tilastoilla, tämä joko palautetaan uudella lähteellä
 * tai poistetaan hallitusti.
 */
const AJASTETTU_REFRESH_KAYTOSSA = false;

/** Scheduled: Refresh data every 2 hours during season */
export const scheduledDataRefresh = functions.region(REGION).pubsub
  .schedule('0 */2 * * *') // Every 2 hours
  .timeZone('Europe/Helsinki')
  .onRun(async (context) => {
    if (!AJASTETTU_REFRESH_KAYTOSSA) {
      console.log(
        '[scheduledDataRefresh] ohitettu — kytketty pois 2026-09-19, ' +
          'ks. AJASTETTU_REFRESH_KAYTOSSA',
      );
      return;
    }
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
// refreshData poistettu tietoturvasyysta: se oli julkinen,
// tunnistautumaton HTTPS-funktio, joka tyhjensi valimuistityypit ja haki
// datat uudelleen API-Footballista. Kuka tahansa pystyi kutsumaan sita.
// Kirjoittava reitti ilman tunnistautumista ei kuulu julkiseen APIin.
