interface TopPlayer {
  name: string;
  team: string;
  minutes: number;
  age?: number;
}

interface TopPlayersCardProps {
  players: TopPlayer[];
}

// Sama värisykli kuin JoukkueetPage:ssa — pelaajat saavat värin sijoitusindeksin mukaan.
const AVATAR_COLORS = ['#00D4FF', '#00FF88', '#6366f1', '#f59e0b', '#ef4444'];

function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ageStyles(age?: number): { badge: string; border: string } {
  if (age === undefined) {
    return { badge: 'bg-white/10 text-white/60', border: 'border-l-white/40' };
  }
  if (age < 20) {
    return { badge: 'bg-aurora/15 text-aurora', border: 'border-l-aurora' };
  }
  if (age <= 21) {
    return { badge: 'bg-ice/15 text-ice', border: 'border-l-ice' };
  }
  return { badge: 'bg-white/10 text-white/60', border: 'border-l-white/40' };
}

export function TopPlayersCard({ players }: TopPlayersCardProps) {
  return (
    <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-white/50 font-medium">
          Eniten pelanneet U23
        </h3>
        <span className="text-xs text-white/30">Top 5</span>
      </div>

      {players.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-white/50 text-sm">
            Pelaajatason data tulossa — kierros 8+
          </div>
        </div>
      ) : (
        <ol className="space-y-1">
          {players.map((player, i) => {
            const initials = getPlayerInitials(player.name);
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const { badge, border } = ageStyles(player.age);
            return (
              <li
                key={`${player.name}-${i}`}
                className={`flex items-center gap-3 py-2.5 pl-3 pr-2 rounded border-l-2 ${border} hover:bg-white/5 transition-colors`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 text-navy-900"
                  style={{ backgroundColor: avatarColor }}
                  aria-hidden="true"
                >
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white/95 truncate">
                    {player.name}
                  </div>
                  <div className="text-xs text-white/60 truncate">
                    {player.team}
                  </div>
                </div>

                {player.age !== undefined && (
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}
                  >
                    {player.age} v
                  </span>
                )}

                <div className="text-right shrink-0 leading-none pl-1">
                  <span className="text-lg font-bold text-ice font-mono tracking-tight">
                    {player.minutes}
                  </span>
                  <span className="text-[10px] text-white/40 ml-1">min</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
