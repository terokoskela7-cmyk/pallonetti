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

// ============================================
// YOUTH STATS (Core feature)
// ============================================
export interface YouthStats {
  season: number;
  teamId: string;
  teamName: string;
  /** Joukkueen koko minuuttikapasiteetti kaudella = Σ ottelut × 90 × 11. */
  totalMinutes: number;
  minuutitNuoret: number;
  minuutitAlle21: number;
  youthMinutesU19: number;
  youthMinutesU18: number;
  osuusNuoret: number;
  osuusAlle21: number;
  youthPercentageU19: number;
  youthPercentageU18: number;
  pelaajatNuoret: number;
  pelaajatAlle21: number;
  /** null = ei luotettavaa keski-ikätietoa. */
  averageAge: number | null;
  updatedAt: string;

  // ----- U23: EI saatavilla nykyisestä lähteestä -----
  // Veikkausliigan Excel-vienti on suodatettu 17–21-vuotiaisiin, joten
  // U23-lukua ei voi laskea. Se ei ole sama kuin U21 eikä nolla, joten
  // kentät ovat valinnaisia ja UI näyttää niiden puuttuessa "ei dataa".
  // Palaavat sellaisenaan jos vienti tehdään haarukalla 17–23.
  youthMinutesU23?: number;
  youthPercentageU23?: number;
  youthPlayersU23?: number;
  totalPlayers?: number;
  averageAgeStarters?: number;
}

export interface YouthAggregation {
  season: number;
  league: string;
  totalPlayersAnalyzed: number;
  pelaajatNuoret: number;
  totalMinutesPlayed: number;
  minuutitNuoret: number;
  osuusNuoret: number;
  teamBreakdown: YouthStats[];
  topYouthPlayers: PlayerStats[];
  updatedAt: string;
  /** Vain runkosarja — vertailukelpoinen kausien yli (22 ottelua joka kausi). */
  osuusNuoretRunkosarja?: number;
  /** Mitä ikiä lähde tosiasiassa sisältää. u23Saatavilla=false → ei U23-lukua. */
  ikahaarukka?: { min: number; max: number; u23Saatavilla: boolean };
  // U23 ei ole saatavilla nykyisestä lähteestä — ks. YouthStats.
  youthPlayersU23?: number;
  youthMinutesU23?: number;
  youthPercentageU23?: number;
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
  rating?: number;
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
        rating: p.rating,
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

/** Kierroskohtainen U21 peliaika-% — backend laskee päättyneistä otteluista.
 *  U21 = syntynyt (season-21) tai myöhemmin (2026 → 2005), sama joukko kuin
 *  osuusNuoret-KPI. */
export interface U21RoundTrendPoint {
  round: number;
  u21Pct: number;
  nuortenMins: number;
  totalMins: number;
}

export const getU21RoundTrend = (
  season: number,
): Promise<U21RoundTrendPoint[]> => fetchApi(`/u21-round-trend/${season}`);

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

/** Pelaajan kierroskohtainen rivi — backend kokoaa joukkueen otteluista. */
export interface PlayerFixture {
  round: string; // API-Football: "Regular Season - 7"
  date: string; // ISO
  minutes: number; // 0 jos ei pelannut
  goals: number;
  assists: number;
  rating: number | null;
  homeTeam: string;
  awayTeam: string;
  score: string | null; // "2-1"
}

export const getPlayerFixtures = (
  playerId: string,
  season: number,
): Promise<PlayerFixture[]> =>
  fetchApi(`/player/${playerId}/fixtures?season=${season}`);

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
// ADMIN
// ============================================
export const refreshSeasonData = (season: number): Promise<unknown> =>
  fetchApi(`/admin/refresh/${season}`, { method: 'POST' });

export const getCacheStats = (): Promise<{
  totalEntries: number;
  bySource: Record<string, number>;
  expiredEntries: number;
}> => fetchApi('/admin/cache-stats');

// ============================================
// SEASON PLAYERS (Firestore Excel-import data — Vaihe B)
// Lähde: seasons/{season}/players ja rounds/*/players.
// ============================================
/**
 * Kesken kauden tapahtunut siirto tai laina ulkomaille (B5).
 *
 * Lahde on aina mukana: pelaajasivu nayttaa merkinnan vain, jos lahde on
 * olemassa, eika merkintaa tehda ilman sita.
 */
export interface Siirto {
  pelaaja: string;
  seura: string;
  uusi_seura: string;
  maa: string;
  tyyppi: 'siirto' | 'laina';
  /** null, kun lahde ei kerro tarkkaa paivaa. */
  pvm: string | null;
  lahde_url: string;
}

export interface SeasonPlayer {
  slug: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  joukkue: string;
  minTotal: number;
  ottelutTotal: number;
  aloituksetTotal: number;
  maaliTotal: number;
  lastUpdatedRound: number;
  /** Vain yksittaisen pelaajan haussa; listassa kentta puuttuu. */
  siirto?: Siirto | null;
}

export interface PlayerRound {
  round: number;
  cumMin: number;
  cumMaalit: number;
  cumOttelut: number;
}

/** Kaikki kauden pelaajat (seasons/{season}/players/*). */
export const getSeasonPlayers = (season: number): Promise<SeasonPlayer[]> =>
  fetchApi(`/season-players/${season}`);

/** Yksittäinen pelaaja — null jos 404 (fetchApi heittäisi, joten oma fetch). */
export async function getSeasonPlayer(
  season: number,
  slug: string,
): Promise<SeasonPlayer | null> {
  const url = `${API_BASE_URL}/season-players/${season}/${encodeURIComponent(slug)}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  const result = (await response.json()) as {
    success: boolean;
    data: SeasonPlayer;
  };
  if (!result.success) throw new Error('API returned unsuccessful response');
  return result.data;
}

/** Pelaajan kierrosdata (kehityskäyrä) — kumulatiiviset arvot per kierros. */
export const getPlayerRounds = (
  season: number,
  slug: string,
): Promise<PlayerRound[]> =>
  fetchApi(`/season-players/${season}/${encodeURIComponent(slug)}/rounds`);

// ============================================
// KAUSITRENDIT — yksi piste per kausi
// ============================================
/** Alle 21 -osuuden kolmijako, % liigan minuuttikapasiteetista. */
export interface Kolmijako {
  fin: number;
  muu: number;
  eiTietoa: number;
}

export interface TrendiKausi {
  kausi: number;
  /** Päämittari 17–21. null = kaudelta ei ole dataa (ei 0). */
  osuus1721: number | null;
  osuusAlle21: number | null;
  /** null, kun kaudelta ei ole kansalaisuustietoa. */
  alle21Jako: Kolmijako | null;
  kesken: boolean;
  otteluitaPelattu: number | null;
  pelaajia: number | null;
}

/** Kaikki tuodut kaudet, vanhin ensin. Laskenta tehdään palvelimella. */
export const getTrendit = (): Promise<TrendiKausi[]> => fetchApi('/trendit');

// ============================================
// KAUDET — valitsimen lähde
// ============================================
export interface KausiInfo {
  kausi: number;
  sarja: string;
  pelaajat: number | null;
  joukkueet: number | null;
  tuotuPvm: string | null;
}

/**
 * Saatavilla olevat kaudet, uusin ensin. Lähde on backendin kaudet-kokoelma,
 * ei kovakoodattu lista — uusi kausi ilmestyy tuonnin jälkeen itsestään.
 */
export const getKaudet = (): Promise<KausiInfo[]> => fetchApi('/kaudet');

// ============================================
// KANSALAISUUDET — minuuteilla painotettu osuus
// ============================================
export interface KansalaisuusTiedot {
  saatavilla: boolean;
  kausi: number;
  pelaajia?: number;
  suomalaisia?: number;
  osuus1721?: number | null;
  osuus1721Suomalaiset?: number | null;
  osuusAlle21?: number | null;
  /** Suomen kansalaisille mennyt osuus, Veikkausliigan rekisterin mukaan. */
  osuusAlle21Suomalaiset?: number | null;
  /** Alle 21 -osuuden kolmijako; null kun kaudelta ei ole tietoa. */
  alle21Jako?: Kolmijako | null;
}

/**
 * Kansalaisuustiedot kaudelle. Kaikilla kausilla ei ole dataa, jolloin
 * saatavilla on false eikä lukuja esitetä.
 */
export const getKansalaisuudet = (season: number): Promise<KansalaisuusTiedot> =>
  fetchApi(`/kansalaisuudet/${season}`);

/** Sama slug-logiikka kuin backendin toSlug() (excelImport.ts). */
export function toSlug(etu: string, suku: string): string {
  return `${etu}-${suku}`
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
