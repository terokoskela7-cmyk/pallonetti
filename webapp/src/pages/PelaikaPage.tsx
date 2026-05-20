import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, RefreshCw, TrendingUp, type LucideIcon } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import { useApi } from '@/hooks/useApi';
import {
  getYouthStatsAll,
  getYouthAggregation,
  filterReliableTeams,
  type YouthStats,
  type PlayerStats,
} from '@/services/api';
import { InsightBar } from '@/components/InsightBar';

const SEASON = 2026;

const AVATAR_COLORS = ['#00D4FF', '#00FF88', '#6366f1', '#f59e0b', '#ef4444'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortenTeamName(name: string): string {
  return name.replace(/\s*(Helsinki|Football Club)\s*/gi, '').trim();
}

function barColor(pct: number): string {
  if (pct >= 40) return '#22c55e';
  if (pct >= 25) return '#eab308';
  if (pct >= 15) return '#f97316';
  return '#ef4444';
}

function calcU23Pct(teams: YouthStats[]): number {
  const totalMinutes = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u23Minutes = teams.reduce((s, t) => s + t.youthMinutesU23, 0);
  return totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: 'aurora' | 'ice' | 'white';
}

function KpiCard({ label, value, hint, accent = 'white' }: KpiCardProps) {
  const color =
    accent === 'aurora'
      ? 'text-aurora'
      : accent === 'ice'
        ? 'text-ice'
        : 'text-white/90';
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono tabular leading-none ${color}`}>
        {value}
      </div>
      {hint && (
        <div className="text-xs text-white/50 mt-2 leading-tight truncate">{hint}</div>
      )}
    </div>
  );
}

function BarChartTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload as { fullName: string; pct: number };
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-sm">
      <div className="font-medium text-white">{entry.fullName}</div>
      <div className="text-ice tabular">{entry.pct.toFixed(1)} %</div>
    </div>
  );
}

interface TeamBarChartProps {
  teams: YouthStats[];
}

function TeamBarChart({ teams }: TeamBarChartProps) {
  const data = [...teams]
    .sort((a, b) => b.youthPercentageU23 - a.youthPercentageU23)
    .map((t) => ({
      team: shortenTeamName(t.teamName),
      fullName: t.teamName,
      pct: t.youthPercentageU23,
    }));

  return (
    <div style={{ width: '100%', height: Math.max(280, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="#1a2640" strokeDasharray="2 4" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={{ stroke: '#243350' }}
            unit=" %"
            domain={[0, Math.max(50, ...data.map((d) => d.pct))]}
          />
          <YAxis
            type="category"
            dataKey="team"
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={false}
            width={92}
          />
          <Tooltip
            content={<BarChartTooltip />}
            cursor={{ fill: 'rgba(0, 212, 255, 0.05)' }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.team} fill={barColor(entry.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Top5ListProps {
  players: PlayerStats[];
}

function Top5List({ players }: Top5ListProps) {
  const top = players.slice(0, 5);
  if (top.length === 0) {
    return (
      <div className="text-sm text-white/40 italic py-6 text-center">
        Pelaajadataa ei vielä saatavilla.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {top.map((p, i) => {
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
        return (
          <li
            key={`${p.playerName}-${p.teamName}-${i}`}
            className="flex items-center gap-3 bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-3"
          >
            <span className="text-lg font-bold text-ice font-mono w-5 text-center shrink-0">
              {i + 1}
            </span>
            <div
              className="w-9 h-9 rounded-full bg-ice/10 flex items-center justify-center font-semibold text-xs shrink-0"
              style={{ color }}
              aria-hidden="true"
            >
              {getInitials(p.playerName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white/95 truncate text-sm">
                {p.playerName}
                {p.age !== undefined && (
                  <span className="text-white/40 font-normal">
                    {' '}
                    · {p.age} v
                  </span>
                )}
              </div>
              <div className="text-xs text-white/50 truncate">{p.teamName}</div>
            </div>
            <div className="text-right shrink-0 leading-tight">
              <div className="text-sm font-bold text-ice font-mono tabular">
                {p.minutesPlayed}
              </div>
              <div className="text-[10px] text-white/40">
                min · {p.goals} M
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-32 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-navy-700/30 rounded-lg" />
        ))}
      </div>
      <div className="h-80 bg-navy-700/30 rounded-xl" />
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

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  hint?: string;
}

function SectionHeader({ title, icon: Icon, hint }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <h2 className="text-base font-medium flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-ice" />}
        {title}
      </h2>
      {hint && <span className="text-xs text-white/40">{hint}</span>}
    </div>
  );
}

export default function PelaikaPage() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  const {
    data: statsData,
    loading: statsLoading,
    error: statsError,
    refetch,
  } = useApi(() => getYouthStatsAll(SEASON), [SEASON]);

  const { data: aggData, loading: aggLoading } = useApi(
    () => getYouthAggregation(SEASON),
    [SEASON],
  );

  const veikkausliiga = useMemo(
    () => (statsData ? filterReliableTeams(statsData.veikkausliiga) : []),
    [statsData],
  );

  const topYouthPlayers = useMemo(
    () => aggData?.topYouthPlayers ?? [],
    [aggData],
  );

  if (statsLoading || aggLoading) return <LoadingSkeleton />;
  if (statsError || !statsData) {
    return (
      <ErrorState
        message={statsError ?? 'Tuntematon virhe'}
        onRetry={refetch}
      />
    );
  }

  const vPct = calcU23Pct(veikkausliiga);
  const topPlayer = topYouthPlayers[0];
  const teamsOver25 = veikkausliiga.filter(
    (t) => t.youthPercentageU23 >= 25,
  ).length;

  const handleRowClick = (player: PlayerStats) => {
    setSelectedPlayer(player);
  };

  const handleRowDblClick = (player: PlayerStats) => {
    navigate(`/pelaaja/${slugify(player.playerName)}`);
  };

  return (
    <div className="px-6 py-10 md:py-14 space-y-8">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-600 via-navy-700 to-navy-800 border border-navy-600 px-6 md:px-10 py-8 md:py-12">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-aurora/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-ice/10 blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-3 font-medium">
            Veikkausliiga · Kausi {SEASON}
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight leading-tight">
            Peliaika —{' '}
            <span className="text-aurora font-medium">U23-analyysi</span>
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/60 max-w-2xl">
            Miten paljon nuoret pelaavat ja missä joukkueissa?
          </p>
        </div>
      </header>

      {/* 1. KPI-kortit */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="U23 peliaika-%"
          value={`${vPct.toFixed(1)} %`}
          accent="aurora"
        />
        <KpiCard
          label="U23 pelaajia"
          value={String(topYouthPlayers.length)}
          accent="ice"
        />
        <KpiCard
          label="Eniten minuutteja"
          value={topPlayer ? String(topPlayer.minutesPlayed) : '—'}
          hint={
            topPlayer
              ? `${topPlayer.playerName}${
                  topPlayer.age !== undefined ? ` · ${topPlayer.age} v` : ''
                }`
              : undefined
          }
          accent="ice"
        />
        <KpiCard
          label="Joukkueet ≥ 25 %"
          value={`${teamsOver25} / ${veikkausliiga.length}`}
        />
      </section>

      {/* 2. Vasen 60% pylväskaavio + Oikea 40% Top 5 */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <SectionHeader
            title="U23 peliaika joukkueittain"
            hint="% kaikista peliminuuteista"
          />
          <TeamBarChart teams={veikkausliiga} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#22c55e]" /> ≥ 40 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#eab308]" /> 25–40 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#f97316]" /> 15–25 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#ef4444]" /> &lt; 15 %
            </span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <SectionHeader
            title="Top 5 — minuutit"
            hint={`${topYouthPlayers.length} U23`}
          />
          <Top5List players={topYouthPlayers} />
        </div>
      </section>

      {/* 3 + 4. Taulukko vasemmalla, kehityskäyrä-placeholder oikealla */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <SectionHeader
            title="Eniten peliaikaa — U23"
            hint="klikkaa pelaajaa"
          />
          {topYouthPlayers.length === 0 ? (
            <div className="text-sm text-white/40 italic py-6 text-center">
              Pelaajadataa ei vielä saatavilla.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-navy-600">
                    <th className="py-2 pr-3 w-8 text-right">#</th>
                    <th className="py-2 pr-3">Pelaaja</th>
                    <th className="py-2 pr-3">Joukkue</th>
                    <th className="py-2 pr-3 text-right">Min</th>
                    <th className="py-2 pr-3 text-right">M</th>
                    <th className="py-2 pl-3 text-right">S</th>
                  </tr>
                </thead>
                <tbody>
                  {topYouthPlayers.map((p, i) => {
                    const isSelected =
                      selectedPlayer?.playerName === p.playerName &&
                      selectedPlayer?.teamName === p.teamName;
                    return (
                      <tr
                        key={`${p.playerName}-${p.teamName}-${i}`}
                        onClick={() => handleRowClick(p)}
                        onDoubleClick={() => handleRowDblClick(p)}
                        className={`border-b border-navy-700 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-ice/10'
                            : 'hover:bg-navy-700/60'
                        }`}
                      >
                        <td className="py-2 pr-3 text-right text-white/40 font-mono tabular">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-3 font-medium text-white/95">
                          <span>{p.playerName}</span>
                          {p.age !== undefined && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice/15 text-ice font-medium">
                              {p.age} v
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-white/60">{p.teamName}</td>
                        <td className="py-2 pr-3 text-right text-ice font-mono tabular">
                          {p.minutesPlayed}
                        </td>
                        <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                          {p.goals}
                        </td>
                        <td className="py-2 pl-3 text-right text-white/90 font-mono tabular">
                          {p.assists}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-white/40 mt-3">
                Klikkaa riviä → kehityskäyrä päivittyy. Tuplaklikkaus →
                pelaajan oma sivu.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-dashed border-navy-600 bg-navy-700/30 p-6 flex flex-col">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
            Kehityskäyrä
          </div>
          <div className="text-base font-medium text-white/90 mb-4">
            {selectedPlayer ? selectedPlayer.playerName : 'Valitse pelaaja taulukosta'}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-10">
            <TrendingUp className="w-7 h-7 text-white/30" />
            <div className="text-sm font-medium text-white/70">
              Kierroskohtainen data tulossa
            </div>
            <div className="text-xs text-white/40 max-w-xs leading-relaxed">
              Pelaajan minuutit ja tehopisteet kierros kierrokselta — vaatii
              ottelukohtaisen aggregoinnin (seuraava sprintti).
            </div>
          </div>
        </div>
      </section>

      {/* 5. InsightBar lopussa */}
      <section>
        <InsightBar teams={veikkausliiga} />
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Veikkausliiga {SEASON}</span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          <span className="text-white/70 tabular">{veikkausliiga.length}</span>{' '}
          joukkuetta
        </span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          <span className="text-white/70 tabular">{topYouthPlayers.length}</span>{' '}
          U23-pelaajaa
        </span>
      </footer>
    </div>
  );
}
