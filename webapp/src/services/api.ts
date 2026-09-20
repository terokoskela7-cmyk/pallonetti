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

/**
 * Datavajeen kynnysarvo. Joukkueet joilla totalMinutes alle tämän pudotetaan
 * kaikista U23-laskelmista — pieni otos ei ole luotettava.
 * Peruste: Veikkausliigan tasaiseen otteluohjelmaan kuuluu n. 990 min/joukkue
 * yhden täysottelun jälkeen kaikille pelaajille — alle 1000 min koko joukkueella
 * tarkoittaa siis lähdeaineiston datavajetta, ei oikeaa peliaikatilannetta.
 */
export const LOW_DATA_TOTAL_MINUTES = 1000;

export function filterReliableTeams(teams: YouthStats[]): YouthStats[] {
  return teams.filter((t) => t.totalMinutes >= LOW_DATA_TOTAL_MINUTES);
}

/**
 * Yhtenäinen U23-pelaajaesitys. Yhdistää kaksi datalähdettä:
 *  - youthAgg.topYouthPlayers: luotettava ikä, U23-suodatus jo
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
  /** Ei vielä scrapessa, varauduttu tulevaisuuden rikastukseen. */
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

/**
 * Kaikki tuodut kaudet, vanhin ensin. Laskenta tehdään palvelimella.
 *
 * Yksi uudelleenyritys: pyyntö käy läpi seitsemän kauden aineiston, ja
 * kylmä funktio ehti kerran kaatua ensimmäiseen kutsuun. Käyttäjälle
 * virheteksti tavallisella latauksella on huonompi kuin yksi hiljainen
 * uusinta. Toinen epäonnistuminen näytetään.
 */
export async function getTrendit(): Promise<TrendiKausi[]> {
  try {
    return await fetchApi<TrendiKausi[]>('/trendit');
  } catch (e) {
    console.warn('[trendit] ensimmäinen yritys epäonnistui, yritetään uudelleen:', e);
    await new Promise((r) => setTimeout(r, 1200));
    return fetchApi<TrendiKausi[]>('/trendit');
  }
}

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
