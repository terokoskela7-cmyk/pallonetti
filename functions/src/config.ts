// ============================================
// CONFIGURATION
// Environment variables and constants
// ============================================

export const config = {
  // API Keys (set via Firebase Functions config)
  rapidApiKey: process.env.RAPIDAPI_KEY || '',
  
  // Firebase
  projectId: process.env.GCLOUD_PROJECT || '',
  
  // API-Football
  apiFootballBaseUrl: 'https://v3.football.api-sports.io',
  
  // Veikkausliiga IDs
  veikkausliigaId: 244,
  ykkosliigaId: 245,
  
  // Cache durations (hours)
  cacheDurations: {
    standings: 2,
    teams: 24,
    players: 6,
    playerStats: 6,
    matches: 1,
    lineups: 0.5,
    fbrefStats: 12,
    transfermarktValues: 24,
    youthStats: 6,
  },
  
  // Season config
  currentSeason: 2026,
  supportedSeasons: [2024, 2025, 2026],
  
  // Rate limiting
  requestsPerMinute: 30,
  
  // Data sources priority
  dataSources: {
    primary: 'api-football',
    xgSource: 'fbref',
    marketValueSource: 'transfermarkt',
  },
};

/** Validate that required env vars are set */
export function validateConfig(): string[] {
  const missing: string[] = [];
  if (!config.rapidApiKey) missing.push('RAPIDAPI_KEY');
  return missing;
}
