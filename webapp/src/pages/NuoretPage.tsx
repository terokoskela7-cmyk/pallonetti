import { useApi } from '@/hooks/useApi';
import { getOfficialStats, type OfficialPlayer } from '@/services/api';
import { Hero } from '@/components/Hero';
import { Info } from 'lucide-react';

const SEASON = 2026;

// Sama värisykli kuin JoukkueetPage/TopPlayersCard:issa
const AVATAR_COLORS = ['#00D4FF', '#00FF88', '#6366f1', '#f59e0b', '#ef4444'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PlayerCardProps {
  player: OfficialPlayer;
  index: number;
  maxMinutes: number;
}

function PlayerCard({ player, index, maxMinutes }: PlayerCardProps) {
  const initials = getInitials(player.name);
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const tp = player.goals + player.assists;
  const minPct = maxMinutes > 0 ? (player.minutes / maxMinutes) * 100 : 0;

  return (
    <article className="bg-navy-700 border border-navy-600 rounded-lg p-4 flex flex-col gap-3 hover:border-navy-500 transition-colors relative">
      {/* Yläosa: avatar + nimi + ikäbadge */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-full bg-ice/10 flex items-center justify-center font-semibold text-sm shrink-0"
          style={{ color: avatarColor }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white/95 truncate leading-tight">
            {player.name}
          </div>
          <div className="text-xs text-white/50 truncate mt-0.5">
            {player.team}
          </div>
        </div>
        {player.age !== undefined && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-aurora/15 text-aurora shrink-0">
            {player.age} v
          </span>
        )}
      </div>

      {/* Kolme tilastoa */}
      <div className="grid grid-cols-3 gap-2 text-center border-t border-navy-600 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Min
          </div>
          <div className="text-lg font-bold text-ice font-mono tracking-tight">
            {player.minutes}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            M
          </div>
          <div className="text-lg font-bold text-white/90 font-mono tracking-tight">
            {player.goals}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            TP
          </div>
          <div className="text-lg font-bold text-white/90 font-mono tracking-tight">
            {tp}
          </div>
        </div>
      </div>

      {/* Progress bar: minuutit suhteessa listan #1 -arvoon */}
      <div className="h-1 bg-navy-600/70 rounded-full overflow-hidden">
        <div
          className="h-full bg-ice rounded-full transition-all duration-500"
          style={{ width: `${minPct}%` }}
        />
      </div>
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-32 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-44 bg-navy-700/30 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function NuoretPage() {
  const { data, loading, error } = useApi(
    () => getOfficialStats(SEASON),
    [SEASON],
  );

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="px-6 py-20 max-w-md mx-auto text-center">
        <Info className="w-10 h-10 text-red-400/80 mx-auto mb-4" />
        <div className="text-white/90 font-medium mb-2">
          Datan lataus epäonnistui
        </div>
        <div className="text-sm text-white/60">{error ?? 'Tuntematon virhe'}</div>
      </div>
    );
  }

  // Suodata U23 jos ikä on saatavilla; muuten näytä kaikki (toistaiseksi).
  const players = data.data.filter((p) => p.age === undefined || p.age <= 23);
  // Lajittele minuuttien mukaan, eniten ensin
  const sorted = [...players].sort((a, b) => b.minutes - a.minutes);
  const maxMinutes = sorted[0]?.minutes ?? 1;

  return (
    <div className="px-6 py-10 md:py-16 space-y-8">
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
        title={
          <>
            Nuoret pelaajat —{' '}
            <span className="text-aurora font-medium">U23</span>
          </>
        }
        subtitle={`U23 · ${sorted.length} pelaajaa · viralliset minuutit Veikkausliiga.com:sta`}
        height="sm"
      />

      {sorted.length === 0 ? (
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Ei pelaajadataa tälle kaudelle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {sorted.map((player, i) => (
            <PlayerCard
              key={`${player.name}-${player.team}-${i}`}
              player={player}
              index={i}
              maxMinutes={maxMinutes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
