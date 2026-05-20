import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
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
  getOfficialStats,
  getYouthAggregation,
  getPlayerSeason,
  type ApiFootballPlayerSeason,
  type OfficialPlayer,
  type PlayerStats,
} from '@/services/api';

const SEASON = 2026;
const VEIKKAUSLIIGA_LEAGUE_ID = 244;

const POSITION_FI: Record<string, string> = {
  Midfielder: 'Keskikenttä',
  Attacker: 'Hyökkääjä',
  Forward: 'Hyökkääjä',
  Defender: 'Puolustaja',
  Goalkeeper: 'Maalivahti',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getSurnameKey(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1].toLowerCase();
}

function translatePosition(pos: string | undefined): string {
  if (!pos) return '—';
  return POSITION_FI[pos] ?? pos;
}

function findYouth(slug: string, topYouth: PlayerStats[]): PlayerStats | null {
  return topYouth.find((p) => slugify(p.playerName) === slug) ?? null;
}

function findOfficial(
  youth: PlayerStats,
  official: OfficialPlayer[],
): OfficialPlayer | undefined {
  const surname = getSurnameKey(youth.playerName);
  if (!surname) return undefined;
  return official.find((o) => o.name.toLowerCase().includes(surname));
}

/** Etsi Veikkausliigan statistics-entry — API-Football voi palauttaa useita
 *  (esim. maajoukkue-otteluita), suodata oikea sarja id:llä. */
function pickVeikkausliigaStats(
  data: ApiFootballPlayerSeason | null,
): ApiFootballPlayerSeason['statistics'][number] | null {
  if (!data) return null;
  const direct = data.statistics.find(
    (s) => s.league.id === VEIKKAUSLIIGA_LEAGUE_ID,
  );
  return direct ?? data.statistics[0] ?? null;
}

function LoadingState() {
  return (
    <div className="px-6 py-16 max-w-4xl mx-auto animate-pulse space-y-6">
      <div className="h-8 bg-navy-700/30 rounded w-32" />
      <div className="h-32 bg-navy-700/30 rounded-xl" />
      <div className="h-24 bg-navy-700/30 rounded-xl" />
      <div className="h-40 bg-navy-700/30 rounded-xl" />
    </div>
  );
}

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div className="px-6 py-16 max-w-md mx-auto text-center space-y-4">
      <Info className="w-10 h-10 text-white/40 mx-auto" />
      <div className="text-white/90 font-medium">Pelaajaa ei löytynyt</div>
      <div className="text-sm text-white/60">
        Slug: <span className="font-mono text-white/80">{slug}</span>
      </div>
      <div className="text-xs text-white/40">
        Vain top-20 U23-pelaajaa löytyy tällä hetkellä — etsimäsi pelaaja voi
        olla listan ulkopuolella.
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          to="/nuoret"
          className="text-sm text-ice hover:text-white transition-colors"
        >
          ← Nuoret
        </Link>
        <span className="text-white/20">·</span>
        <Link
          to="/pelaajat"
          className="text-sm text-ice hover:text-white transition-colors"
        >
          Pelaajat
        </Link>
      </div>
    </div>
  );
}

interface StatBlockProps {
  label: string;
  value: string;
  accent?: 'ice' | 'aurora' | 'white';
}

function StatBlock({ label, value, accent = 'white' }: StatBlockProps) {
  const color =
    accent === 'ice'
      ? 'text-ice'
      : accent === 'aurora'
        ? 'text-aurora'
        : 'text-white/90';
  return (
    <div className="text-center py-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
        {label}
      </div>
      <div
        className={`text-xl md:text-2xl font-bold font-mono tabular leading-none ${color}`}
      >
        {value}
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-navy-700 last:border-b-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm text-white/90 font-mono tabular">{value}</span>
    </div>
  );
}

interface PlayerAvatarProps {
  photoUrl?: string;
  name: string;
  size?: number;
}

function PlayerAvatar({ photoUrl, name, size = 80 }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);

  if (!photoUrl || failed) {
    return (
      <div
        className="rounded-full bg-ice/10 border border-ice/20 flex items-center justify-center font-bold text-ice shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
        aria-hidden="true"
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      onError={() => setFailed(true)}
      loading="eager"
      className="rounded-full object-cover shrink-0 border border-navy-600"
      style={{ width: size, height: size }}
    />
  );
}

interface ProgressionData {
  round: string;
  cumMin: number;
}

function ProgressionTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload as ProgressionData;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-sm">
      <div className="text-white/90 font-medium">{entry.round}</div>
      <div className="text-ice tabular">{entry.cumMin} min (kum.)</div>
    </div>
  );
}

interface ProgressionChartProps {
  minutes: number;
  appearances: number;
}

function ProgressionChart({ minutes, appearances }: ProgressionChartProps) {
  if (appearances <= 0 || minutes <= 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10">
        <TrendingUp className="w-7 h-7 text-white/30 mb-2" />
        <div className="text-sm text-white/60">
          Ei vielä pelattuja otteluita kaudella.
        </div>
      </div>
    );
  }

  // Linear estimaatti: jaa minuutit tasaisesti ottelujen kesken.
  // Kumulatiivinen summa = K{i} kohdalla minutes * i / appearances.
  const perRound = minutes / appearances;
  const data: ProgressionData[] = Array.from(
    { length: appearances },
    (_, i) => ({
      round: `K${i + 1}`,
      cumMin: Math.round(perRound * (i + 1)),
    }),
  );

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={false}
            unit=" min"
          />
          <Tooltip
            content={<ProgressionTooltip />}
            cursor={{ stroke: '#00C8FF', strokeOpacity: 0.3 }}
          />
          <Line
            type="monotone"
            dataKey="cumMin"
            stroke="#00C8FF"
            strokeWidth={2.5}
            dot={{ fill: '#00C8FF', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PelaajaPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';

  // 1. Vaihe: youthAgg + officialStats rinnakkain
  const { data: base, loading: baseLoading, error: baseError } = useApi(
    async () => {
      const [official, agg] = await Promise.all([
        getOfficialStats(SEASON),
        getYouthAggregation(SEASON),
      ]);
      return { official: official.data, topYouth: agg.topYouthPlayers };
    },
    [SEASON],
  );

  // 2. Vaihe: löydä playerId topYouthPlayers-listasta slug:lla
  const youthMatch = useMemo(() => {
    if (!base || !slug) return null;
    return findYouth(slug, base.topYouth);
  }, [base, slug]);

  const playerId = youthMatch?.playerId;

  // 3. Vaihe: hae playerById kun playerId on tiedossa (rinnakkain re-render:ssä)
  const { data: detailArray, loading: detailLoading } = useApi(
    async () => {
      if (!playerId) return null;
      return getPlayerSeason(playerId, SEASON);
    },
    [playerId, SEASON],
  );

  if (baseLoading) return <LoadingState />;
  if (baseError) {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <Info className="w-10 h-10 text-red-400/80 mx-auto mb-4" />
        <div className="text-white/90 font-medium mb-2">
          Datan lataus epäonnistui
        </div>
        <div className="text-sm text-white/60">{baseError}</div>
      </div>
    );
  }
  if (!youthMatch) return <NotFoundState slug={slug} />;

  // Detail = ensimmäinen alkio array:sta (Veikkausliiga-suodatus tehty backendissä)
  const detail = detailArray && detailArray.length > 0 ? detailArray[0] : null;
  const stats = pickVeikkausliigaStats(detail);

  // Virallinen scraper-match (täysi suomalainen nimi + tarkat luvut)
  const officialMatch = findOfficial(youthMatch, base.official);

  // Yhdistetyt arvot — virallinen voittaa kun saatavilla
  const displayName = officialMatch?.name ?? youthMatch.playerName;
  const teamName = youthMatch.teamName;
  const age = youthMatch.age;
  const photoUrl = detail?.player.photo;
  const nationality = detail?.player.nationality;
  const number = stats?.games.number;
  const position = stats?.games.position;
  const rating = stats?.games.rating ? parseFloat(stats.games.rating) : null;
  const minutes = officialMatch?.minutes ?? youthMatch.minutesPlayed;
  const goals = officialMatch?.goals ?? youthMatch.goals;
  const assists = officialMatch?.assists ?? youthMatch.assists;
  const yellowCards = officialMatch?.yellowCards ?? youthMatch.yellowCards;
  const tp = goals + assists;

  // Pelitilastot detailistä (kaikki nullable)
  const appearances = stats?.games.appearences ?? youthMatch.appearances ?? 0;
  const starts = stats?.games.lineups ?? youthMatch.starts ?? 0;
  const shotsTotal = stats?.shots.total ?? 0;
  const shotsOn = stats?.shots.on ?? 0;
  const keyPasses = stats?.passes.key ?? youthMatch.keyPasses ?? 0;
  const passAccuracy = stats?.passes.accuracy ?? youthMatch.passAccuracy ?? 0;
  const duelsWon = stats?.duels.won ?? 0;
  const duelsTotal = stats?.duels.total ?? 0;
  const duelsPct =
    duelsTotal > 0 ? Math.round((duelsWon / duelsTotal) * 100) : 0;
  const tackles = stats?.tackles.total ?? youthMatch.tackles ?? 0;
  const saves = stats?.goals.saves ?? 0;
  const foulsCommitted = stats?.fouls.committed ?? 0;
  const foulsDrawn = stats?.fouls.drawn ?? 0;
  const subBench = stats?.substitutes.bench ?? 0;
  const subIn = stats?.substitutes.in ?? 0;

  const ratingDisplay =
    rating !== null && !isNaN(rating) ? rating.toFixed(2) : '—';
  const passAccDisplay = passAccuracy > 0 ? `${Math.round(passAccuracy)} %` : '—';
  const positionDisplay = translatePosition(position);
  const numberDisplay = number ? `#${number}` : '';

  return (
    <div className="px-6 py-10 md:py-14 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm">
        <Link
          to="/nuoret"
          className="inline-flex items-center gap-1.5 text-ice hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Nuoret
        </Link>
        <span className="text-white/20">·</span>
        <Link
          to="/pelaajat"
          className="text-ice hover:text-white transition-colors"
        >
          Pelaajat
        </Link>
        <span className="text-white/20">·</span>
        <Link
          to="/peliaika"
          className="text-ice hover:text-white transition-colors"
        >
          Peliaika
        </Link>
      </div>

      {/* Header: kasvokuva + nimi + meta */}
      <header className="bg-navy-700/40 border border-navy-600 rounded-xl p-6 flex items-start gap-5">
        <PlayerAvatar photoUrl={photoUrl} name={displayName} size={80} />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-1 font-medium">
            Veikkausliiga · Kausi {SEASON}
          </div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight leading-tight">
            {displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            <span className="text-white/90">{positionDisplay}</span>
            {numberDisplay && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-ice font-mono">{numberDisplay}</span>
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
            <span>{teamName}</span>
            {age !== undefined && (
              <>
                <span className="text-white/20">·</span>
                <span>{age} v</span>
              </>
            )}
            {nationality && (
              <>
                <span className="text-white/20">·</span>
                <span>{nationality}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Päätilastot 6 sarakkeessa */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl">
        <div className="text-xs uppercase tracking-wider text-white/40 px-5 pt-4">
          Kauden tilastot
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-navy-600">
          <StatBlock label="Min" value={String(minutes)} accent="ice" />
          <StatBlock label="M" value={String(goals)} />
          <StatBlock label="S" value={String(assists)} />
          <StatBlock label="TP" value={String(tp)} accent="aurora" />
          <StatBlock label="KK" value={String(yellowCards)} />
          <StatBlock label="Rating" value={ratingDisplay} accent="ice" />
        </div>
      </section>

      {/* Pelitilastot 2-sarakkeessa */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">
          Pelitilastot
          {detailLoading && (
            <span className="ml-2 text-white/30 normal-case tracking-normal">
              · ladataan…
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          <div>
            <DetailRow label="Aloitukset" value={`${starts} / ${appearances}`} />
            <DetailRow
              label="Laukaukset"
              value={`${shotsTotal} (${shotsOn} maaliin)`}
            />
            <DetailRow label="Avaussyötöt" value={String(keyPasses)} />
            <DetailRow label="Passitarkkuus" value={passAccDisplay} />
          </div>
          <div>
            <DetailRow
              label="Haastot voitettu"
              value={
                duelsTotal > 0
                  ? `${duelsWon}/${duelsTotal} (${duelsPct} %)`
                  : '—'
              }
            />
            <DetailRow label="Taklaukset" value={String(tackles)} />
            <DetailRow label="Torjunnat" value={String(saves)} />
            <DetailRow
              label="Rikkeet tehty/saatu"
              value={`${foulsCommitted}/${foulsDrawn}`}
            />
          </div>
        </div>
      </section>

      {/* Kehityskäyrä — estimoitu kumulatiivinen min */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Kehityskäyrä — kumulatiiviset minuutit
          </h2>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">
            Estimoitu · tarkka kierrosdata tulossa
          </span>
        </div>
        <ProgressionChart minutes={minutes} appearances={appearances} />
      </section>

      {/* Vaihtopenkkistatistikka */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">
          Vaihtopenkki
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          <DetailRow label="Aloitti penkiltä" value={`${subBench} kertaa`} />
          <DetailRow label="Tuli vaihtoon" value={`${subIn} kertaa`} />
        </div>
      </section>

      <div className="text-xs text-white/40 pt-1">
        Lähde: API-Football (pelaajatiedot, kuva, tilastot) +
        Veikkausliiga.com (viralliset minuutit, maalit, syötöt
        sukunimi-matchilla)
      </div>
    </div>
  );
}
