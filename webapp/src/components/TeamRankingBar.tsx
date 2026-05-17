import type { YouthStats } from '@/services/api';

interface TeamRankingBarProps {
  teams: YouthStats[];
}

function getBarColor(pct: number): string {
  if (pct >= 25) return 'bg-[#00FF88]';
  if (pct >= 15) return 'bg-[#F59E0B]';
  return 'bg-[#EF4444]';
}

function getBorderColor(pct: number): string {
  if (pct >= 25) return 'border-l-[#00FF88]';
  if (pct >= 15) return 'border-l-[#F59E0B]';
  return 'border-l-[#EF4444]';
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
    <div className="space-y-3">
      {sorted.map((team) => {
        const pct = team.youthPercentageU23;
        const widthPct = (pct / scaleMax) * 100;
        const barColor = getBarColor(pct);
        const borderColor = getBorderColor(pct);
        return (
          <div key={team.teamId} className="space-y-1.5">
            {/* Otsikkorivi: nimi + % border-l-väri-indikaattorilla */}
            <div
              className={`pl-3 border-l-2 ${borderColor} flex items-baseline justify-between gap-2`}
            >
              <span className="text-sm text-white/90 truncate">
                {team.teamName}
              </span>
              <span className="text-sm tabular font-medium text-white/90 shrink-0">
                {pct.toFixed(1)} %
              </span>
            </div>
            {/* Progress-baari: tausta white/10, etupalkki värikoodattu */}
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${Math.max(widthPct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
      {/* Värilegenda */}
      <div className="flex items-center gap-4 pt-3 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-[#00FF88]" /> ≥ 25 %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-[#F59E0B]" /> 15–25 %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-[#EF4444]" /> &lt; 15 %
        </span>
      </div>
    </div>
  );
}
