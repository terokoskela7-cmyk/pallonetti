import { useState } from 'react';
import type { OfficialPlayer } from '@/services/api';

interface TopPlayersCardProps {
  players: OfficialPlayer[];
}

type Metric = 'minutes' | 'goals' | 'assists';

const TABS: Array<{ id: Metric; label: string; unit: string }> = [
  { id: 'minutes', label: 'Minuutit', unit: 'min' },
  { id: 'goals', label: 'Maalit', unit: 'M' },
  { id: 'assists', label: 'Syötöt', unit: 'S' },
];

export function TopPlayersCard({ players }: TopPlayersCardProps) {
  const [metric, setMetric] = useState<Metric>('minutes');

  // Top 5 valitun metriikan mukaan, suurin ensin
  const top5 = [...players]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 5);

  const maxValue = top5[0]?.[metric] ?? 1;
  const unitLabel = TABS.find((t) => t.id === metric)?.unit ?? '';

  return (
    <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-white/50 font-medium">
          Veikkausliiga — Top 5
        </h3>
        <span className="text-xs text-white/30">
          {top5.length > 0 ? `${players.length} pelaajaa` : ''}
        </span>
      </div>

      {/* Välilehdet */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => {
          const active = metric === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMetric(tab.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                active
                  ? 'bg-ice/15 text-ice font-medium'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {top5.length === 0 ? (
        <div className="py-8 text-center text-white/50 text-sm">
          Pelaajatason data tulossa — kierros 8+
        </div>
      ) : (
        <ol className="space-y-2">
          {top5.map((player, i) => {
            const value = player[metric];
            const widthPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return (
              <li
                key={`${player.name}-${player.team}-${i}`}
                className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-ice font-mono tracking-tight w-7 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white/95 truncate">
                      {player.name}
                    </div>
                    <div className="text-xs text-white/50 truncate">
                      {player.team}
                    </div>
                  </div>
                  <div className="text-right shrink-0 leading-none">
                    <div className="text-xl font-bold text-ice font-mono tracking-tight">
                      {value}
                    </div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">
                      {unitLabel}
                    </div>
                  </div>
                </div>
                {/* Progress bar: skaalautuu listan #1 -arvoon (100 %) */}
                <div className="mt-2 h-1 bg-navy-600/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ice rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
