import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Info,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import {
  staggerContainer,
  staggerItem,
  FadeIn,
} from '@/components/animations';
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
  ReferenceLine,
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
  getOfficialStats,
  getPlayerSeason,
  getPlayerFixtures,
  filterReliableTeams,
  buildU23Players,
  type YouthStats,
  type U23Player,
  type ApiFootballPlayerSeason,
  type PlayerFixture,
} from '@/services/api';
import { InsightBar } from '@/components/InsightBar';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ResearchModal } from '@/components/ResearchModal';

const SEASON = 2026;

type FilterId =
  | 'minutes'
  | 'goals'
  | 'assists'
  | 'youngest'
  | 'u21'
  | 'u19'
  | 'u17';

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'minutes', label: 'Eniten minuutteja' },
  { id: 'goals', label: 'Eniten maaleja' },
  { id: 'assists', label: 'Eniten syöttöjä' },
  { id: 'youngest', label: 'Nuorin' },
  { id: 'u21', label: 'U21' },
  { id: 'u19', label: 'U19' },
  { id: 'u17', label: 'U17' },
];

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

/** U21-pelaajien minuuttien osuus joukkueen kaikista minuuteista (%).
 *  Suhteellinen metriikka — ei vääristy yhden pelaajan ansiosta. */
function calcU21TeamPct(team: YouthStats): number {
  return team.totalMinutes > 0
    ? Math.round((team.youthMinutesU21 / team.totalMinutes) * 1000) / 10
    : 0;
}

function filterAndSort(players: U23Player[], filter: FilterId): U23Player[] {
  let result = players;

  if (filter === 'u21') {
    result = result.filter((p) => p.age <= 21);
  } else if (filter === 'u19') {
    result = result.filter((p) => p.age <= 19);
  } else if (filter === 'u17') {
    result = result.filter((p) => p.age <= 17);
  }

  const sorted = [...result];
  if (filter === 'goals') {
    sorted.sort((a, b) => b.goals - a.goals);
  } else if (filter === 'assists') {
    sorted.sort((a, b) => b.assists - a.assists);
  } else if (filter === 'youngest') {
    sorted.sort((a, b) => a.age - b.age);
  } else {
    // 'minutes' (default) and all U-suodattimet
    sorted.sort((a, b) => b.minutes - a.minutes);
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
    <div style={{ width: '100%', height: Math.max(320, data.length * 44) }}>
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
            interval={0}
            minTickGap={8}
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

function avgU21Color(pct: number): string {
  if (pct >= 20) return '#22c55e';
  if (pct >= 15) return '#eab308';
  if (pct >= 10) return '#f97316';
  return '#ef4444';
}

/** Tutkimusperusteinen minuuttitavoite ikäryhmän mukaan.
 *  Lähde: CIES, Antwerpenin yliopisto, Football Benchmark 2024 */
function getMinuteTarget(age: number | undefined): { target: number; label: string; phase: string } {
  if (age === undefined) return { target: 1500, label: 'Tavoite: 1 500 min', phase: 'tuntematon' };
  if (age <= 18) return { target: 1000, label: 'Debyytti', phase: 'debyytti' };
  if (age <= 20) return { target: 1500, label: 'Vakiinnutus', phase: 'vakiinnutus' };
  if (age === 21) return { target: 1500, label: '⭐ Kriittinen vuosi', phase: 'kriittinen' };
  return { target: 1500, label: 'Myynti-ikkuna', phase: 'myynti' };
}

function minuteTargetColor(pct: number, phase: string): string {
  if (pct >= 100) return '#22c55e';
  if (pct >= 75) return phase === 'kriittinen' || phase === 'myynti' ? '#eab308' : '#22c55e';
  if (pct >= 50) return '#eab308';
  return '#ef4444';
}

function readinessBadge(age: number | undefined, minutes: number): { text: string; color: string } | null {
  if (age === undefined) return null;
  const { target, phase } = getMinuteTarget(age);
  if (minutes >= target && phase === 'kriittinen') {
    return { text: '⭐ Myyntivalmis', color: '#22c55e' };
  }
  if (minutes >= target) {
    return { text: '🟢 Edelläkävijä', color: '#22c55e' };
  }
  if (minutes >= target * 0.75) {
    return { text: '🟡 Kehityksessä', color: '#eab308' };
  }
  if (minutes >= target * 0.5) {
    return { text: '🟠 Alkuvaihe', color: '#f97316' };
  }
  return { text: '🔴 Ei riitä', color: '#ef4444' };
}

function U21PctTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload as { fullName: string; pct: number; players: number; u21Mins: number; totalMins: number };
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-sm">
      <div className="font-medium text-white">{entry.fullName}</div>
      <div className="text-ice tabular">{entry.pct.toFixed(1)} % U21-peliaikaa</div>
      <div className="text-white/50 text-xs">
        {entry.u21Mins.toLocaleString('fi-FI')} min / {entry.totalMins.toLocaleString('fi-FI')} min
        {' · '}{entry.players} U21-pelaaja{entry.players !== 1 ? 'a' : ''}
      </div>
    </div>
  );
}

/** U21-peliaika-% joukkueittain.
 *  Näyttää kuinka suuren osan joukkueen peliajasta U21-pelaajat saavat.
 *  Suhteellinen metriikka — ei vääristy yhden pelaajan ansiosta. */
function U21TeamPctChart({ teams }: { teams: YouthStats[] }) {
  const data = [...teams]
    .sort((a, b) => calcU21TeamPct(b) - calcU21TeamPct(a))
    .map((t) => ({
      team: shortenTeamName(t.teamName),
      fullName: t.teamName,
      pct: calcU21TeamPct(t),
      players: t.youthPlayersU21,
      u21Mins: t.youthMinutesU21,
      totalMins: t.totalMinutes,
    }));

  return (
    <div style={{ width: '100%', height: Math.max(320, data.length * 44) }}>
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
            domain={[0, Math.max(35, ...data.map((d) => d.pct))]}
            unit=" %"
          />
          <YAxis
            type="category"
            dataKey="team"
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={false}
            width={96}
            interval={0}
            minTickGap={8}
          />
          <Tooltip content={<U21PctTooltip />} cursor={{ fill: 'rgba(0, 212, 255, 0.05)' }} />
          <ReferenceLine
            x={20}
            stroke="#22c55e"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{ value: '20 % (vahva)', position: 'insideTopLeft', fill: '#22c55e', fontSize: 10 }}
          />
          <ReferenceLine
            x={10}
            stroke="#eab308"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: '10 %', position: 'insideTopLeft', fill: '#eab308', fontSize: 10 }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.team} fill={avgU21Color(entry.pct)} />
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
      <div className="h-20 bg-navy-700/30 rounded-lg" />
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

/** Pelaajan kehityskäyrä — käyttää oikeaa fixture-dataa (per-kierros)
 *  jos saatavilla, muuten putoaa takaisin estimaattiin
 *  (getPlayerSeason-datasta jaettuna tasaisesti). */
interface PlayerProgressionPanelProps {
  player: U23Player | null;
  loading: boolean;
  data: ApiFootballPlayerSeason[] | null;
  fixtures: PlayerFixture[] | null;
}

interface FixtureTooltipData {
  round: string;
  roundNum: number;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
  matchup: string;
  score: string | null;
  actual: boolean;
  estimated: boolean;
  cumulative?: number;
}

function FixtureTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as FixtureTooltipData;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-white/90 font-medium">{d.round}</span>
        {d.estimated && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
            estimaatti
          </span>
        )}
      </div>
      <div className="text-white/60">
        {d.matchup}
        {d.score && (
          <span className="text-white/90 font-mono ml-2">{d.score}</span>
        )}
      </div>
      <div className="text-ice tabular pt-1">
        {d.minutes} min
        {typeof d.cumulative === 'number' && (
          <span className="text-white/50 ml-2">
            yht. {d.cumulative.toLocaleString('fi-FI')} min
          </span>
        )}
      </div>
      {(d.goals > 0 || d.assists > 0) && (
        <div className="text-white/80">
          {d.goals} M · {d.assists} S
        </div>
      )}
      {d.rating !== null && !d.estimated && (
        <div className="text-aurora">Rating: {d.rating.toFixed(2)}</div>
      )}
    </div>
  );
}

function PlayerProgressionPanel({
  player,
  loading,
  data,
  fixtures,
}: PlayerProgressionPanelProps) {
  const [cumulativeView, setCumulativeView] = useState(false);

  // 1) Yritä oikealla fixture-datalla
  //    Järjestetään kronologisesti — vain runkosarjan ottelut mukaan
  //    (Cup, Championship Round, Relegation jätetään pois samalla logiikalla
  //    kuin backendin u21-round-trend).
  const fixtureChartData: FixtureTooltipData[] | null = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return null;
    const parseRound = (round: string): number => {
      const m = round.match(/Regular Season\s+-\s+(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const sorted = fixtures
      .map((f, i) => {
        const roundNum = parseRound(f.round);
        return {
          roundNum,
          round: roundNum > 0 ? `K${roundNum}` : `O${i + 1}`,
          date: f.date,
          minutes: f.minutes,
          goals: f.goals,
          assists: f.assists,
          rating: f.rating,
          matchup: `${f.homeTeam} – ${f.awayTeam}`,
          score: f.score,
          actual: f.actual ?? true,
          estimated: f.estimated ?? false,
        };
      })
      .filter((d) => d.roundNum > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Laske kumulatiiviset minuutit
    let cumulative = 0;
    return sorted.map((d) => {
      cumulative += d.minutes;
      return { ...d, cumulative };
    });
  }, [fixtures]);

  const estimatedCount =
    fixtureChartData?.filter((d) => d.estimated).length ?? 0;

  // 2) Fallback-estimaatti getPlayerSeason-datasta
  const stats =
    data && data.length > 0
      ? data[0].statistics.find((s) => s.league.id === 244) ??
        data[0].statistics[0]
      : null;
  const appearances = stats?.games.appearences ?? 0;
  const officialMin = player?.minutes ?? 0;
  const apiMin = stats?.games.minutes ?? 0;
  const totalMin = officialMin || apiMin;

  const estimateData =
    appearances > 0 && totalMin > 0
      ? Array.from({ length: appearances }, (_, i) => ({
          round: 'K' + (i + 1),
          min: Math.round(totalMin / appearances) * (i + 1),
        }))
      : [];

  // 3) Projektio: jos kausi on kesken, arvioi loppukauden minuutit
  const projection = useMemo(() => {
    if (!player || !fixtureChartData || fixtureChartData.length === 0)
      return null;
    const matchesPlayed = fixtureChartData.length;
    const avgMinPerMatch = player.minutes / matchesPlayed;
    // Veikkausliigassa 22 runkosarjan ottelua (12 joukkuetta, kaksinkertainen)
    const remainingMatches = Math.max(0, 22 - matchesPlayed);
    const projectedTotal = Math.round(
      player.minutes + avgMinPerMatch * remainingMatches,
    );
    return {
      avgMinPerMatch: Math.round(avgMinPerMatch),
      remainingMatches,
      projectedTotal,
    };
  }, [player, fixtureChartData]);

  return (
    <div className="lg:col-span-2 rounded-xl border border-dashed border-navy-600 bg-navy-700/30 p-6 flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center justify-between gap-2">
        <span>Kehityskäyrä</span>
        {fixtureChartData && (
          <span className="text-ice normal-case tracking-normal">
            · {fixtureChartData.length} ottelua
            {estimatedCount > 0 && (
              <span className="text-yellow-400/80 ml-1">
                ({estimatedCount} estimaatti)
              </span>
            )}
          </span>
        )}
        {!fixtureChartData && estimateData.length > 0 && (
          <span className="text-white/30 normal-case tracking-normal">
            · estimaatti
          </span>
        )}
      </div>
      <div className="text-base font-medium text-white/90 mb-1">
        {player ? player.playerName : 'Valitse pelaaja taulukosta'}
      </div>
      {player && (
        <div className="mb-4 space-y-3">
          {/* Perustiedot */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
            <span>{player.teamName}</span>
            <span className="w-px h-3 bg-white/20" />
            <span>{player.age} v</span>
            <span className="w-px h-3 bg-white/20" />
            <span>≈ {Math.round(player.minutes / 90)} täyttä peliä</span>
            <span className="w-px h-3 bg-white/20" />
            <span className="text-aurora">{player.goals} M</span>
            <span className="text-ice">{player.assists} S</span>
          </div>

          {/* Minuuttitavoite + readiness */}
          {player.age !== undefined && player.age <= 23 && (
            <div className="bg-navy-700/50 border border-navy-600 rounded-lg p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">
                    {getMinuteTarget(player.age).label}
                  </span>
                  {(() => {
                    const badge = readinessBadge(player.age, player.minutes);
                    return badge ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ color: badge.color, backgroundColor: `${badge.color}15` }}
                      >
                        {badge.text}
                      </span>
                    ) : null;
                  })()}
                </div>
                <span className="text-sm font-medium tabular" style={{ color: minuteTargetColor(Math.min(100, (player.minutes / getMinuteTarget(player.age).target) * 100), getMinuteTarget(player.age).phase) }}>
                  {player.minutes.toLocaleString('fi-FI')} / {getMinuteTarget(player.age).target.toLocaleString('fi-FI')} min
                </span>
              </div>
              <div className="relative h-2 bg-navy-600 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (player.minutes / getMinuteTarget(player.age).target) * 100)}%`,
                    backgroundColor: minuteTargetColor(Math.min(100, (player.minutes / getMinuteTarget(player.age).target) * 100), getMinuteTarget(player.age).phase),
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-white/40">
                  {Math.max(0, getMinuteTarget(player.age).target - player.minutes).toLocaleString('fi-FI')} min tavoitteeseen
                </span>
                <span className="text-[10px] text-white/40">
                  {Math.min(100, Math.round((player.minutes / getMinuteTarget(player.age).target) * 100))} %
                </span>
              </div>
            </div>
          )}
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
      ) : fixtureChartData && fixtureChartData.length > 0 ? (
        // Oikea fixture-data — min per kierros 0–90
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setCumulativeView(false)}
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  !cumulativeView
                    ? 'bg-ice/15 border-ice text-ice'
                    : 'border-navy-600 text-white/50 hover:text-white/70'
                }`}
              >
                Per ottelu
              </button>
              <button
                onClick={() => setCumulativeView(true)}
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  cumulativeView
                    ? 'bg-ice/15 border-ice text-ice'
                    : 'border-navy-600 text-white/50 hover:text-white/70'
                }`}
              >
                Kumulatiivinen
              </button>
            </div>
            {estimatedCount > 0 && (
              <span className="text-[10px] text-yellow-400/80">
                {estimatedCount} ottelua estimoitu
              </span>
            )}
          </div>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={fixtureChartData}
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
                  domain={cumulativeView ? [0, 'auto'] : [0, 90]}
                  ticks={cumulativeView ? undefined : [0, 30, 60, 90]}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<FixtureTooltip />}
                  cursor={{ stroke: '#00C8FF', strokeOpacity: 0.3 }}
                />
                <Line
                  type="linear"
                  dataKey={cumulativeView ? 'cumulative' : 'minutes'}
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={(props) => {
                    const d = props.payload as FixtureTooltipData;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={d.estimated ? 3 : 2.5}
                        fill={d.estimated ? '#facc15' : '#06b6d4'}
                        stroke={d.estimated ? '#facc15' : 'none'}
                        strokeWidth={d.estimated ? 2 : 0}
                        strokeDasharray={d.estimated ? '2 2' : undefined}
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/40 mt-3 text-center">
            {cumulativeView
              ? `Kumulatiiviset minuutit kauden aikana · ${fixtureChartData.length} ottelua`
              : `Minuutit per ottelu · ${fixtureChartData.length} ottelua`}
            {estimatedCount > 0 && (
              <span className="text-yellow-400/80 ml-1">
                · {estimatedCount} estimoitu API-puutteen vuoksi
              </span>
            )}
          </p>
          {projection && (
            <div className="mt-3 bg-navy-700/50 border border-navy-600 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                Projektio kauden loppuun
              </div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="text-white/90">
                  <span className="tabular text-ice">{player?.minutes.toLocaleString('fi-FI')}</span>{' '}
                  min nyt
                </span>
                <span className="text-white/60">→</span>
                <span className="text-white/90">
                  <span className="tabular text-aurora">
                    {projection.projectedTotal.toLocaleString('fi-FI')}
                  </span>{' '}
                  min projektio
                </span>
              </div>
              <div className="text-[11px] text-white/40 mt-1">
                Keskiarvo {projection.avgMinPerMatch} min/ottelu ·{' '}
                {projection.remainingMatches} ottelua jäljellä
              </div>
            </div>
          )}
        </>
      ) : estimateData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-10">
          <Info className="w-6 h-6 text-white/30" />
          <div className="text-sm text-white/50">
            Ei vielä otteluita kaudelta.
          </div>
        </div>
      ) : (
        // Fallback-estimaatti
        <>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={estimateData}
                margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
              >
                <XAxis
                  dataKey="round"
                  stroke="#8899AA"
                  tick={{ fontSize: 11, fill: '#A5B4C8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#243350' }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: '#0F1D32',
                    border: '1px solid #243350',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(v: number) => [v + ' min', 'Kum. minuutit']}
                />
                <Line
                  type="monotone"
                  dataKey="min"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/40 mt-3 text-center">
            Estimoitu tasaisesti {appearances} ottelun yli
          </p>
        </>
      )}
    </div>
  );
}

export default function PelaikaPage() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState<U23Player | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>('u21');
  const [researchOpen, setResearchOpen] = useState(false);

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

  const { data: officialData, loading: officialLoading } = useApi(
    () => getOfficialStats(SEASON),
    [SEASON],
  );

  // Pelaajan kausi-detail kehityskäyrää varten. Triggeröityy automaattisesti
  // kun selectedPlayer.playerId muuttuu (taulukon klikkaus).
  const selectedPlayerId = selectedPlayer?.playerId;
  const { data: playerSeasonData, loading: playerSeasonLoading } = useApi(
    async () => {
      if (!selectedPlayerId) return null;
      return getPlayerSeason(selectedPlayerId, SEASON);
    },
    [selectedPlayerId, SEASON],
  );

  // Oikea kierroskohtainen fixture-data — jos saatavilla, ohittaa estimaatin.
  const { data: playerFixtures, loading: playerFixturesLoading } = useApi(
    async () => {
      if (!selectedPlayerId) return null;
      try {
        // Force refresh to recalculate with estimation logic for missing match data
        return await getPlayerFixtures(selectedPlayerId, SEASON, true);
      } catch {
        return null;
      }
    },
    [selectedPlayerId, SEASON],
  );

  const veikkausliiga = useMemo(
    () => (statsData ? filterReliableTeams(statsData.veikkausliiga) : []),
    [statsData],
  );

  // YKSI yhdistetty U23-lista jota käytetään KAIKKIALLA tällä sivulla.
  // Lähtee aina topYouthPlayers-listasta (varmistettu U23) ja rikastaa
  // viralliset minuutit/maalit/syötöt sukunimi-matchilla.
  const u23Players = useMemo(
    () =>
      buildU23Players(
        aggData?.topYouthPlayers ?? [],
        officialData?.data ?? [],
      ),
    [aggData, officialData],
  );

  const filteredPlayers = useMemo(
    () => filterAndSort(u23Players, activeFilter),
    [u23Players, activeFilter],
  );

  if (statsLoading || aggLoading || officialLoading) return <LoadingSkeleton />;
  if (statsError || !statsData) {
    return (
      <ErrorState
        message={statsError ?? 'Tuntematon virhe'}
        onRetry={refetch}
      />
    );
  }

  const vPct = calcU23Pct(veikkausliiga);

  // Eniten minuutteja: u23Players sortattuna minuuttien mukaan → #1.
  // Tämä takaa että top-pelaaja on TODELLA U23 (ei esim. Kreidl).
  const topByMinutes = [...u23Players].sort((a, b) => b.minutes - a.minutes)[0];

  // Nuorin debyyttipisteet: pienin ikä u23Players-listasta.
  const youngest = u23Players.length
    ? u23Players.reduce((a, b) => (a.age <= b.age ? a : b))
    : null;

  const teamsOver25 = veikkausliiga.filter(
    (t) => t.youthPercentageU23 >= 25,
  ).length;

  // U23-pelaajamäärä KPI-korttiin: ensisijaisesti YouthStats team-breakdown
  // (oikea ei-katkaistu luku, ei rajoitu topYouthPlayers:n 20:n cap:iin).
  // Jos joskus official-datasta saadaan ikä, käytetään sitä tarkennuksena.
  const u23Count = veikkausliiga.reduce((s, t) => s + t.youthPlayersU23, 0);
  const officialU23 =
    officialData?.data?.filter((p) => p.age !== undefined && p.age <= 23) ?? [];
  const u23CountDisplay = officialU23.length > 0 ? officialU23.length : u23Count;
  const totalPlayers = officialData?.data?.length ?? 0;

  // U21-peliaika-% koko liigassa (painotettu joukkueiden minuuteilla)
  const totalU21Minutes = veikkausliiga.reduce((s, t) => s + t.youthMinutesU21, 0);
  const totalAllMinutes = veikkausliiga.reduce((s, t) => s + t.totalMinutes, 0);
  const leagueAvgU21Pct = totalAllMinutes > 0 ? (totalU21Minutes / totalAllMinutes) * 100 : 0;

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
            <span className="text-aurora font-medium">scout-analyysi</span>
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/60 max-w-2xl">
            Tanskan ja muiden maiden scoutit seuraavat ensisijaisesti U21 ja
            nuorempia pelaajia. Tämä sivu nostaa esiin heidät — joukkueittain,
            minuutein ja kehityskäyrin.
          </p>
        </div>
      </header>

      {/* 1. KPI-kortit (5 kpl). Kaikki KPI:t U23-numerot (Eniten minuutteja)
          tulevat YHDISTETYSTÄ u23Players-listasta — siksi esim. Johannes
          Kreidl ei näy täällä vaikka hän on Veikkausliigan minuuttijohtaja. */}
      <motion.section
        className="grid grid-cols-2 lg:grid-cols-5 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem}>
          <KpiCard
            label="U23 peliaika-%"
            value={`${vPct.toFixed(1)} %`}
            accent="aurora"
            info="Veikkausliigan kaikista peliminuuteista alle 23-vuotiaiden osuus. Painotettu summa joukkueiden kesken (API-Football). Sulkee pois joukkueet joilla totalMinutes < 1000 (datavaje)."
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <KpiCard
            label="U23 pelaajia"
            value={`${u23CountDisplay} / ${totalPlayers}`}
            hint="Veikkausliigassa"
            accent="ice"
            info="Alle 23-vuotiaat peliaikaa saaneet pelaajat / kaikki Veikkausliigan pelaajat. U23-summa lasketaan joukkueiden YouthStats-erittelyistä (oikea ei-katkaistu luku, ei rajoitu Top-20:een)."
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <KpiCard
            label="Eniten minuutteja (U23)"
            value={topByMinutes ? String(topByMinutes.minutes) : '—'}
            hint={
              topByMinutes
                ? `${topByMinutes.playerName} · ${topByMinutes.teamName}`
                : undefined
            }
            accent="ice"
            info="U23-pelaaja jolla eniten pelattuja minuutteja. Yhdistää API-Footballin (varmistettu U23) ja Veikkausliiga.com:n viralliset minuutit sukunimi-matchilla."
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <KpiCard
            label="Nuorin debyyttipisteet"
            value={youngest ? `${youngest.age} v` : '—'}
            hint={youngest ? `${youngest.playerName} · ${youngest.teamName}` : undefined}
            info="Nuorin pelaaja joka on saanut peliaikaa tällä kaudella. Lasketaan U23-pelaajien (topYouthPlayers) listasta — pelaajat joilla on ikätieto API-Footballissa ja jotka ovat saaneet minuutteja."
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <KpiCard
            label="Joukkueet ≥ 25 %"
            value={`${teamsOver25} / ${veikkausliiga.length}`}
            info="Joukkueet joiden U23-peliaikaosuus on vähintään 25 % / kaikki Veikkausliigan joukkueet (datavaje-suodatuksen jälkeen). Korkea arvo = liiga antaa laajasti peliaikaa nuorille."
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <KpiCard
            label="Keskim. U21-%"
            value={`${leagueAvgU21Pct.toFixed(1)} %`}
            hint="koko liiga"
            accent="ice"
            info="U21-pelaajien minuuttien osuus kaikista pelatuista minuuteista Veikkausliigassa. Vertailu Pohjoismaihin: Suomi 19,2 %, Ruotsi 22,4 %, Norja 20,2 %, Tanska 11,7 %."
          />
        </motion.div>
      </motion.section>

      {/* 2. Joukkuekaavio — täysleveys */}
      <FadeIn y={20}>
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
      </FadeIn>

      {/* 2b. U21-peliaika-% joukkueittain — suhteellinen näkymä */}
      <FadeIn y={20}>
        <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-base font-medium">U21-peliaika-% — joukkueittain</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40">
                Keskimäärä: {leagueAvgU21Pct.toFixed(1)} %
              </span>
              <button
                onClick={() => setResearchOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-navy-700 hover:bg-navy-600 border border-navy-500 rounded-md text-ice transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Tutkimusperusteet
              </button>
            </div>
          </div>
          <U21TeamPctChart teams={veikkausliiga} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#22c55e]" /> ≥ 20 % vahva
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#eab308]" /> 15–20 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#f97316]" /> 10–15 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#ef4444]" /> &lt; 10 %
            </span>
          </div>
          <p className="text-[11px] text-white/40 mt-3">
            Suhteellinen metriikka: kuinka suuren osan joukkueen peliajasta U21-pelaajat saavat.
            Ei vääristy yhden pelaajan ansiosta. Faktaa "nuorten kehittämisestä" — numeroita, peliminuutteja.
          </p>
        </section>
      </FadeIn>

      {/* 3 + 4. Taulukko vasemmalla, kehityskäyrä oikealla */}
      <FadeIn y={20} delay={0.1}>
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-navy-700/40 border border-navy-600 rounded-lg p-5">
            <SectionHeader
              title="Eniten peliaikaa — U21"
              hint={`${filteredPlayers.length} pelaajaa`}
            />

            {/* Filtteri-/sorttauspilarit */}
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
                      <th className="py-2 pr-3 text-right">S</th>
                      <th className="py-2 pr-3 text-right">Rating</th>
                      <th className="py-2 pl-3 w-8" aria-label="Avaa pelaaja" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((p, i) => {
                      const isSelected =
                        selectedPlayer?.playerName === p.playerName &&
                        selectedPlayer?.teamName === p.teamName;
                      return (
                        <motion.tr
                          key={`${p.playerName}-${p.teamName}-${i}`}
                          onClick={() => setSelectedPlayer(p)}
                          onDoubleClick={() =>
                            navigate(`/pelaaja/${slugify(p.playerName)}`)
                          }
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.02 }}
                          whileHover={{ backgroundColor: 'rgba(0, 200, 255, 0.06)' }}
                          className={`border-b border-navy-700 cursor-pointer ${
                            isSelected ? 'bg-ice/10' : ''
                          }`}
                        >
                          <td className="py-2 pr-3 text-right text-white/40 font-mono tabular">
                            {i + 1}
                          </td>
                          <td className="py-2 pr-3 font-medium text-white/95">
                            <span>{p.playerName}</span>
                            <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ice/15 text-ice font-medium">
                              {p.age} v
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-white/60">{p.teamName}</td>
                          <td className="py-2 pr-3 text-right text-ice font-mono tabular">
                            {p.minutes}
                          </td>
                          <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                            {p.goals}
                          </td>
                          <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                            {p.assists}
                          </td>
                          <td className="py-2 pr-3 text-right text-aurora font-mono tabular">
                            {p.rating?.toFixed(1) ?? '—'}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pelaaja/${slugify(p.playerName)}`);
                              }}
                              className="text-ice/70 hover:text-ice transition-colors"
                              aria-label={`Avaa ${p.playerName}`}
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
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
            loading={playerSeasonLoading || playerFixturesLoading}
            data={playerSeasonData}
            fixtures={playerFixtures}
          />
        </section>
      </FadeIn>

      {/* 5. InsightBar lopussa */}
      <section>
        <InsightBar teams={veikkausliiga} />
      </section>

      <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Veikkausliiga {SEASON}</span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          <span className="text-white/70 tabular">{veikkausliiga.length}</span>{' '}
          joukkuetta
        </span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          Lähteet:{' '}
          <span className="text-white/60">API-Football</span> ·{' '}
          <span className="text-white/60">Veikkausliiga.com</span>
        </span>
      </footer>

      <ResearchModal open={researchOpen} onClose={() => setResearchOpen(false)} />
    </div>
  );
}
