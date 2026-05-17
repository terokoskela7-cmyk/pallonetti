// ============================================
// API-FOOTBALL INTEGRATION (via RapidAPI)
// Primary data source for matches, standings,
// players, and lineups
// ============================================
import axios, { AxiosInstance } from 'axios';
import {
  ApiFootballResponse,
  ApiFootballTeam,
  ApiFootballPlayer,
  ApiFootballStanding,
  ApiFootballMatch,
  VeikkausliigaSeason,
  PlayerStats,
  StandingEntry,
  Match,
  YouthStats,
  Player,
  Position,
} from '../types';

// API-Football league IDs (verified 2026-05-17 via /leagues?country=Finland)
const VEIKKAUSLIIGA_ID = 244;
const YKKOSLIIGA_ID = 1087;       // NOT 245 — 245 is Ykkönen
const YKKONEN_ID = 245;           // NOT 246 — 246 is Suomen Cup
const KANSALLINEN_LIIGA_ID = 640; // Naisten — käytetään Sprint 6+
// Kakkonen jaettu kolmeen lohkoon: 247 (A), 248 (B), 249 (C)

// Season configurations
const SEASONS: Record<number, VeikkausliigaSeason> = {
  2025: {
    year: 2025,
    startDate: '2025-04-05',
    endDate: '2025-10-26',
    currentMatchday: 27,
    numberOfMatchdays: 27,
    numberOfTeams: 12,
    apiFootballLeagueId: VEIKKAUSLIIGA_ID,
    fbrefLeagueUrl: 'https://fbref.com/en/comps/43/2025/',
    status: 'finished',
  },
  2026: {
    year: 2026,
    startDate: '2026-04-04',
    endDate: '2026-10-25',
    currentMatchday: 7,
    numberOfMatchdays: 27,
    numberOfTeams: 12,
    apiFootballLeagueId: VEIKKAUSLIIGA_ID,
    fbrefLeagueUrl: 'https://fbref.com/en/comps/43/2026/',
    status: 'ongoing',
  },
};

class FootballApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      timeout: 15000,
    });

    // Lazy: lue RAPIDAPI_KEY jokaisessa pyynnössä, ei konstruktorissa.
    // Firebase Cloud Functions lataa .env-arvot ennen module-loadia, mutta
    // sniffaus per-pyyntö suojaa myös tapaukset joissa env tulee myöhemmin
    // (paikallinen kehitys, container-uudelleenkäyttö).
    this.client.interceptors.request.use((config) => {
      const apiKey = process.env.RAPIDAPI_KEY || '';
      if (!apiKey) {
        console.warn('RAPIDAPI_KEY not set at request time — API-Football call will fail.');
      }
      config.headers.set('x-rapidapi-key', apiKey);
      return config;
    });
  }

  /** Apufunktio: tee API-kutsu cachella */
  private async fetch<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.get<ApiFootballResponse<T>>(endpoint, { params });
      if (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error(`API-Football error: ${JSON.stringify(response.data.errors)}`);
      }
      return response.data.response;
    } catch (error) {
      console.error(`API-Football fetch error for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Apufunktio: paginoi /players ja muut sivutetut endpointit.
   * Loop kunnes paging.current >= paging.total. API-Football jakaa
   * /players -vastauksen 20 pelaajan eriin per sivu.
   */
  private async fetchAllPages<T>(endpoint: string, params: Record<string, unknown>): Promise<T[]> {
    const all: T[] = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      try {
        const response = await this.client.get<ApiFootballResponse<T[]>>(endpoint, {
          params: { ...params, page: currentPage },
        });
        if (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
          console.error(`API-Football error (${endpoint} page ${currentPage}): ${JSON.stringify(response.data.errors)}`);
        }
        const items = response.data.response || [];
        all.push(...items);
        totalPages = response.data.paging?.total || 1;
        currentPage++;
      } catch (error) {
        console.error(`API-Football paginate error for ${endpoint} page ${currentPage}:`, error);
        break;
      }
    } while (currentPage <= totalPages);

    return all;
  }

  /** Hae sarjan joukkueet kaudelta */
  async getTeams(season: number, league: number = VEIKKAUSLIIGA_ID): Promise<ApiFootballTeam[]> {
    return this.fetch<ApiFootballTeam[]>('/teams', {
      league,
      season,
    });
  }

  /** Hae sarjan joukkueiden pelaajat (paginoitu) */
  async getPlayers(season: number, teamId?: number, league: number = VEIKKAUSLIIGA_ID): Promise<ApiFootballPlayer[]> {
    const params: Record<string, unknown> = {
      league,
      season,
    };
    if (teamId) params.team = teamId;
    return this.fetchAllPages<ApiFootballPlayer>('/players', params);
  }

  /** Hae sarjataulukko */
  async getStandings(season: number, league: number = VEIKKAUSLIIGA_ID): Promise<ApiFootballStanding[]> {
    return this.fetch<ApiFootballStanding[]>('/standings', {
      league,
      season,
    });
  }

  /** Hae ottelut */
  async getFixtures(season: number, teamId?: number, from?: string, to?: string, status?: string): Promise<ApiFootballMatch[]> {
    const params: Record<string, unknown> = {
      league: VEIKKAUSLIIGA_ID,
      season,
    };
    if (teamId) params.team = teamId;
    if (from) params.from = from;
    if (to) params.to = to;
    if (status) params.status = status;
    return this.fetch<ApiFootballMatch[]>('/fixtures', params);
  }

  /** Hae tulevat ottelut */
  async getUpcomingFixtures(season: number): Promise<ApiFootballMatch[]> {
    const now = new Date().toISOString().split('T')[0];
    const seasonConfig = SEASONS[season];
    const endDate = seasonConfig?.endDate || now;
    return this.getFixtures(season, undefined, now, endDate, 'NS');
  }

  /** Hae viimeisimmät/pelatut ottelut */
  async getRecentFixtures(season: number, limit: number = 10): Promise<ApiFootballMatch[]> {
    const now = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const fixtures = await this.getFixtures(
      season,
      undefined,
      fromDate.toISOString().split('T')[0],
      now,
      'FT'
    );
    return fixtures.slice(-limit);
  }

  /** Hae ottelun tilastot */
  async getFixtureStats(fixtureId: number): Promise<ApiFootballMatch | null> {
    const matches = await this.fetch<ApiFootballMatch[]>('/fixtures', {
      id: fixtureId,
    });
    return matches[0] || null;
  }

  /** Hae ottelun kokoonpanot */
  async getLineups(fixtureId: number): Promise<ApiFootballMatch | null> {
    const matches = await this.fetch<ApiFootballMatch[]>('/fixtures/lineups', {
      fixture: fixtureId,
    });
    return matches[0] || null;
  }

  // ============================================
  // TRANSFORMED DATA (higher-level helpers)
  // ============================================

  /** Muunna sarjataulukko sovellusmuotoon */
  async getStandingsTable(season: number): Promise<StandingEntry[]> {
    const data = await this.getStandings(season);
    if (!data || data.length === 0) return [];

    const league = data[0].league;
    if (!league.standings || league.standings.length === 0) return [];

    return league.standings[0].map((entry) => ({
      position: entry.rank,
      teamId: String(entry.team.id),
      teamName: entry.team.name,
      playedGames: entry.all.played,
      won: entry.all.win,
      draw: entry.all.draw,
      lost: entry.all.lose,
      points: entry.points,
      goalsFor: entry.all.goals.for,
      goalsAgainst: entry.all.goals.against,
      goalDifference: entry.goalsDiff,
      form: entry.form || '',
      crestUrl: entry.team.logo,
    }));
  }

  /** Muunna pelaajat sovellusmuotoon */
  async getPlayersList(season: number, teamId?: number): Promise<Player[]> {
    const data = await this.getPlayers(season, teamId);
    return data.map((p) => {
      const stats = p.statistics[0];
      return {
        id: String(p.player.id),
        name: p.player.name,
        firstName: p.player.firstname,
        lastName: p.player.lastname,
        dateOfBirth: p.player.birth.date,
        nationality: p.player.nationality,
        position: this.mapPosition(stats?.games?.position || ''),
        shirtNumber: stats?.games?.number || undefined,
        currentTeam: stats?.team?.name || '',
        currentTeamId: String(stats?.team?.id || ''),
        photoUrl: p.player.photo,
      };
    });
  }

  /** Muunna pelaajatilastot */
  async getPlayerStatsList(season: number, teamId?: number): Promise<PlayerStats[]> {
    const data = await this.getPlayers(season, teamId);
    return data.map((p) => {
      const s = p.statistics[0];
      return {
        playerId: String(p.player.id),
        playerName: p.player.name,
        teamId: String(s.team.id),
        teamName: s.team.name,
        season,
        competition: 'Veikkausliiga',
        appearances: s.games.appearences || 0,
        minutesPlayed: parseInt(String(s.games.minutes || '0'), 10),
        starts: s.games.lineups || 0,
        substitutes: s.substitutes.in || 0,
        goals: s.goals.total || 0,
        assists: s.goals.assists || 0,
        yellowCards: s.cards.yellow || 0,
        redCards: s.cards.red || 0,
        shots: s.shots.total || 0,
        shotsOnTarget: s.shots.on || 0,
        passes: s.passes.total || 0,
        passAccuracy: s.passes.accuracy || 0,
        keyPasses: s.passes.key || 0,
        dribbles: s.dribbles.attempts || 0,
        dribbleSuccess: s.dribbles.success || 0,
        tackles: s.tackles.total || 0,
        interceptions: s.tackles.interceptions || 0,
        foulsCommitted: s.fouls.committed || 0,
        foulsDrawn: s.fouls.drawn || 0,
        offsides: 0,
        duelsWon: s.duels.won || 0,
        duelsTotal: s.duels.total || 0,
        rating: parseFloat(s.games.rating || '0') || undefined,
        xG: undefined,
        xA: undefined,
      };
    });
  }

  /** Laske nuorten pelaajien aggregeeratut tilastot joukkueittain */
  async getYouthStats(season: number, league: number = VEIKKAUSLIIGA_ID): Promise<YouthStats[]> {
    const players = await this.getPlayers(season, undefined, league);
    const teamMap = new Map<string, { name: string; logo: string }>();

    // Rakenna teamMap players-datasta (primary lähde — kattaa kaikki joukkueet
    // joissa on edes yksi pelaaja datassa)
    for (const p of players) {
      const stats = p.statistics[0];
      if (!stats || !stats.team) continue;
      const teamId = String(stats.team.id);
      if (!teamMap.has(teamId)) {
        teamMap.set(teamId, { name: stats.team.name, logo: stats.team.logo });
      }
    }

    // Fallback: jos players-data ei tarjonnut joukkueita, käytä standings:ia
    if (teamMap.size === 0) {
      const standings = await this.getStandings(season, league);
      if (standings && standings[0]) {
        const entries = standings[0].league.standings?.[0] || [];
        entries.forEach((e) => {
          teamMap.set(String(e.team.id), { name: e.team.name, logo: e.team.logo });
        });
      }
    }

    // Kerää pelaajat joukkueittain
    const teamPlayers = new Map<string, Array<ApiFootballPlayer & { age: number }>>();

    for (const p of players) {
      const stats = p.statistics[0];
      if (!stats) continue;
      const teamId = String(stats.team.id);

      // Iän laskenta — suosi birth.date:a (tarkempi), validoi tulos kohtuulliselle välille.
      // API-Football palauttaa joskus rikkinäistä dataa (esim. p.player.age = 2025 jos
      // vuosi on merkitty väärään kenttään). Skip pelaaja jos ikää ei voi luotettavasti
      // määrittää — pelaajia joilla ei birth.date:a EI lasketa keski-ikään.
      let age = 0;
      let hasValidAge = false;

      if (p.player.birth?.date) {
        const birthYear = parseInt(p.player.birth.date.split('-')[0], 10);
        if (!isNaN(birthYear) && birthYear >= 1960 && birthYear <= season) {
          age = season - birthYear;
          if (age >= 14 && age <= 50) hasValidAge = true;
        }
      }

      if (!hasValidAge && typeof p.player.age === 'number'
          && p.player.age >= 14 && p.player.age <= 50) {
        age = p.player.age;
        hasValidAge = true;
      }

      if (!hasValidAge) continue; // ohita pelaaja jolla ei kelvollista ikätietoa

      const teamData = teamPlayers.get(teamId) || [];
      teamData.push({ ...p, age });
      teamPlayers.set(teamId, teamData);
    }

    // Laske nuorten tilastot
    const result: YouthStats[] = [];
    for (const [teamId, players] of teamPlayers.entries()) {
      const teamInfo = teamMap.get(teamId);
      if (!teamInfo) continue;

      let totalMinutes = 0;
      let youthMinutesU23 = 0;
      let youthMinutesU21 = 0;
      let youthMinutesU20 = 0;
      let youthMinutesU19 = 0;
      let youthMinutesU18 = 0;
      let totalPlayers = 0;
      let youthPlayersU23 = 0;
      let youthPlayersU21 = 0;
      let youthPlayersU20 = 0;
      let ageSum = 0;

      for (const p of players) {
        const stats = p.statistics[0];
        const minutes = parseInt(String(stats.games.minutes || '0'), 10);
        const age = p.age;
        const isStarter = stats.games.lineups > 0;

        totalMinutes += minutes;
        totalPlayers++;
        ageSum += age;

        if (age <= 23) {
          youthMinutesU23 += minutes;
          youthPlayersU23++;
        }
        if (age <= 21) {
          youthMinutesU21 += minutes;
          youthPlayersU21++;
        }
        if (age <= 20) {
          youthMinutesU20 += minutes;
          youthPlayersU20++;
        }
        if (age <= 19) {
          youthMinutesU19 += minutes;
        }
        if (age <= 18) {
          youthMinutesU18 += minutes;
        }
      }

      result.push({
        season,
        teamId,
        teamName: teamInfo.name,
        totalMinutes,
        youthMinutesU23,
        youthMinutesU21,
        youthMinutesU20,
        youthMinutesU19,
        youthMinutesU18,
        youthPercentageU23: totalMinutes > 0 ? Math.round((youthMinutesU23 / totalMinutes) * 1000) / 10 : 0,
        youthPercentageU21: totalMinutes > 0 ? Math.round((youthMinutesU21 / totalMinutes) * 1000) / 10 : 0,
        youthPercentageU20: totalMinutes > 0 ? Math.round((youthMinutesU20 / totalMinutes) * 1000) / 10 : 0,
        youthPercentageU19: totalMinutes > 0 ? Math.round((youthMinutesU19 / totalMinutes) * 1000) / 10 : 0,
        youthPercentageU18: totalMinutes > 0 ? Math.round((youthMinutesU18 / totalMinutes) * 1000) / 10 : 0,
        totalPlayers,
        youthPlayersU23,
        youthPlayersU21,
        youthPlayersU20,
        // Sanitoi: null jos järjenvastainen (15–50v vältetyt poikkeavat dataarvot).
        // Estää 130.5-tyyppiset arvot tallentumasta cacheen vrt. dataAggregator.ts.
        averageAge: (() => {
          if (totalPlayers <= 0) return null;
          const avg = Math.round((ageSum / totalPlayers) * 10) / 10;
          return avg >= 15 && avg <= 50 ? avg : null;
        })(),
        averageAgeStarters: 0, // Vaatisi kokoonpanodataa
        updatedAt: new Date().toISOString(),
      });
    }

    return result.sort((a, b) => b.youthPercentageU21 - a.youthPercentageU21);
  }

  /** Hae kausi-info */
  getSeasonInfo(year: number): VeikkausliigaSeason | null {
    return SEASONS[year] || null;
  }

  /** Hae kaikki kaudet */
  getAllSeasons(): VeikkausliigaSeason[] {
    return Object.values(SEASONS);
  }

  /** Map API-Football position to our Position type */
  private mapPosition(pos: string): Position {
    const p = pos.toLowerCase();
    if (p.includes('goalkeeper') || p === 'g') return 'Goalkeeper';
    if (p.includes('defender') || p === 'd') return 'Defender';
    if (p.includes('midfielder') || p === 'm') return 'Midfielder';
    return 'Attacker';
  }

  /** Muunna ottelut sovellusmuotoon */
  transformMatches(fixtures: ApiFootballMatch[]): Match[] {
    return fixtures.map((f) => ({
      id: String(f.fixture.id),
      season: f.league.season,
      matchday: this.parseMatchday(f.league.round),
      date: f.fixture.date,
      status: this.mapStatus(f.fixture.status.short),
      homeTeamId: String(f.teams.home.id),
      homeTeamName: f.teams.home.name,
      awayTeamId: String(f.teams.away.id),
      awayTeamName: f.teams.away.name,
      homeScore: f.goals.home ?? undefined,
      awayScore: f.goals.away ?? undefined,
      venue: f.fixture.venue?.name,
      referee: f.fixture.referee || undefined,
    }));
  }

  private parseMatchday(round: string): number {
    const match = round.match(/Regular Season - (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private mapStatus(status: string): Match['status'] {
    switch (status) {
      case 'NS':
      case 'TBD':
        return 'SCHEDULED';
      case '1H':
      case 'HT':
      case '2H':
      case 'ET':
        return 'LIVE';
      case 'FT':
      case 'AET':
      case 'PEN':
        return 'FINISHED';
      case 'PST':
        return 'POSTPONED';
      default:
        return 'SCHEDULED';
    }
  }
}

export const footballApi = new FootballApiService();
