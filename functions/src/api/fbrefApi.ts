// ============================================
// FBref SCRAPER
// Scrapes advanced stats (xG, xA, etc.) from
// FBref.com for Veikkausliiga
// ============================================
import axios from 'axios';
import * as cheerio from 'cheerio';
import { FbrefPlayerStats, PlayerStats } from '../types';

const FBREF_BASE = 'https://fbref.com';

// Veikkausliiga league IDs in FBref
const LEAGUE_IDS: Record<number, string> = {
  2024: '43',
  2025: '43',
  2026: '43',
};

class FbrefService {
  private client = axios.create({
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  /** Rakenna Veikkausliigan URL kaudelle */
  private getLeagueUrl(season: number): string {
    const leagueId = LEAGUE_IDS[season] || '43';
    return `${FBREF_BASE}/en/comps/${leagueId}/${season}/stats/players/${season}-Veikkausliiga-Stats`;
  }

  /** Rakenne sarjataulukon URL */
  private getStandingsUrl(season: number): string {
    const leagueId = LEAGUE_IDS[season] || '43';
    return `${FBREF_BASE}/en/comps/${leagueId}/${season}/`;
  }

  /** Scrapeta pelaajatilastot */
  async scrapePlayerStats(season: number): Promise<FbrefPlayerStats[]> {
    const url = this.getLeagueUrl(season);
    console.log(`Scraping FBref player stats: ${url}`);

    try {
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);

      // FBref hides data tables in HTML comments
      const comments = $('*').contents().filter(function () {
        return this.type === 'comment';
      });

      let tableHtml = '';
      comments.each((_, comment) => {
        const commentData = (comment as { data?: string }).data || '';
        if (commentData.includes('div_stats_standard')) {
          tableHtml = commentData;
        }
      });

      if (!tableHtml) {
        // Try direct table
        tableHtml = response.data;
      }

      const table$ = cheerio.load(tableHtml);
      const rows: FbrefPlayerStats[] = [];

      table$('table#stats_standard tbody tr').each((_, row) => {
        const $row = table$(row);
        if ($row.hasClass('thead') || $row.hasClass('over_header')) return;

        const cells = $row.find('td');
        if (cells.length < 10) return;

        const playerName = $row.find('th[data-stat="player"]').text().trim();
        if (!playerName) return;

        const getCell = (stat: string): string => {
          return $row.find(`td[data-stat="${stat}"]`).text().trim() || '0';
        };

        const getNum = (stat: string): number => {
          const val = parseFloat(getCell(stat));
          return isNaN(val) ? 0 : val;
        };

        rows.push({
          player: playerName,
          nation: getCell('nationality'),
          pos: getCell('position'),
          squad: getCell('team'),
          age: getNum('age'),
          born: getNum('birth_year'),
          mp: getNum('games'),
          starts: getNum('games_starts'),
          min: getNum('minutes'),
          gls: getNum('goals'),
          ast: getNum('assists'),
          pk: getNum('pens_made'),
          pkatt: getNum('pens_att'),
          crdy: getNum('cards_yellow'),
          crdr: getNum('cards_red'),
          xg: getNum('xg'),
          npxg: getNum('npxg'),
          xag: getNum('xa'),
          prgc: getNum('progressive_carries'),
          prgp: getNum('progressive_passes'),
        });
      });

      console.log(`Scraped ${rows.length} player stats from FBref for ${season}`);
      return rows;
    } catch (error) {
      console.error(`FBref scrape error for ${season}:`, error);
      return [];
    }
  }

  /** Scrapeta joukkueen pelaajat */
  async scrapeTeamPlayers(teamSlug: string, season: number): Promise<FbrefPlayerStats[]> {
    const url = `${FBREF_BASE}/en/squads/${teamSlug}/${season}/`;
    console.log(`Scraping team players: ${url}`);

    try {
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);

      // Same comment-based table extraction
      const comments = $('*').contents().filter(function () {
        return this.type === 'comment';
      });

      let tableHtml = '';
      comments.each((_, comment) => {
        const commentData = (comment as { data?: string }).data || '';
        if (commentData.includes('div_stats_standard')) {
          tableHtml = commentData;
        }
      });

      const table$ = cheerio.load(tableHtml);
      const rows: FbrefPlayerStats[] = [];

      table$('table#stats_standard tbody tr').each((_, row) => {
        const $row = table$(row);
        if ($row.hasClass('thead')) return;

        const playerName = $row.find('th[data-stat="player"]').text().trim();
        if (!playerName) return;

        const getNum = (stat: string): number => {
          const val = parseFloat($row.find(`td[data-stat="${stat}"]`).text().trim());
          return isNaN(val) ? 0 : val;
        };

        rows.push({
          player: playerName,
          nation: $row.find('td[data-stat="nationality"]').text().trim(),
          pos: $row.find('td[data-stat="position"]').text().trim(),
          squad: '', // Will be set by caller
          age: getNum('age'),
          born: getNum('birth_year'),
          mp: getNum('games'),
          starts: getNum('games_starts'),
          min: getNum('minutes'),
          gls: getNum('goals'),
          ast: getNum('assists'),
          pk: getNum('pens_made'),
          pkatt: getNum('pens_att'),
          crdy: getNum('cards_yellow'),
          crdr: getNum('cards_red'),
          xg: getNum('xg'),
          npxg: getNum('npxg'),
          xag: getNum('xa'),
          prgc: getNum('progressive_carries'),
          prgp: getNum('progressive_passes'),
        });
      });

      return rows;
    } catch (error) {
      console.error(`FBref team scrape error for ${teamSlug}:`, error);
      return [];
    }
  }

  /** Muunna FBref-tilastot sovellusmuotoon */
  transformToPlayerStats(fbrefStats: FbrefPlayerStats[], season: number): PlayerStats[] {
    return fbrefStats.map((s) => ({
      playerId: `fbref_${s.player.toLowerCase().replace(/\s+/g, '_')}`,
      playerName: s.player,
      teamId: s.squad.toLowerCase().replace(/\s+/g, '_'),
      teamName: s.squad,
      season,
      competition: 'Veikkausliiga',
      appearances: s.mp,
      minutesPlayed: s.min,
      starts: s.starts,
      substitutes: s.mp - s.starts,
      goals: s.gls,
      assists: s.ast,
      yellowCards: s.crdy,
      redCards: s.crdr,
      shots: 0,
      shotsOnTarget: 0,
      passes: 0,
      passAccuracy: 0,
      keyPasses: 0,
      dribbles: 0,
      dribbleSuccess: 0,
      tackles: 0,
      interceptions: 0,
      foulsCommitted: 0,
      foulsDrawn: 0,
      offsides: 0,
      duelsWon: 0,
      duelsTotal: 0,
      xG: s.xg,
      xA: s.xag,
      npg: s.gls - s.pk,
      npxG: s.npxg,
    }));
  }

  /** Scrapeta sarjataulukko */
  async scrapeStandings(season: number): Promise<Array<{
    position: number;
    team: string;
    mp: number;
    w: number;
    d: number;
    l: number;
    gf: number;
    ga: number;
    gd: number;
    pts: number;
  }> | undefined> {
    const url = this.getStandingsUrl(season);
    try {
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);
      const rows: Array<{ position: number; team: string; mp: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }> = [];

      $('table.stats_table tbody tr').each((_, row) => {
        const $row = $(row);
        const position = parseInt($row.find('th[data-stat="rank"]').text().trim());
        if (isNaN(position)) return;

        const team = $row.find('td[data-stat="team"]').text().trim();
        const mp = parseInt($row.find('td[data-stat="games"]').text().trim()) || 0;
        const w = parseInt($row.find('td[data-stat="wins"]').text().trim()) || 0;
        const d = parseInt($row.find('td[data-stat="ties"]').text().trim()) || 0;
        const l = parseInt($row.find('td[data-stat="losses"]').text().trim()) || 0;
        const gf = parseInt($row.find('td[data-stat="goals_for"]').text().trim()) || 0;
        const ga = parseInt($row.find('td[data-stat="goals_against"]').text().trim()) || 0;
        const gd = gf - ga;
        const pts = parseInt($row.find('td[data-stat="points"]').text().trim()) || 0;

        rows.push({ position, team, mp, w, d, l, gf, ga, gd, pts });
      });

      return rows;
    } catch (error) {
      console.error(`FBref standings scrape error:`, error);
      return undefined;
    }
  }

  /** Hae xG-tilastot FootyStats-sivustosta (varmuuskopiolähde) */
  async getXgFromFootyStats(): Promise<Array<{
    team: string;
    xGFor: number;
    xGAgainst: number;
    matches: number;
  }> | undefined> {
    try {
      const response = await this.client.get('https://footystats.org/finland/veikkausliiga/xg');
      const $ = cheerio.load(response.data);
      const teams: Array<{ team: string; xGFor: number; xGAgainst: number; matches: number }> = [];

      $('table tbody tr').each((_, row) => {
        const $row = $(row);
        const team = $row.find('td').first().text().trim();
        const cells = $row.find('td');
        if (cells.length >= 5) {
          const xGFor = parseFloat($(cells[3]).text().trim()) || 0;
          const xGAgainst = parseFloat($(cells[5]).text().trim()) || 0;
          const matches = parseInt($(cells[1]).text().trim()) || 0;
          teams.push({ team, xGFor, xGAgainst, matches });
        }
      });

      return teams;
    } catch (error) {
      console.error('FootyStats xG scrape error:', error);
      return undefined;
    }
  }
}

export const fbrefApi = new FbrefService();
