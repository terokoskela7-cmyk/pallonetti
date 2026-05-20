import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { PlayerStats } from '@/services/api';

interface TopPlayersCardProps {
  players: PlayerStats[];
}

type Metric = 'minutesPlayed' | 'goals' | 'assists';

const TABS: Array<{ id: Metric; label: string; unit: string }> = [
  { id: 'minutesPlayed', label: 'Minuutit', unit: 'min' },
  { id: 'goals', label: 'Maalit', unit: 'M' },
  { id: 'assists', label: 'Syötöt', unit: 'S' },
];

export function TopPlayersCard({ players }: TopPlayersCardProps) {
  const [metric, setMetric] = useState<Metric>('minutesPlayed');

  const top5 = [...players]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 5);

  const maxValue = top5[0]?.[metric] ?? 1;
  const unitLabel = TABS.find((t) => t.id === metric)?.unit ?? '';

  return (
    <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-white/50 font-medium">
          Viikon U23-tähdet
        </h3>
        <span className="text-xs text-white/30">
          {players.length > 0 ? `${players.length} alle 23-vuotiasta` : ''}
        </span>
      </div>

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
                key={`${player.playerName}-${player.teamName}-${i}`}
                className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-ice font-mono tracking-tight w-7 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white/95 truncate">
                      {player.playerName}
                    </div>
                    <div className="text-xs text-white/50 truncate">
                      {player.teamName}
                      {player.age !== undefined && (
                        <span className="text-white/30"> · {player.age} v</span>
                      )}
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

      <div className="mt-4 pt-4 border-t border-navy-600">
        <Link
          to="/nuoret"
          className="inline-flex items-center gap-1.5 text-sm text-ice hover:text-white transition-colors font-medium group"
        >
          Katso kaikki nuoret
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
