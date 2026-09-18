import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Info,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import { useApi } from '@/hooks/useApi';
import {
  getYouthStatsAll,
  getSeasonPlayers,
  getPlayerRounds,
  filterReliableTeams,
  type YouthStats,
  type SeasonPlayer,
  type PlayerRound,
} from '@/services/api';
import { InsightBar } from '@/components/InsightBar';
import { InfoTooltip } from '@/components/InfoTooltip';

const SEASON = 2026;

type FilterId = 'minutes' | 'goals' | 'youngest' | 'u21' | 'u19' | 'u18';

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'minutes', label: 'Eniten minuutteja' },
  { id: 'goals', label: 'Eniten maaleja' },
  { id: 'youngest', label: 'Nuorin' },
  { id: 'u21', label: 'U21' },
  { id: 'u19', label: 'U19' },
  { id: 'u18', label: 'U18' },
];

function fullName(p: SeasonPlayer): string {
  return `${p.etunimi} ${p.sukunimi}`.trim();
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

function filterAndSort(players: SeasonPlayer[], filter: FilterId): SeasonPlayer[] {
  let result = players.filter((p) => p.minTotal > 0);

  if (filter === 'u21') result = result.filter((p) => p.ika <= 21);
  else if (filter === 'u19') result = result.filter((p) => p.ika <= 19);
  else if (filter === 'u18') result = result.filter((p) => p.ika <= 18);

  const sorted = [...result];
  if (filter === 'goals') {
    sorted.sort((a, b) => b.maaliTotal - a.maaliTotal);
  } else if (filter === 'youngest') {
    sorted.sort((a, b) => a.ika - b.ika);
  } else {
    // 'minutes' (default) + U-suodattimet
    sorted.sort((a, b) => b.minTotal - a.minTotal);
  }
  return sorted;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  accent?: 'aurora' | 'ice' | 'white';
}

function KpiCard({ label, value, hint, info, accent = 'white' }: KpiCardProps) {
  const color =
    accent === 'aurora'
      ? 'text-aurora'
      : accent === 'ice'
        ? 'text-ice'
        : 'text-white/90';
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
        <span>{label}</span>
        {info && <InfoTooltip content={info} label={`Lisätietoja: ${label}`} />}
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

function TeamBarChart({ teams }: { teams: YouthStats[] }) {
  const data = [...teams]
    .sort((a, b) => b.youthPercentageU23 - a.youthPercentageU23)
    .map((t) => ({
      team: shortenTeamName(t.teamName),
      fullName: t.teamName,
      pct: t.youthPercentageU23,
    }));

  return (
    <div style={{ width: '100%', height: Math.max(280, data.length * 34) }}>
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
            domain={[0, Math.max(60, ...data.map((d) => d.pct))]}
          />
          <YAxis
            type="category"
            dataKey="team"
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={false}
            width={96}
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

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-28 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
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

interface RoundPoint {
  round: string;
  cumMin: number;
}

function RoundTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as RoundPoint;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-sm">
      <div className="text-white/90 font-medium">{d.round}</div>
      <div className="text-ice tabular">{d.cumMin} min (kum.)</div>
    </div>
  );
}

/** Kehityskäyrä valitulle pelaajalle — kumulatiiviset minuutit per kierros. */
function PlayerProgressionPanel({
  player,
  loading,
  rounds,
}: {
  player: SeasonPlayer | null;
  loading: boolean;
  rounds: PlayerRound[] | null;
}) {
  const chartData: RoundPoint[] = useMemo(
    () =>
      (rounds ?? []).map((r) => ({ round: `K${r.round}`, cumMin: r.cumMin })),
    [rounds],
  );

  return (
    <div className="lg:col-span-2 rounded-xl border border-dashed border-navy-600 bg-navy-700/30 p-6 flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
        Kehityskäyrä
      </div>
      <div className="text-base font-medium text-white/90 mb-1">
        {player ? fullName(player) : 'Valitse pelaaja taulukosta'}
      </div>
      {player && (
        <div className="text-xs text-white/50 mb-4">
          {player.joukkue} · {player.ika} v · {player.minTotal} min ·{' '}
          {player.maaliTotal} M
        </div>
      )}

      {!player ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-10">
          <TrendingUp className="w-7 h-7 text-white/30" />
          <div className="text-sm text-white/50">
            Klikkaa rivi taulukosta nähdäksesi käyrä.
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-10">
          <Loader2 className="w-6 h-6 text-ice animate-spin" />
          <div className="text-sm text-white/50">Ladataan kierrosdataa…</div>
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke="#1a2640" strokeDasharray="2 4" />
                <XAxis
                  dataKey="round"
                  stroke="#8899AA"
                  tick={{ fontSize: 11, fill: '#A5B4C8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#243350' }}
                />
                <YAxis
                  stroke="#8899AA"
                  tick={{ fontSize: 10, fill: '#A5B4C8' }}
                  tickLine={false}
                  axisLine={false}
                  unit=" min"
                />
                <Tooltip
                  content={<RoundTooltip />}
                  cursor={{ stroke: '#00C8FF', strokeOpacity: 0.3 }}
                />
                <Line
                  type="monotone"
                  dataKey="cumMin"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: '#06b6d4', r: 2.5 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/40 mt-3 text-center">
            Kumulatiiviset minuutit · {chartData.length} kierrosta
          </p>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-10">
          <Info className="w-6 h-6 text-white/30" />
          <div className="text-sm text-white/50">
            Kierrosdataa ei vielä saatavilla.
          </div>
        </div>
      )}
    </div>
  );
}

export default function PelaikaPage() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState<SeasonPlayer | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>('minutes');

  const {
    data: seasonPlayers,
    loading: playersLoading,
    error: playersError,
    refetch,
  } = useApi(() => getSeasonPlayers(SEASON), [SEASON]);

  // Joukkuekaavio + InsightBar käyttävät edelleen youth-stats-dataa.
  const { data: statsData, loading: statsLoading } = useApi(
    () => getYouthStatsAll(SEASON),
    [SEASON],
  );

  // Valitun pelaajan kierrosdata kehityskäyrää varten.
  const selectedSlug = selectedPlayer?.slug;
  const { data: playerRounds, loading: roundsLoading } = useApi(
    async () => {
      if (!selectedSlug) return null;
      try {
        return await getPlayerRounds(SEASON, selectedSlug);
      } catch {
        return null;
      }
    },
    [selectedSlug, SEASON],
  );

  const veikkausliiga = useMemo(
    () => (statsData ? filterReliableTeams(statsData.veikkausliiga) : []),
    [statsData],
  );

  const players = useMemo(() => seasonPlayers ?? [], [seasonPlayers]);
  const withMinutes = useMemo(
    () => players.filter((p) => p.minTotal > 0),
    [players],
  );
  const filteredPlayers = useMemo(
    () => filterAndSort(players, activeFilter),
    [players, activeFilter],
  );

  if (playersLoading || statsLoading) return <LoadingSkeleton />;
  if (playersError || !seasonPlayers) {
    return (
      <ErrorState
        message={playersError ?? 'Tuntematon virhe'}
        onRetry={refetch}
      />
    );
  }

  const vPct = calcU23Pct(veikkausliiga);
  const topByMinutes =
    [...withMinutes].sort((a, b) => b.minTotal - a.minTotal)[0] ?? null;
  const youngest = withMinutes.length
    ? withMinutes.reduce((a, b) => (a.ika <= b.ika ? a : b))
    : null;
  const teamsOver25 = veikkausliiga.filter(
    (t) => t.youthPercentageU23 >= 25,
  ).length;

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

      {/* KPI-kortit */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="U23 peliaika-%"
          value={`${vPct.toFixed(1)} %`}
          accent="aurora"
          info="Veikkausliigan kaikista peliminuuteista alle 23-vuotiaiden osuus (API-Football, datavaje-suodatettu)."
        />
        <KpiCard
          label="Pelaajia peliajalla"
          value={`${withMinutes.length} / ${players.length}`}
          hint="peliaikaa saaneet"
          accent="ice"
          info="Pelaajat joilla on vähintään yksi pelattu minuutti / kaikki tuodut pelaajat (Firestore-data)."
        />
        <KpiCard
          label="Eniten minuutteja"
          value={topByMinutes ? String(topByMinutes.minTotal) : '—'}
          hint={
            topByMinutes
              ? `${fullName(topByMinutes)} · ${topByMinutes.joukkue}`
              : undefined
          }
          accent="ice"
          info="Pelaaja jolla eniten pelattuja minuutteja tällä kaudella."
        />
        <KpiCard
          label="Nuorin"
          value={youngest ? `${youngest.ika} v` : '—'}
          hint={youngest ? `${fullName(youngest)} · ${youngest.joukkue}` : undefined}
          info="Nuorin peliaikaa saanut pelaaja."
        />
        <KpiCard
          label="Joukkueet ≥ 25 %"
          value={`${teamsOver25} / ${veikkausliiga.length}`}
          info="Joukkueet joiden U23-peliaikaosuus on vähintään 25 % / kaikki (datavaje-suodatettu)."
        />
      </section>

      {/* Joukkuekaavio */}
      {veikkausliiga.length > 0 && (
        <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <SectionHeader
            title="U23 peliaika joukkueittain"
            hint={`${veikkausliiga.length} joukkuetta`}
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
        </section>
      )}

      {/* Taulukko + kehityskäyrä */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <SectionHeader
            title="Eniten peliaikaa — U23"
            hint={`${filteredPlayers.length} pelaajaa`}
          />

          <div className="flex flex-wrap gap-1.5 mb-4">
            {FILTERS.map((f) => {
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
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
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="text-sm text-white/40 italic py-6 text-center">
              Suodattimella ei löytynyt pelaajia.
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
                    <th className="py-2 pr-3 text-right">O</th>
                    <th className="py-2 pl-3 w-8" aria-label="Avaa pelaaja" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((p, i) => {
                    const isSelected = selectedPlayer?.slug === p.slug;
                    return (
                      <tr
                        key={p.slug}
                        onClick={() => setSelectedPlayer(p)}
                        onDoubleClick={() => navigate(`/pelaaja/${p.slug}`)}
                        className={`border-b border-navy-700 cursor-pointer transition-colors ${
                          isSelected ? 'bg-ice/10' : 'hover:bg-navy-700/60'
                        }`}
                      >
                        <td className="py-2 pr-3 text-right text-white/40 font-mono tabular">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-3 font-medium text-white/95">
                          <span>{fullName(p)}</span>
                          <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice/15 text-ice font-medium">
                            {p.ika} v
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-white/60">{p.joukkue}</td>
                        <td className="py-2 pr-3 text-right text-ice font-mono tabular">
                          {p.minTotal}
                        </td>
                        <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                          {p.maaliTotal}
                        </td>
                        <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                          {p.ottelutTotal}
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pelaaja/${p.slug}`);
                            }}
                            className="text-ice/70 hover:text-ice transition-colors"
                            aria-label={`Avaa ${fullName(p)}`}
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-white/40 mt-3">
                Klikkaa riviä → kehityskäyrä päivittyy. Tuplaklikkaus tai ↗
                → pelaajan oma sivu.
              </p>
            </div>
          )}
        </div>

        <PlayerProgressionPanel
          player={selectedPlayer}
          loading={roundsLoading}
          rounds={playerRounds}
        />
      </section>

      {/* InsightBar */}
      {veikkausliiga.length > 0 && (
        <section>
          <InsightBar teams={veikkausliiga} />
        </section>
      )}

      <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Veikkausliiga {SEASON}</span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          <span className="text-white/70 tabular">{players.length}</span>{' '}
          pelaajaa
        </span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          Lähteet: <span className="text-white/60">Veikkausliiga.com</span> ·{' '}
          <span className="text-white/60">API-Football</span>
        </span>
      </footer>
    </div>
  );
}
