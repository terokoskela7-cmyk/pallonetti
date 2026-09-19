// Debug script: selvitä miksi U21-trendissä on vain 7 kierrosta
import { footballApi } from './src/api/footballApi';

const SEASON = 2026;

async function debug() {
  console.log('=== Haetaan kaikki ottelut kaudelta', SEASON, '===');
  const fixtures = await footballApi.getFixtures(SEASON);
  console.log(`Yhteensä ${fixtures.length} ottelua`);

  const finished = fixtures.filter((f) => f.fixture.status.short === 'FT');
  console.log(`Päättyneitä (FT): ${finished.length}`);

  // Ryhmittele kierroksittain
  const byRound = new Map<number, number>();
  for (const f of finished) {
    const round = f.league.round;
    const m = round.match(/Regular Season\s+-\s+(\d+)/);
    const roundNum = m ? parseInt(m[1], 10) : 0;
    if (roundNum > 0) {
      byRound.set(roundNum, (byRound.get(roundNum) || 0) + 1);
    }
  }

  console.log('\nPäättyneet ottelut kierroksittain:');
  for (const [round, count] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Kierros ${round}: ${count} ottelua`);
  }

  // Testaa muutama ottelu kierroksilta 8 ja 9
  const testFixtures = finished
    .filter((f) => {
      const round = f.league.round;
      const m = round.match(/Regular Season\s+-\s+(\d+)/);
      const roundNum = m ? parseInt(m[1], 10) : 0;
      return roundNum === 8 || roundNum === 9;
    })
    .slice(0, 4);

  console.log(`\n=== Testataan ${testFixtures.length} ottelua kierroksilta 8/9 ===`);
  for (const f of testFixtures) {
    try {
      const stats = await footballApi.getFixturePlayerStats(f.fixture.id);
      let totalMins = 0;
      let playerCount = 0;
      for (const teamGroup of stats) {
        for (const pl of teamGroup.players) {
          const mins = pl.statistics?.[0]?.games?.minutes ?? 0;
          if (mins > 0) {
            totalMins += mins;
            playerCount++;
          }
        }
      }
      console.log(
        `Fixture ${f.fixture.id} (${f.league.round}): ${stats.length} joukkuetta, ${playerCount} pelaajaa, ${totalMins} min`
      );
    } catch (err) {
      console.log(`Fixture ${f.fixture.id} (${f.league.round}): VIRHE -`, err instanceof Error ? err.message : err);
    }
  }
}

debug().catch(console.error);
