import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getSeasonPlayers, type SeasonPlayer } from '@/services/api';
import { useValittuKausi } from '@/hooks/useKausi';
import { IKAKAISTAT, kaistalla } from '@/constants/ika';
import { Hero } from '@/components/Hero';

const AVATAR_COLORS = ['#00D4FF', '#00FF88', '#6366f1', '#f59e0b', '#ef4444'];

// Suodattimet näyttävät ikävuosia, eivät koodeja. Kaistat yhdestä vakiosta.
type AgeFilter = string;

const FILTERS: Array<{ id: AgeFilter; label: string }> = [
  { id: 'all', label: 'Kaikki' },
  ...IKAKAISTAT.map((k) => ({ id: k.id, label: k.label })),
];

function fullName(p: SeasonPlayer): string {
  return `${p.etunimi} ${p.sukunimi}`.trim();
}

function getInitials(p: SeasonPlayer): string {
  const a = p.etunimi.trim()[0] ?? '';
  const b = p.sukunimi.trim()[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

interface PlayerCardProps {
  player: SeasonPlayer;
  index: number;
}

function PlayerCard({ player, index }: PlayerCardProps) {
  const initials = getInitials(player);
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <Link
      to={`/pelaaja/${player.slug}`}
      className="bg-navy-700 border border-navy-600 rounded-lg p-4 flex flex-col gap-3 hover:border-navy-500 transition-colors relative"
    >
      <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-ice/15 text-ice">
        {player.ika} v
      </span>

      <div className="flex items-start gap-3 pr-12">
        <div
          className="w-12 h-12 rounded-full bg-ice/10 flex items-center justify-center font-semibold text-sm shrink-0"
          style={{ color: avatarColor }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white/95 truncate leading-tight">
            {fullName(player)}
          </div>
          <div className="text-xs text-white/50 truncate mt-0.5">
            {player.joukkue}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center border-t border-navy-600 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Min
          </div>
          <div className="text-lg font-bold text-ice font-mono tracking-tight">
            {player.minTotal}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Maalit
          </div>
          <div className="text-lg font-bold text-white/90 font-mono tracking-tight">
            {player.maaliTotal}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Ottelut
          </div>
          <div className="text-lg font-bold text-white/90 font-mono tracking-tight">
            {player.ottelutTotal}
          </div>
        </div>
      </div>

      {player.maaliTotal >= 3 && (
        <div className="text-[11px] font-medium text-aurora bg-aurora/10 border border-aurora/30 rounded-full px-2 py-0.5 self-start">
          🔥 {player.maaliTotal} maalia
        </div>
      )}
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-44 bg-navy-700/30 rounded-xl" />
      <div className="h-10 bg-navy-700/30 rounded-md w-72" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-52 bg-navy-700/30 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function NuoretPage() {
  const kausi = useValittuKausi();
  const [filter, setFilter] = useState<AgeFilter>('all');

  const { data, loading, error } = useApi(
    () => getSeasonPlayers(kausi),
    [kausi],
  );

  // Kaikki seurannassa olevat pelaajat = ne joilla on peliaikaa.
  const tracked = useMemo(
    () => (data ?? []).filter((p) => p.minTotal > 0),
    [data],
  );

  const players = useMemo(() => {
    const kaista = IKAKAISTAT.find((k) => k.id === filter);
    return tracked
      .filter((p) => (kaista ? kaistalla(p.ika, kaista) : true))
      .sort((a, b) => b.minTotal - a.minTotal);
  }, [tracked, filter]);

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

  return (
    <div className="px-6 py-10 md:py-16 space-y-8">
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${kausi}`}
        title={
          <>
            Nuoret pelaajat —{' '}
            <span className="text-aurora font-medium">Veikkausliiga {kausi}</span>
          </>
        }
        subtitle={`${tracked.length} pelaajaa seurannassa`}
        height="sm"
      />

      {/* Ikäsuodattimet */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                active
                  ? 'bg-ice/15 border-ice text-ice font-medium'
                  : 'bg-navy-700/50 border-navy-600 text-white/70 hover:text-white hover:border-navy-500'
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-white/40 self-center">
          {players.length} pelaajaa
        </span>
      </div>

      {players.length === 0 ? (
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Suodattimella ei löytynyt pelaajia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map((player, i) => (
            <PlayerCard
              key={player.slug}
              player={player}
              index={i}
            />
          ))}
        </div>
      )}

      <div className="text-xs text-white/40 text-center pt-2">
        Lähde: Veikkausliiga.com (viralliset tilastot)
      </div>
    </div>
  );
}
