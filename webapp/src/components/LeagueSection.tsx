import { Info } from 'lucide-react';
import type { YouthStats } from '@/services/api';
import { TeamRankingBar } from './TeamRankingBar';

interface LeagueSectionProps {
  id: string;
  title: string;
  season: number;
  teams: YouthStats[];
}

export function LeagueSection({ id, title, season, teams }: LeagueSectionProps) {
  // Tyhjä lista = API-Football ei tarjoa pelaajadataa tälle sarjalle.
  // Sarjataulukko + ottelut olisivat saatavilla, mutta U23-mittari ei.
  if (teams.length === 0) {
    return (
      <section id={id} className="scroll-mt-24">
        <div className="mb-5">
          <h2 className="text-xl md:text-2xl font-medium">
            {title}{' '}
            <span className="text-white/40 text-base">{season}</span>
          </h2>
        </div>
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60 leading-relaxed">
            Pelaajatilastot tulossa — laajennamme kattavuutta Ykkösliigaan ja
            Ykköseen yhteistyössä Palloliiton kanssa.
          </p>
        </div>
      </section>
    );
  }

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
      </div>
      <TeamRankingBar teams={teams} />
    </section>
  );
}
