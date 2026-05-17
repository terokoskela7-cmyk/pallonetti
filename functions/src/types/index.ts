// ============================================
// PALLOTALENTTI.FI - Type Definitions
// Finnish Football Data Types
// ============================================

/** Joukkueen perustiedot */
export interface Team {
  id: string;
  name: string;
  shortName: string;
  tla: string;
  venue: string;
  founded: number;
  clubColors: string;
  website: string;
  crestUrl: string;
  address: string;
}

/** Pelaajan perustiedot */
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

/** Pelipaikka */
export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';

/** Pelaajan tilastot yhdellä kaudella */
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
  xGChain?: number;
  xGBuildup?: number;
}

/** Sarjataulukon joukkue */
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

/** Sarjataulukko */
export interface Standings {
  season: number;
  competition: string;
  matchday: number;
  stage: string;
  type: 'TOTAL' | 'HOME' | 'AWAY';
  table: StandingEntry[];
}

/** Yksittäinen ottelu */
export interface Match {
  id: string;
  season: number;
  matchday: number;
  date: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED';
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  referee?: string;
  goals?: MatchGoal[];
  lineups?: Lineup;
  statistics?: MatchStats;
}

/** Maali ottelussa */
export interface MatchGoal {
  minute: number;
  extraTime?: number;
  type: 'REGULAR' | 'OWN' | 'PENALTY';
  team: string;
  scorer: string;
  scorerId: string;
  assist?: string;
  assistId?: string;
}

/** Kokoonpano */
export interface Lineup {
  homeTeam: LineupPlayer[];
  awayTeam: LineupPlayer[];
  homeSubstitutes: LineupPlayer[];
  awaySubstitutes: LineupPlayer[];
  homeFormation: string;
  awayFormation: string;
  homeCoach: string;
  awayCoach: string;
}

/** Kokoonpanon pelaaja */
export interface LineupPlayer {
  id: string;
  name: string;
  number: number;
  position: string;
  grid?: string;
  captain: boolean;
  minutesPlayed?: number;
  rating?: number;
}

/** Ottelutilastot */
export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
  offsides: { home: number; away: number };
  passes: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  xG?: { home: number; away: number };
}

/** Nuorten pelaajien aggregeeratut tilastot */
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

/** Cache-merkintä Firestoreen */
export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  expiresAt: string;
  source: string;
  version: number;
}

/** API-vastaus */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  cached: boolean;
  source: string;
  timestamp: string;
}

/** API-Football vastaus */
export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: { current: number; total: number };
  response: T;
}

/** API-Football joukkue */
export interface ApiFootballTeam {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    founded: number;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    address: string;
    city: string;
    capacity: number;
    surface: string;
    image: string;
  };
}

/** API-Football pelaaja */
export interface ApiFootballPlayer {
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
      appearences: number;
      lineups: number;
      minutes: number;
      number: number | null;
      position: string;
      rating: string;
      captain: boolean;
    };
    substitutes: { in: number; out: number; bench: number };
    shots: { total: number | null; on: number | null };
    goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
    passes: { total: number | null; key: number | null; accuracy: number | null };
    tackles: { total: number | null; blocks: number | null; interceptions: number | null };
    duels: { total: number | null; won: number | null };
    dribbles: { attempts: number | null; success: number | null; past: number | null };
    fouls: { drawn: number | null; committed: number | null };
    cards: { yellow: number | null; red: number | null };
    penalty: { won: number | null; committed: number | null; scored: number | null; missed: number | null; saved: number | null };
  }>;
}

/** API-Football sarjataulukko */
export interface ApiFootballStanding {
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
    standings: Array<Array<{
      rank: number;
      team: { id: number; name: string; logo: string };
      points: number;
      goalsDiff: number;
      group: string;
      form: string;
      status: string;
      description: string;
      all: {
        played: number;
        win: number;
        draw: number;
        lose: number;
        goals: { for: number; against: number };
      };
      home: {
        played: number;
        win: number;
        draw: number;
        lose: number;
        goals: { for: number; against: number };
      };
      away: {
        played: number;
        win: number;
        draw: number;
        lose: number;
        goals: { for: number; against: number };
      };
      update: string;
    }>>;
  };
}

/** API-Football ottelu */
export interface ApiFootballMatch {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: { first: number | null; second: number | null };
    venue: { id: number | null; name: string; city: string };
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  lineups?: Array<{
    team: { id: number; name: string; logo: string };
    coach: { id: number; name: string; photo: string };
    formation: string;
    startXI: Array<{ player: { id: number; name: string; number: number; pos: string; grid: string | null } }>;
    substitutes: Array<{ player: { id: number; name: string; number: number; pos: string; grid: string | null } }>;
  }>;
  statistics?: Array<{
    team: { id: number; name: string; logo: string };
    statistics: Array<{ type: string; value: number | string | null }>;
  }>;
}

/** FBref-pelaajatilastot */
export interface FbrefPlayerStats {
  player: string;
  nation: string;
  pos: string;
  squad: string;
  age: number;
  born: number;
  mp: number;
  starts: number;
  min: number;
  gls: number;
  ast: number;
  pk: number;
  pkatt: number;
  crdy: number;
  crdr: number;
  xg: number;
  npxg: number;
  xag: number;
  prgc: number;
  prgp: number;
  // ... more fields available
}

/** Veikkausliigan kausi-info */
export interface VeikkausliigaSeason {
  year: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
  numberOfMatchdays: number;
  numberOfTeams: number;
  apiFootballLeagueId: number;
  fbrefLeagueUrl: string;
  status: 'upcoming' | 'ongoing' | 'finished';
}

/** Suodatinparametrit */
export interface PlayerFilters {
  season?: number;
  teamId?: string;
  position?: Position;
  minAge?: number;
  maxAge?: number;
  minMinutes?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/** Aggregaattivastaus */
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
