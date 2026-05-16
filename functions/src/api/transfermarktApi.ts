// ============================================
// TRANSFERMARKT API INTEGRATION
// Fetches market values, player profiles,
// contract info via Transfermarkt JSON API
// ============================================
import axios from 'axios';

const TM_BASE = 'https://transfermarkt.com';
const TM_API_BASE = 'https://transfermarkt-api.vercel.app';

// Veikkausliiga joukkueiden Transfermarkt-ID:t
const TEAM_IDS: Record<string, number> = {
  hjk:  3321,
  kups: 1208,
  ilves: 1302,
  'fc-inter': 1010,
  sjk: 1207,
  gnistan: 65487,
  vps: 1209,
  jaro: 1210,
  'ifk-mariehamn': 1211,
  'ac-oulu': 1212,
  haka: 1213,
  ktp: 1214,
  'fc-lahti': 1215,
  tps: 1216,
};

interface TmPlayer {
  id: number;
  name: string;
  position: string;
  dateOfBirth: string;
  age: number;
  nationality: string[];
  height: number;
  foot: string;
  joinedOn: string;
  joined: string;
  signedFrom: string;
  contract: string;
  marketValue: string;
  marketValueNumeric: number;
  shirtNumber: number;
}

interface TmTeamSquad {
  players: TmPlayer[];
  staff: Array<{
    name: string;
    position: string;
    dateOfBirth: string;
    age: number;
    nationality: string[];
  }>;
}

interface TmPlayerProfile {
  id: number;
  url: string;
  name: string;
  description: string;
  nameInHomeCountry: string;
  imageURL: string;
  dateOfBirth: string;
  age: number;
  height: number;
  foot: string;
  citizenship: string[];
  position: {
    main: string;
    other: string[];
  };
  club: {
    name: string;
    logo: string;
    joined: string;
    contractExpires: string;
  };
  marketValue: string;
  marketValueNumeric: number;
  marketValueHistory: Array<{
    date: string;
    value: number;
    club: string;
  }>;
}

class TransfermarktService {
  private client = axios.create({
    baseURL: TM_API_BASE,
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  /** Hae joukkueen kokoonpano */
  async getTeamSquad(teamId: number): Promise<TmTeamSquad | null> {
    try {
      const response = await this.client.get(`/clubs/${teamId}/players`);
      return response.data as TmTeamSquad;
    } catch (error) {
      console.error(`Transfermarkt squad error for team ${teamId}:`, error);
      return null;
    }
  }

  /** Hae pelaajan profiili */
  async getPlayerProfile(playerId: number): Promise<TmPlayerProfile | null> {
    try {
      const response = await this.client.get(`/players/${playerId}/profile`);
      return response.data as TmPlayerProfile;
    } catch (error) {
      console.error(`Transfermarkt profile error for player ${playerId}:`, error);
      return null;
    }
  }

  /** Hae pelaajan markkina-arvo */
  async getMarketValue(playerId: number): Promise<number | null> {
    try {
      const response = await this.client.get(`/players/${playerId}/market-value`);
      const data = response.data as { marketValue: string; marketValueNumeric: number };
      return data.marketValueNumeric || null;
    } catch (error) {
      console.error(`Transfermarkt market value error:`, error);
      return null;
    }
  }

  /** Hae kaikki Veikkausliigan pelaajat markkina-arvoineen */
  async getAllVeikkausliigaPlayers(): Promise<Array<{
    id: number;
    name: string;
    position: string;
    age: number;
    nationality: string[];
    team: string;
    marketValue: number;
    contractUntil: string;
  }>> {
    const allPlayers: Array<{
      id: number;
      name: string;
      position: string;
      age: number;
      nationality: string[];
      team: string;
      marketValue: number;
      contractUntil: string;
    }> = [];

    for (const [teamSlug, teamId] of Object.entries(TEAM_IDS)) {
      try {
        const squad = await this.getTeamSquad(teamId);
        if (!squad) continue;

        for (const player of squad.players) {
          allPlayers.push({
            id: player.id,
            name: player.name,
            position: player.position,
            age: player.age,
            nationality: player.nationality,
            team: teamSlug,
            marketValue: player.marketValueNumeric || 0,
            contractUntil: player.contract || '',
          });
        }

        // Rate limiting - odota 500ms joukkueiden välillä
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching squad for ${teamSlug}:`, error);
      }
    }

    return allPlayers;
  }

  /** Hae Veikkausliigan joukkueiden markkina-arvosummat */
  async getTeamMarketValues(): Promise<Array<{
    team: string;
    totalValue: number;
    playerCount: number;
    averageValue: number;
  }>> {
    const players = await this.getAllVeikkausliigaPlayers();
    const teamValues = new Map<string, { total: number; count: number }>();

    for (const p of players) {
      const current = teamValues.get(p.team) || { total: 0, count: 0 };
      current.total += p.marketValue;
      current.count++;
      teamValues.set(p.team, current);
    }

    return Array.from(teamValues.entries())
      .map(([team, { total, count }]) => ({
        team,
        totalValue: total,
        playerCount: count,
        averageValue: count > 0 ? Math.round(total / count) : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }
}

export const transfermarktApi = new TransfermarktService();
