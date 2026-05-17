import type { YouthStats } from '@/services/api';

interface TeamRankingBarProps {
  teams: YouthStats[];
}

function getColorClass(pct: number): string {
  if (pct >= 25) return 'bg-aurora';
  if (pct >= 15) return 'bg-ice';
  return 'bg-red-400/80';
}

export function TeamRankingBar({ teams }: TeamRankingBarProps) {
  if (teams.length === 0) {
    return (
      <div className="text-white/40 italic">Joukkuedata ei vielä saatavilla.</div>
    );
  }

  const sorted = [...teams].sort(
    (a, b) => b.youthPercentageU23 - a.youthPercentageU23,
  );
  // Käytä 40% maksimina jotta palkit ovat luettavia (harva joukkue ylittää)
  const scaleMax = Math.max(40, ...sorted.map((t) => t.youthPercentageU23));

  return (
    <div className="space-y-2">
      {sorted.map((team) => {
        const widthPct = (team.youthPercentageU23 / scaleMax) * 100;
        return (
          <div key={team.teamId} className="flex items-center gap-3">
            <div className="w-32 md:w-40 text-sm truncate text-white/80">
              {team.teamName}
            </div>
            <div className="flex-1 bg-navy-700/60 rounded h-7 relative overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${getColorClass(team.youthPercentageU23)} rounded transition-all duration-500`}
                style={{ width: `${Math.max(widthPct, 2)}%` }}
              />
              <div className="absolute inset-0 flex items-center px-3">
                <span className="text-sm tabular font-medium text-navy-900 mix-blend-screen">
                  {team.youthPercentageU23.toFixed(1)} %
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-3 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-aurora" /> ≥ 25 %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-ice" /> 15–25 %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-red-400/80" /> &lt; 15 %
        </span>
      </div>
    </div>
  );
}
