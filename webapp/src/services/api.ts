// ============================================
// PALLOTALENTTI.FI - Frontend API Service
// Connects to Firebase Functions backend
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  cached: boolean;
  source: string;
  timestamp: string;
}

/** Base API client */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  // Väliaikainen debug — auttaa diagnosoimaan URL-bugeja
  // eslint-disable-next-line no-console
  console.log('[fetchApi] GET', url);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  // eslint-disable-next-line no-console
  console.log('[fetchApi]', url, '→', response.status, response.ok ? 'OK' : 'FAIL');

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) {
    throw new Error('API returned unsuccessful response');
  }
  return result.data;
}

// ============================================
// SEASONS
// ============================================
export interface SeasonInfo {
  year: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
  numberOfMatchdays: number;
  numberOfTeams: number;
  status: 'upcoming' | 'ongoing' | 'finished';
}

export const getSeasons = (): Promise<SeasonInfo[]> =>
  fetchApi('/seasons');

export const getSeason = (year: number): Promise<SeasonInfo> =>
  fetchApi(`/seasons/${year}`);

// ============================================
// STANDINGS
// ============================================
export interface StandingEntry {
  position: number;
  teamId: string;
  teamName: string;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string;
  crestUrl?: string;
}

export const getStandings = (season: number): Promise<StandingEntry[]> =>
  fetchApi(`/standings/${season}`);

// ============================================
// TEAMS
// ============================================
export interface Team {
  id: string;
  name: string;
  shortName: string;
  tla: string;
  venue: string;
  founded: number;
  clubColors: string;
  crestUrl: string;
  address: string;
}

export const getTeams = (season: number): Promise<Team[]> =>
  fetchApi(`/teams/${season}`);

export const getTeamPlayers = (season: number, teamId: string): Promise<Player[]> =>
  fetchApi(`/teams/${season}/${teamId}/players`);

// ============================================
// PLAYERS
// ============================================
export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';

export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  position: Position;
  shirtNumber?: number;
  currentTeam: string;
  currentTeamId: string;
  photoUrl?: string;
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  season: number;
  competition: string;
  appearances: number;
  minutesPlayed: number;
  starts: number;
  substitutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passAccuracy: number;
  keyPasses: number;
  dribbles: number;
  dribbleSuccess: number;
  tackles: number;
  interceptions: number;
  foulsCommitted: number;
  foulsDrawn: number;
  offsides: number;
  duelsWon: number;
  duelsTotal: number;
  rating?: number;
  xG?: number;
  xA?: number;
  npg?: number;
  npxG?: number;
  /** Ikä kauden alussa. Asetetaan vain getYouthAggregation:n topYouthPlayers-listalle. */
  age?: number;
}

export interface PlayerFilters {
  teamId?: string;
  position?: Position;
  minAge?: number;
  maxAge?: number;
  minMinutes?: number;
  sortBy?: string;
  limit?: number;
}

export const getPlayers = (season: number, filters?: PlayerFilters): Promise<PlayerStats[]> => {
  const params = new URLSearchParams();
  if (filters?.teamId) params.append('teamId', filters.teamId);
  if (filters?.position) params.append('position', filters.position);
  if (filters?.minMinutes) params.append('minMinutes', String(filters.minMinutes));
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.limit) params.append('limit', String(filters.limit));
  return fetchApi(`/players/${season}?${params}`);
};

export const getPlayersWithMarketValues = (
  season: number
): Promise<Array<Player & { marketValue?: number }>> =>
  fetchApi(`/players/${season}/market-values`);

// ============================================
// YOUTH STATS (Core feature)
// ============================================
export interface YouthStats {
  season: number;
  teamId: string;
  teamName: string;
  totalMinutes: number;
  youthMinutesU23: number;
  youthMinutesU21: number;
  youthMinutesU20: number;
  youthMinutesU19: number;
  youthMinutesU18: number;
  youthPercentageU23: number;
  youthPercentageU21: number;
  youthPercentageU20: number;
  youthPercentageU19: number;
  youthPercentageU18: number;
  totalPlayers: number;
  youthPlayersU23: number;
  youthPlayersU21: number;
  youthPlayersU20: number;
  // null = ei luotettavaa keski-ikätietoa (esim. virheellistä API-Football-dataa)
  averageAge: number | null;
  averageAgeStarters: number;
  updatedAt: string;
}

export interface YouthAggregation {
  season: number;
  league: string;
  totalPlayersAnalyzed: number;
  youthPlayersU21: number;
  youthPlayersU23: number;
  totalMinutesPlayed: number;
  youthMinutesU21: number;
  youthMinutesU23: number;
  youthPercentageU21: number;
  youthPercentageU23: number;
  teamBreakdown: YouthStats[];
  topYouthPlayers: PlayerStats[];
  updatedAt: string;
}

export const getYouthStats = (
  season: number,
  ageGroup?: 'u23' | 'u21' | 'u20' | 'u19' | 'u18'
): Promise<YouthStats[]> => {
  const params = ageGroup ? `?ageGroup=${ageGroup}` : '';
  return fetchApi(`/youth-stats/${season}${params}`);
};

/**
 * Datavajeen kynnysarvo. Joukkueet joilla totalMinutes alle tämän pudotetaan
 * kaikista U23-laskelmista — pieni otos ei ole luotettava.
 * Peruste: Veikkausliigan tasaiseen otteluohjelmaan kuuluu n. 990 min/joukkue
 * yhden täysottelun jälkeen kaikille pelaajille — alle 1000 min koko joukkueella
 * tarkoittaa siis API-Footballin datavajetta, ei oikeaa peliaikatilannetta.
 */
export const LOW_DATA_TOTAL_MINUTES = 1000;

export function filterReliableTeams(teams: YouthStats[]): YouthStats[] {
  return teams.filter((t) => t.totalMinutes >= LOW_DATA_TOTAL_MINUTES);
}

/**
 * Yhtenäinen U23-pelaajaesitys. Yhdistää kaksi datalähdettä:
 *  - youthAgg.topYouthPlayers (API-Football): luotettava ikä, U23-suodatus jo
 *    tehty backendissä; minuutit/maalit voivat olla epätarkkoja.
 *  - officialPlayers (Veikkausliiga.com scraper): tarkat minuutit/maalit/syötöt,
 *    ei ikätietoa eikä U23-suodatusta.
 *
 * Strategia: lähdetään AINA topYouthPlayers-listasta (= varmistettu U23) ja
 * rikastetaan official-datalla sukunimi-matchilla. Tämä takaa ettei
 * U23-näkymiin pääse yli-23-vuotiaita pelaajia.
 */
export interface U23Player {
  playerId: string;
  playerName: string;
  teamName: string;
  age: number;
  minutes: number;
  goals: number;
  assists: number;
}

export function buildU23Players(
  topYouthPlayers: PlayerStats[],
  officialPlayers: OfficialPlayer[],
): U23Player[] {
  return topYouthPlayers
    .filter((p): p is PlayerStats & { age: number } => p.age !== undefined)
    .map((p) => {
      const lastName = p.playerName.split(' ').pop()?.toLowerCase() ?? '';
      const official = lastName
        ? officialPlayers.find((o) => o.name.toLowerCase().includes(lastName))
        : undefined;
      return {
        playerId: p.playerId,
        playerName: p.playerName,
        teamName: p.teamName,
        age: p.age,
        minutes: official?.minutes ?? p.minutesPlayed,
        goals: official?.goals ?? p.goals,
        assists: official?.assists ?? p.assists,
      };
    });
}

/** Kaikki 3 sarjaa yhdellä kutsulla — käytä etusivulla */
export interface YouthStatsAll {
  veikkausliiga: YouthStats[];
  ykkosliiga: YouthStats[];
  ykkonen: YouthStats[];
}

export const getYouthStatsAll = (season: number): Promise<YouthStatsAll> =>
  fetchApi(`/youth-stats/${season}/all`);

export const getYouthAggregation = (season: number): Promise<YouthAggregation> =>
  fetchApi(`/youth-aggregation/${season}`);

// ============================================
// PLAYER BY ID (API-Football season-detail)
// ============================================
/** API-Footballin /players?id=&season=&league= -vastausmuoto (yksi pelaaja).
 *  Backendin /api/player/:playerId/season/:season palauttaa arrayn näitä
 *  (yleensä yksi alkio league-suodatuksen takia). */
export interface ApiFootballPlayerSeason {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: { date: string; place: string; country: string };
    nationality: string;
    height: string;
    weight: string;
    injured: boolean;
    photo: string;
  };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    league: { id: number; name: string; season: number };
    games: {
      appearences: number; // API-Football kirjoitusvirhe alkup. JSON:ssa
      lineups: number;
      minutes: number;
      number: number | null;
      position: string;
      rating: string | null;
      captain: boolean;
    };
    substitutes: { in: number; out: number; bench: number };
    shots: { total: number | null; on: number | null };
    goals: {
      total: number | null;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    passes: { total: number | null; key: number | null; accuracy: number | null };
    tackles: {
      total: number | null;
      blocks: number | null;
      interceptions: number | null;
    };
    duels: { total: number | null; won: number | null };
    dribbles: {
      attempts: number | null;
      success: number | null;
      past: number | null;
    };
    fouls: { drawn: number | null; committed: number | null };
    cards: { yellow: number | null; red: number | null };
    penalty: {
      won: number | null;
      committed: number | null;
      scored: number | null;
      missed: number | null;
      saved: number | null;
    };
  }>;
}

export const getPlayerSeason = (
  playerId: string | number,
  season: number,
): Promise<ApiFootballPlayerSeason[]> =>
  fetchApi(`/player/${playerId}/season/${season}`);

// ============================================
// OFFICIAL STATS (Veikkausliiga.com scrape)
// ============================================
export interface OfficialPlayer {
  rank: number;
  name: string;           // "Etunimi Sukunimi" (jo muunnettu scraperissa)
  team: string;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  starts: number;
  yellowCards: number;
  redCards: number;
  season: number;
  source: string;
  /** Ei vielä scrapessa, varauduttu tulevaisuuden rikastukseen (esim. API-Football join). */
  age?: number;
}

export interface OfficialStatsResponse {
  data: OfficialPlayer[];
  meta: { count: number; updatedAt: string; season: number } | null;
}

/** Vastaus on rakenteeltaan { success, data, meta, timestamp } — meta jää
 *  fetchApi-helperilta huomiotta, joten käytetään tässä omaa fetcheriä. */
export async function getOfficialStats(year: number): Promise<OfficialStatsResponse> {
  const url = `${API_BASE_URL}/official-stats/${year}`;
  // eslint-disable-next-line no-console
  console.log('[getOfficialStats] GET', url);
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  const result = (await response.json()) as {
    success: boolean;
    data: OfficialPlayer[];
    meta: OfficialStatsResponse['meta'];
  };
  if (!result.success) throw new Error('API returned unsuccessful response');
  return { data: result.data, meta: result.meta };
}

// ============================================
// MATCHES
// ============================================
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED';

export interface Match {
  id: string;
  season: number;
  matchday: number;
  date: string;
  status: MatchStatus;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  referee?: string;
}

export const getMatches = (
  season: number,
  status?: 'upcoming' | 'recent' | 'all'
): Promise<Match[]> => {
  if (status === 'upcoming') return fetchApi(`/matches/${season}/upcoming`);
  if (status === 'recent') return fetchApi(`/matches/${season}/recent`);
  return fetchApi(`/matches/${season}`);
};

// ============================================
// MARKET VALUES
// ============================================
export interface TeamMarketValue {
  team: string;
  totalValue: number;
  playerCount: number;
  averageValue: number;
}

export const getTeamMarketValues = (): Promise<TeamMarketValue[]> =>
  fetchApi('/team-market-values');

// ============================================
// ADMIN
// ============================================
export const refreshSeasonData = (season: number): Promise<unknown> =>
  fetchApi(`/admin/refresh/${season}`, { method: 'POST' });

export const getCacheStats = (): Promise<{
  totalEntries: number;
  bySource: Record<string, number>;
  expiredEntries: number;
}> => fetchApi('/admin/cache-stats');
