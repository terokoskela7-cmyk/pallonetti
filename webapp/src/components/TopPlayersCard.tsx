interface TopPlayer {
  name: string;
  team: string;
  minutes: number;
  age?: number;
}

interface TopPlayersCardProps {
  players: TopPlayer[];
}

export function TopPlayersCard({ players }: TopPlayersCardProps) {
  return (
    <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-white/50 font-medium">
          Eniten pelanneet U23
        </h3>
        <span className="text-xs text-white/30">Viikon top 5</span>
      </div>

      {players.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-white/50 text-sm mb-1">
            Pelaajatason viikkodata tulossa
          </div>
          <div className="text-white/30 text-xs">
            Vaihe 2 — ottelukohtaiset peliminuutit
          </div>
        </div>
      ) : (
        <ol className="space-y-3">
          {players.map((player, i) => (
            <li key={`${player.name}-${i}`} className="flex items-baseline gap-3">
              <span className="text-ice tabular text-sm w-6">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{player.name}</div>
                <div className="text-xs text-white/50 truncate">
                  {player.team}
                  {player.age !== undefined && ` · ${player.age} v`}
                </div>
              </div>
              <span className="tabular text-sm text-white/80 shrink-0">
                {player.minutes} min
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
