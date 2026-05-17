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
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

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
  averageAge: number;
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
