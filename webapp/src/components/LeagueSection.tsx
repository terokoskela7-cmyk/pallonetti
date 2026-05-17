import type { YouthStats } from '@/services/api';
import { TeamRankingBar } from './TeamRankingBar';

interface LeagueSectionProps {
  id: string;
  title: string;
  season: number;
  teams: YouthStats[];
}

export function LeagueSection({ id, title, season, teams }: LeagueSectionProps) {
  const totalMinutes = teams.reduce((sum, t) => sum + t.totalMinutes, 0);
  const u23Minutes = teams.reduce((sum, t) => sum + t.youthMinutesU23, 0);
  const u23Pct = totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;
  const teamsOver25 = teams.filter((t) => t.youthPercentageU23 >= 25).length;

  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
        <h2 className="text-xl md:text-2xl font-medium">
          {title} <span className="text-white/40 text-base">{season}</span>
        </h2>
        {teams.length > 0 && (
          <div className="text-xs text-white/40 tabular flex items-center gap-3">
            <span>
              <span className="text-white/70">{teams.length}</span> joukkuetta
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span>
              <span className="text-aurora">{u23Pct.toFixed(1)} %</span> U23
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span>
              <span className="text-ice">{teamsOver25}</span> ≥ 25 %
            </span>
          </div>
        )}
      </div>
      <TeamRankingBar teams={teams} />
    </section>
  );
}
