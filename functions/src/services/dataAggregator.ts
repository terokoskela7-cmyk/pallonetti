// ============================================
// DATA AGGREGATOR
// Combines data from multiple sources:
// - API-Football (primary: matches, standings, players)
// - FBref (xG, xA, advanced stats)
// - Transfermarkt (market values)
// ============================================
import { footballApi } from '../api/footballApi';
import { fbrefApi } from '../api/fbrefApi';
import { transfermarktApi } from '../api/transfermarktApi';
import { cacheService } from './cacheService';
import {
  PlayerStats,
  YouthStats,
  YouthAggregation,
  StandingEntry,
  Match,
  Player,
} from '../types';

class DataAggregator {
  /** Hae sarjataulukko (API-Football + FBref fallback) */
  async getStandings(season: number): Promise<StandingEntry[]> {
    const cacheKey = `standings_${season}`;
    const result = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        // Try API-Football first
        const apiData = await footballApi.getStandingsTable(season);
        if (apiData && apiData.length > 0) {
          return apiData;
        }
        // Fallback to FBref
        const fbrefData = await fbrefApi.scrapeStandings(season);
        if (fbrefData) {
          return fbrefData.map((s) => ({
            position: s.position,
            teamId: s.team.toLowerCase().replace(/\s+/g, '_'),
            teamName: s.team,
            playedGames: s.mp,
            won: s.w,
            draw: s.d,
            lost: s.l,
            points: s.pts,
            goalsFor: s.gf,
            goalsAgainst: s.ga,
            goalDifference: s.gd,
            form: '',
          }));
        }
        return [];
      },
      'api-football',
      'standings'
    );
    return result.data;
  }

  /** Hae pelaajat tilastoineen (API-Football + FBref xG) */
  async getPlayerStats(season: number, teamId?: string): Promise<PlayerStats[]> {
    const cacheKey = `player_stats_${season}_${teamId || 'all'}`;
    const result = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        // Get base stats from API-Football
        const apiStats = await footballApi.getPlayerStatsList(
          season,
          teamId ? parseInt(teamId) : undefined
        );

        // Enrich with xG from FBref
        try {
          const fbrefStats = await fbrefApi.scrapePlayerStats(season);
          const fbrefByName = new Map(
            fbrefStats.map((s) => [
              s.player.toLowerCase().trim(),
              s,
            ])
          );

          for (const stat of apiStats) {
            const fbrefMatch = fbrefByName.get(stat.playerName.toLowerCase().trim());
            if (fbrefMatch) {
              stat.xG = fbrefMatch.xg || stat.xG;
              stat.xA = fbrefMatch.xag || stat.xA;
              stat.npg = (fbrefMatch.gls - fbrefMatch.pk) || stat.npg;
              stat.npxG = fbrefMatch.npxg || stat.npxG;
            }
          }
        } catch (e) {
          console.log('FBref enrichment failed, using API-Football only');
        }

        return apiStats;
      },
      'api-football',
      'player_stats'
    );
    return result.data;
  }

  /** Hae joukkueiden nuorten pelaajien tilastot — tukee useaa sarjaa */
  async getYouthStats(season: number, league: number = 244): Promise<YouthStats[]> {
    // Cache-avain sisältää liigan, joten 3 sarjaa cachetetaan erikseen.
    // Avaimen muutos myös invalidoi vanhan tyhjän youth_stats_${season} -merkinnän.
    const cacheKey = `youth_stats_${league}_${season}`;
    const result = await cacheService.getOrFetch(
      cacheKey,
      () => footballApi.getYouthStats(season, league),
      'api-football',
      'youth_stats'
    );
    // Sanitoi: null jos järjenvastainen keski-ikä (esim. VPS 130.5 syntyi
    // pelaajan api.age=2025 arvosta). Käsittelee sekä vanhaa cachea että
    // toimii defense-in-depth-tasolla footballApi.ts:n sanitoinnin kanssa.
    return result.data.map((team) => ({
      ...team,
      averageAge:
        team.averageAge != null && team.averageAge > 15 && team.averageAge < 50
          ? team.averageAge
          : null,
    }));
  }

  /** Hae nuorten pelaajien aggregaatio koko liigalle */
  async getYouthAggregation(season: number): Promise<YouthAggregation> {
    const cacheKey = `youth_agg_${season}`;
    const cached = await cacheService.get<YouthAggregation>(cacheKey);
    if (cached) return { ...cached, cached: true } as unknown as YouthAggregation;

    const [youthStats, playerStats, standings] = await Promise.all([
      this.getYouthStats(season),
      this.getPlayerStats(season),
      this.getStandings(season),
    ]);

    // Calculate league-wide aggregates
    const totalPlayersAnalyzed = playerStats.length;
    const totalMinutes = youthStats.reduce((sum, t) => sum + t.totalMinutes, 0);
    const youthMinutesU21 = youthStats.reduce((sum, t) => sum + t.youthMinutesU21, 0);
    const youthMinutesU23 = youthStats.reduce((sum, t) => sum + t.youthMinutesU23, 0);

    // Get top youth players (under 21 with most minutes)
    const playersWithAge = await footballApi.getPlayers(season);
    const youthPlayerStats: PlayerStats[] = [];

    for (const ps of playerStats) {
      const apiPlayer = playersWithAge.find(
        (ap) => ap.player.name === ps.playerName
      );
      if (apiPlayer) {
        const birthYear = apiPlayer.player.birth.date
          ? parseInt(apiPlayer.player.birth.date.split('-')[0])
          : 0;
        const age = birthYear ? season - birthYear : apiPlayer.player.age || 99;

        if (age <= 23) {
          youthPlayerStats.push({ ...ps, age });
        }
      }
    }

    // Sort by minutes and get top 20
    const topYouthPlayers = youthPlayerStats
      .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
      .slice(0, 20);

    const aggregation: YouthAggregation = {
      season,
      league: 'Veikkausliiga',
      totalPlayersAnalyzed,
      youthPlayersU21: youthStats.reduce((s, t) => s + t.youthPlayersU21, 0),
      youthPlayersU23: youthStats.reduce((s, t) => s + t.youthPlayersU23, 0),
      totalMinutesPlayed: totalMinutes,
      youthMinutesU21,
      youthMinutesU23,
      youthPercentageU21: totalMinutes > 0 ? Math.round((youthMinutesU21 / totalMinutes) * 1000) / 10 : 0,
      youthPercentageU23: totalMinutes > 0 ? Math.round((youthMinutesU23 / totalMinutes) * 1000) / 10 : 0,
      teamBreakdown: youthStats,
      topYouthPlayers,
      updatedAt: new Date().toISOString(),
    };

    await cacheService.set(cacheKey, aggregation, 'aggregator', 'youth_stats');
    return aggregation;
  }

  /** Hae ottelut */
  async getMatches(season: number, status?: string): Promise<Match[]> {
    const cacheKey = `matches_${season}_${status || 'all'}`;
    const result = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        let fixtures;
        if (status === 'upcoming') {
          fixtures = await footballApi.getUpcomingFixtures(season);
        } else if (status === 'recent') {
          fixtures = await footballApi.getRecentFixtures(season, 20);
        } else {
          fixtures = await footballApi.getFixtures(season);
        }
        return footballApi.transformMatches(fixtures);
      },
      'api-football',
      'matches'
    );
    return result.data;
  }

  /** Hae joukkueen pelaajat */
  async getTeamPlayers(season: number, teamId: string): Promise<Player[]> {
    const cacheKey = `team_players_${season}_${teamId}`;
    const result = await cacheService.getOrFetch(
      cacheKey,
      () => footballApi.getPlayersList(season, parseInt(teamId)),
      'api-football',
      'players'
    );
    return result.data;
  }

  /** Hae pelaajat markkina-arvoineen */
  async getPlayersWithMarketValues(season: number): Promise<
    Array<Player & { marketValue?: number }>
  > {
    const [players, tmPlayers] = await Promise.all([
      footballApi.getPlayers(season),
      transfermarktApi.getAllVeikkausliigaPlayers().catch(() => []),
    ]);

    const tmByName = new Map(tmPlayers.map((p) => [p.name.toLowerCase().trim(), p.marketValue]));

    return players.map((p) => {
      const marketValue = tmByName.get(p.player.name.toLowerCase().trim());
      return {
        id: String(p.player.id),
        name: p.player.name,
        firstName: p.player.firstname,
        lastName: p.player.lastname,
        dateOfBirth: p.player.birth.date,
        nationality: p.player.nationality,
        position: this.mapPosition(p.statistics[0]?.games?.position || ''),
        shirtNumber: p.statistics[0]?.games?.number || undefined,
        currentTeam: p.statistics[0]?.team?.name || '',
        currentTeamId: String(p.statistics[0]?.team?.id || ''),
        photoUrl: p.player.photo,
        marketValue,
      };
    });
  }

  /** Hae markkina-arvot joukkueittain */
  async getTeamMarketValues(): Promise<
    Array<{ team: string; totalValue: number; playerCount: number; averageValue: number }>
  > {
    const cacheKey = 'team_market_values';
    const result = await cacheService.getOrFetch(
      cacheKey,
      () => transfermarktApi.getTeamMarketValues(),
      'transfermarkt',
      'transfermarkt_values'
    );
    return result.data;
  }

  private mapPosition(pos: string) {
    const p = pos.toLowerCase();
    if (p.includes('goalkeeper') || p === 'g') return 'Goalkeeper';
    if (p.includes('defender') || p === 'd') return 'Defender';
    if (p.includes('midfielder') || p === 'm') return 'Midfielder';
    return 'Attacker';
  }

  /** Force refresh all data for a season */
  async refreshSeason(season: number): Promise<{
    standings: boolean;
    players: boolean;
    matches: boolean;
    youthStats: boolean;
  }> {
    // Clear caches
    await Promise.all([
      cacheService.clearType('standings'),
      cacheService.clearType('player_stats'),
      cacheService.clearType('matches'),
      cacheService.clearType('youth_stats'),
    ]);

    // Re-fetch
    const results = await Promise.allSettled([
      this.getStandings(season),
      this.getPlayerStats(season),
      this.getMatches(season),
      this.getYouthStats(season),
    ]);

    return {
      standings: results[0].status === 'fulfilled',
      players: results[1].status === 'fulfilled',
      matches: results[2].status === 'fulfilled',
      youthStats: results[3].status === 'fulfilled',
    };
  }
}

export const dataAggregator = new DataAggregator();
