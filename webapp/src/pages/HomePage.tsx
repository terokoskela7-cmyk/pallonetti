import { useApi } from '@/hooks/useApi';
import { getYouthStatsAll } from '@/services/api';
import { WeeklyNarrative } from '@/components/WeeklyNarrative';
import { KPICard } from '@/components/KPICard';
import { TeamRankingBar } from '@/components/TeamRankingBar';
import { TopPlayersCard } from '@/components/TopPlayersCard';

const SEASON = 2026;

export default function HomePage() {
  const { data, loading, error } = useApi(() => getYouthStatsAll(SEASON), [SEASON]);

  if (loading) {
    return (
      <div className="px-6 py-20">
        <div className="text-white/40 text-sm">Ladataan kauden tilastoja…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-20">
        <div className="text-red-400/90 text-sm">
          Datan lataus epäonnistui{error ? `: ${error}` : ''}.
        </div>
      </div>
    );
  }

  const veikkausliiga = data.veikkausliiga;

  const totalMinutes = veikkausliiga.reduce((s, t) => s + t.totalMinutes, 0);
  const u23Minutes = veikkausliiga.reduce((s, t) => s + t.youthMinutesU23, 0);
  const u23Pct = totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;
  const u23Players = veikkausliiga.reduce((s, t) => s + t.youthPlayersU23, 0);
  const teamsOver25 = veikkausliiga.filter(
    (t) => t.youthPercentageU23 >= 25,
  ).length;

  return (
    <div className="px-6 py-10 md:py-16 space-y-12">
      {/* 1. Viikon narratiivi */}
      <section>
        <WeeklyNarrative teams={veikkausliiga} />
      </section>

      {/* 2. KPI-kortit */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Veikkausliiga U23"
          value={u23Pct.toFixed(1)}
          suffix="%"
          accent="aurora"
        />
        <KPICard label="U23-pelaajia" value={u23Players} accent="ice" />
        <KPICard
          label="Joukkueet ≥ 25 %"
          value={teamsOver25}
          suffix={`/ ${veikkausliiga.length}`}
          accent="ice"
        />
        <KPICard
          label="Sarjat seurannassa"
          value={3}
          accent="white"
        />
      </section>

      {/* 3. Joukkueet U23-osuuden mukaan */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-lg font-medium">Joukkueet — U23-osuus</h2>
          <span className="text-xs text-white/40">Veikkausliiga · kausi {SEASON}</span>
        </div>
        <TeamRankingBar teams={veikkausliiga} />
      </section>

      {/* 4. Viikon top 5 pelaajaa */}
      <section className="max-w-2xl">
        <TopPlayersCard players={[]} />
      </section>
    </div>
  );
}
