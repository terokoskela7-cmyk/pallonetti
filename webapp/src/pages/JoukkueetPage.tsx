import { useState } from 'react';
import { Info, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import {
  getYouthStatsAll,
  filterReliableTeams,
  type YouthStats,
} from '@/services/api';
import { Hero } from '@/components/Hero';

const SEASON = 2026;

function getInitials(teamName: string): string {
  const words = teamName.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  if (
    words[0].length <= 4 &&
    words[0] === words[0].toUpperCase() &&
    /^[A-ZÅÄÖ]+$/.test(words[0])
  ) {
    return words[0];
  }
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Värisykli — joukkueet saavat värin järjestysindeksin mukaan
const TEAM_COLORS = ['#00D4FF', '#00FF88', '#6366f1', '#f59e0b', '#ef4444'];

function progressBarColor(pct: number): string {
  if (pct >= 25) return 'bg-[#00FF88]';
  if (pct >= 15) return 'bg-[#F59E0B]';
  return 'bg-[#EF4444]';
}

interface TeamCardProps {
  team: YouthStats;
  index: number;
}

function TeamCard({ team, index }: TeamCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = getInitials(team.teamName);
  const circleColor = TEAM_COLORS[index % TEAM_COLORS.length];
  const pct = team.youthPercentageU23;
  const barColor = progressBarColor(pct);
  // API-Football CDN: logo per teamId. Jos kuva ei löydy → fallback initiaaliympyrään.
  const logoUrl = `https://media.api-sports.io/football/teams/${team.teamId}.png`;

  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-5 flex flex-col gap-4 hover:border-navy-500 transition-colors">
      {/* Otsikko: logo TAI initialiympyrä + nimi + keski-ikä */}
      <div className="flex items-center gap-3">
        {!logoFailed ? (
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <img
              src={logoUrl}
              alt={`${team.teamName} logo`}
              className="w-10 h-10 object-contain"
              onError={() => setLogoFailed(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 text-navy-900"
            style={{ backgroundColor: circleColor }}
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-lg font-medium text-white/95 truncate leading-tight">
            {team.teamName}
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            Keski-ikä{' '}
            <span className="tabular text-white/60">
              {team.averageAge != null ? team.averageAge.toFixed(1) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Kolme tilastoa vierekkäin */}
      <div className="grid grid-cols-3 gap-2 text-center border-t border-navy-600 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            U23-pelaajia
          </div>
          <div className="tabular text-white/90 font-medium">
            {team.youthPlayersU23}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Minuutteja
          </div>
          <div className="tabular text-white/90 font-medium">
            {team.youthMinutesU23.toLocaleString('fi-FI')}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            U23-%
          </div>
          <div className="tabular text-aurora font-medium">
            {pct.toFixed(1)} %
          </div>
        </div>
      </div>

      {/* Progress-baari 0-100% skaalalla */}
      <div>
        <div className="h-1.5 bg-navy-600/70 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Linkki — placeholder, /joukkueet/:id ei vielä toteutettu */}
      <Link
        to={`/joukkueet/${team.teamId}`}
        className="inline-flex items-center gap-1 text-xs text-ice hover:text-white transition-colors mt-auto"
      >
        Näytä tilastot
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-32 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 bg-navy-700/30 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-6 py-20 max-w-md mx-auto text-center space-y-4">
      <Info className="w-10 h-10 text-red-400/80 mx-auto" />
      <div className="text-white/90 font-medium">Datan lataus epäonnistui</div>
      <div className="text-sm text-white/60">{message}</div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 border border-navy-500 rounded-md text-sm transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Yritä uudelleen
      </button>
    </div>
  );
}

export default function JoukkueetPage() {
  const { data, loading, error, refetch } = useApi(
    () => getYouthStatsAll(SEASON),
    [SEASON],
  );

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? 'Tuntematon virhe'} onRetry={refetch} />
    );
  }

  // Suodata pois joukkueet joilla totalMinutes < 1000 (datavaje).
  const teams = filterReliableTeams(data.veikkausliiga).sort(
    (a, b) => b.youthPercentageU23 - a.youthPercentageU23,
  );

  return (
    <div className="px-6 py-10 md:py-16 space-y-8">
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
        title={
          <>
            Joukkueet —{' '}
            <span className="text-aurora font-medium">nuorten käytön</span>{' '}
            mukaan
          </>
        }
        subtitle="Suomalaisen jalkapallon huipulla — kuinka eri seurat antavat peliaikaa alle 23-vuotiaille pelaajille."
        height="sm"
      />

      {teams.length === 0 ? (
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Joukkuedataa ei vielä saatavilla tälle kaudelle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team, i) => (
            <TeamCard key={team.teamId} team={team} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
