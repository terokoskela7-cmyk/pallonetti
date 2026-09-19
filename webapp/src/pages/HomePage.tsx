import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  TrendingUp,
  Target,
  Rocket,
  Loader2,
  Info,
  BarChart3,
  Users,
  Search,
  HelpCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import {
  staggerContainer,
  staggerItem,
  FadeIn,
} from '@/components/animations';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
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
  getTransfermarktLeague,
  getU21RoundTrend,
  filterReliableTeams,
  buildU23Players,
  formatMarketValue,
  type YouthStats,
} from '@/services/api';
import { Hero } from '@/components/Hero';
import { ResearchCard } from '@/components/ResearchCard';

const SEASON = 2026;

// Pohjoismaiset U21-peliaika-% (CIES ja avoimet lähteet).
// Kilpailemme näitä maita vastaan samoista pelaajista ja scout-huomiosta.
const NORDIC = {
  denmark: 11.7,   // CIES 2026
  norway: 20.2,    // CIES / Eliteserien
  sweden: 22.4,    // CIES / Allsvenskan
};
const NORDIC_AVG = (NORDIC.denmark + NORDIC.norway + NORDIC.sweden) / 3;
// Markkina-arvojen yläraja sukunimi-matchille — sama logiikka kuin NuoretPage.
const MAX_REASONABLE_MV = 5_000_000;

// ============================================================
// Sivuston rakenne — opastaa käyttäjää
// ============================================================
interface GuideCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

function GuideCard({ to, icon: Icon, title, body }: GuideCardProps) {
  return (
    <Link
      to={to}
      className="bg-navy-700 border border-navy-600 rounded-lg p-4 hover:border-ice/40 transition-colors group"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
        <Icon className="w-4 h-4 text-ice" />
        {title}
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{body}</p>
      <div className="mt-2 text-xs text-ice opacity-0 group-hover:opacity-100 transition-opacity">
        Avaa sivu →
      </div>
    </Link>
  );
}

// ============================================================
// Apulaskennat
// ============================================================
function calcU21Pct(teams: YouthStats[]): number {
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u21 = teams.reduce((s, t) => s + t.youthMinutesU21, 0);
  return total > 0 ? (u21 / total) * 100 : 0;
}

function calcU23Pct(teams: YouthStats[]): number {
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u23 = teams.reduce((s, t) => s + t.youthMinutesU23, 0);
  return total > 0 ? (u23 / total) * 100 : 0;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'juuri nyt';
  if (min < 60) return `${min} min sitten`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} t sitten`;
  const d = Math.floor(h / 24);
  return `${d} pv sitten`;
}

// ============================================================
// Osio 2 — KPI-kortti
// ============================================================
interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  compare?: { text: string; tone: 'red' | 'aurora' };
  accent?: 'aurora' | 'ice' | 'amber' | 'white';
}

function KpiCard({ label, value, hint, compare, accent = 'white' }: KpiCardProps) {
  const color =
    accent === 'aurora'
      ? 'text-aurora'
      : accent === 'ice'
        ? 'text-ice'
        : accent === 'amber'
          ? 'text-amber-400'
          : 'text-white/90';
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-4 flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
        {label}
      </div>
      <div className={`text-3xl font-bold font-mono tabular leading-none ${color}`}>
        {value}
      </div>
      {compare && (
        <div
          className={`text-xs font-medium mt-2 ${
            compare.tone === 'red' ? 'text-red-400' : 'text-aurora'
          }`}
        >
          {compare.text}
        </div>
      )}
      {hint && (
        <div className="text-xs text-white/50 mt-2 leading-tight truncate">
          {hint}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Osio 3 — Kierroskohtainen U21 %-trendikaavio
//
// Data tulee backendin /api/u21-round-trend/:season -endpointista, joka
// laskee aidon liigatason U21-osuuden kierroksittain (U21-pelaajien minuutit
// / kaikki pelatut minuutit, päättyneistä otteluista). Tyhjätila jos endpoint
// ei vastaa tai dataa ei vielä ole.
// ============================================================
interface TrendPoint {
  round: number;
  pct: number;
  matches?: number;
  u21Mins?: number;
  totalMins?: number;
  completeness?: number;
  estimatedRatio?: number;
}

function TrendTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as TrendPoint;
  const isEstimated = (d.estimatedRatio ?? 0) > 0;
  const isIncomplete = (d.completeness ?? 100) < 100 && !isEstimated;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs space-y-0.5">
      <div className="text-white/90 font-medium">Kierros {d.round}</div>
      <div className="text-ice tabular">
        {d.pct.toFixed(1)} % (Suomi)
        {isEstimated && (
          <span className="text-amber-400 ml-1">∼ estimoitu</span>
        )}
      </div>
      {typeof d.matches === 'number' && (
        <div className="text-white/50 text-[10px]">
          {d.matches} ottelu{d.matches !== 1 ? 'a' : ''} päättynyt
          {isEstimated && d.estimatedRatio !== undefined && (
            <span className="text-amber-400/80"> · {d.estimatedRatio.toFixed(0)} % estimoitu</span>
          )}
          {isIncomplete && d.completeness !== undefined && (
            <span className="text-amber-400/80"> · data {d.completeness.toFixed(0)} %</span>
          )}
        </div>
      )}
      {typeof d.u21Mins === 'number' && typeof d.totalMins === 'number' && (
        <div className="text-white/40 text-[10px]">
          {d.u21Mins.toLocaleString('fi-FI')} min / {d.totalMins.toLocaleString('fi-FI')} min
        </div>
      )}
      {isEstimated && (
        <div className="text-amber-400/70 text-[10px] leading-tight">
          Perustuu joukkueiden kauden keskiarvoihin — API-Footballilta puuttuu pelaajatietoja
        </div>
      )}
    </div>
  );
}

function U21TrendChart() {
  // Force refresh to recalculate with fixed parseRound (was matching Cup rounds)
  const { data, loading } = useApi(() => getU21RoundTrend(SEASON, true), [SEASON]);

  const chartData = useMemo<TrendPoint[]>(
    () =>
      (data ?? []).map((d) => ({
        round: d.round,
        pct: d.u21Pct,
        matches: d.matches,
        u21Mins: d.u21Mins,
        totalMins: d.totalMins,
        completeness: d.completeness,
        estimatedRatio: d.estimatedRatio,
      })),
    [data],
  );

  if (loading) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 text-ice animate-spin" />
        <span className="text-sm text-white/50">Lasketaan kierrosdataa…</span>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 text-center">
        <Info className="w-6 h-6 text-white/30" />
        <span className="text-sm text-white/50">
          Kierroskohtaista dataa ei vielä saatavilla tälle kaudelle.
        </span>
      </div>
    );
  }

  const maxPct = Math.max(NORDIC.sweden, ...chartData.map((d) => d.pct));

  return (
    <>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke="#1a2640" strokeDasharray="2 4" />
            <XAxis
              dataKey="round"
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={{ stroke: '#243350' }}
              label={{
                value: 'Kierros',
                position: 'insideBottomRight',
                offset: -4,
                fill: '#5b6b82',
                fontSize: 11,
              }}
            />
            <YAxis
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={false}
              unit=" %"
              domain={[0, Math.ceil(maxPct + 2)]}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: '#00D4FF', strokeOpacity: 0.3 }}
            />
            {/* Ruotsi — korkein pohjoismainen */}
            <ReferenceLine
              y={NORDIC.sweden}
              stroke="#eab308"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Ruotsi ${NORDIC.sweden} %`,
                position: 'insideTopRight',
                fill: '#eab308',
                fontSize: 10,
              }}
            />
            {/* Norja */}
            <ReferenceLine
              y={NORDIC.norway}
              stroke="#a78bfa"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Norja ${NORDIC.norway} %`,
                position: 'insideTopRight',
                fill: '#a78bfa',
                fontSize: 10,
              }}
            />
            {/* Tanska */}
            <ReferenceLine
              y={NORDIC.denmark}
              stroke="#f97316"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Tanska ${NORDIC.denmark} %`,
                position: 'insideTopLeft',
                fill: '#f97316',
                fontSize: 10,
              }}
            />
            {/* scatter-tyylinen: pisteet selkeästi erillään, viiva ohut ja katkoviiva.
                - Täysi data: täytetty syaani piste
                - Estimoitu data (>50% estimoitu): oranssi piste
                - Osittainen data: tyhjä syaani piste */}
            <Line
              type="linear"
              dataKey="pct"
              stroke="#00D4FF"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={(props: Record<string, unknown>) => {
                const { cx, cy, payload } = props;
                const pt = payload as TrendPoint;
                const estRatio = pt.estimatedRatio ?? 0;
                const isEstimated = estRatio >= 50;
                const isIncomplete = !isEstimated && (pt.completeness ?? 100) < 100;
                const color = isEstimated ? '#f59e0b' : '#00D4FF';
                return (
                  <g>
                    <circle
                      cx={cx as number}
                      cy={cy as number}
                      r={4}
                      fill={isIncomplete ? 'transparent' : color}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  </g>
                );
              }}
              activeDot={{ r: 6, fill: '#fff' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data-laatuilmoitus */}
      {chartData.some((d) => (d.estimatedRatio ?? 0) > 0) && (
        <div className="mb-3 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300/80 leading-snug">
          <strong>Huom:</strong> API-Footballin Veikkausliiga-data viivästyy 1–2 viikkoa.
          Viimeisimmät kierrokset ({chartData.filter((d) => (d.estimatedRatio ?? 0) > 0).map((d) => d.round).join(', ')}){' '}
          on estimoitu joukkueiden kauden keskiarvolla. Trendi päivittyy automaattisesti kun API saa päivitetyn datan.
        </div>
      )}

      <p className="text-[11px] text-white/40 mt-3">
        <strong className="text-white/60">Jokainen piste on yhden kierroksen U21-%</strong> —
        ei ennuste.{' '}
        {chartData.length > 0 && (
          <>
            API-Footballin mukaan pelattu{' '}
            <span className="text-ice font-medium tabular">{chartData.length}</span> kierrosta{' '}
            ({chartData.reduce((s, d) => s + (d.matches ?? 0), 0)} ottelua).
            {chartData.some((d) => (d.estimatedRatio ?? 0) >= 50) && (
              <>{' '}
                <span className="text-amber-400/80">Oranssit = estimoitu keskiarvolla.</span>
              </>
            )}
          </>
        )}{' '}
        Pohjoismaiset vertailut: Ruotsi {NORDIC.sweden} % · Norja{' '}
        {NORDIC.norway} % · Tanska {NORDIC.denmark} %. U21 = syntynyt{' '}
        {SEASON - 21} tai myöhemmin.
      </p>
    </>
  );
}

// ============================================================
// Sivu
// ============================================================
function CtaLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-ice hover:text-white transition-colors font-medium group"
    >
      {label}
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const MISSIONS = [
  'Teemme nuorten pelaajien peliajan näkyväksi',
  'Autamme seuroja tunnistamaan kehityskohteensa',
  'Rakennamme siltoja nuorten pelaajien ja heidän seuraavan askeleensa välille',
];

export default function HomePage() {
  const [ageGroup, setAgeGroup] = useState<'u21' | 'u23'>('u21');
  const [infoOpen, setInfoOpen] = useState(false);

  // Päädata: kolme sarjaa + U23-aggregaatti + viralliset minuutit.
  const { data, loading, error } = useApi(async () => {
    const [stats, agg, official] = await Promise.all([
      getYouthStatsAll(SEASON),
      getYouthAggregation(SEASON),
      getOfficialStats(SEASON),
    ]);
    return { stats, agg, official };
  }, [SEASON]);

  // Markkina-arvot rinnakkain — sivu ei jää odottamaan.
  const { data: tmEntries } = useApi(async () => {
    try {
      return await getTransfermarktLeague(SEASON);
    } catch {
      return [] as Awaited<ReturnType<typeof getTransfermarktLeague>>;
    }
  }, [SEASON]);

  // Sukunimi → markkina-arvo (sama logiikka kuin NuoretPage).
  const marketValueBySurname = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of tmEntries ?? []) {
      if (e.marketValue === null || e.marketValue === undefined) continue;
      const surname = e.name.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
      if (!surname) continue;
      const existing = map.get(surname);
      if (existing === undefined || e.marketValue > existing) {
        map.set(surname, e.marketValue);
      }
    }
    return map;
  }, [tmEntries]);

  // U23 = kaikki topYouthPlayers (backend suodattaa jo U23:iin).
  const u23Players = useMemo(() => {
    if (!data) return [];
    return buildU23Players(data.agg.topYouthPlayers, data.official.data).sort(
      (a, b) => b.minutes - a.minutes,
    );
  }, [data]);

  // U21 = U23:sta ikäsuodatettuna.
  const u21Players = useMemo(
    () => u23Players.filter((p) => p.age <= 21),
    [u23Players],
  );

  if (loading) {
    return (
      <div className="px-6 py-20">
        <div className="text-white/40 text-sm">Ladataan kauden tilastoja…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-20">
        <div className="text-red-400/90 text-sm">
          Datan lataus epäonnistui{error ? `: ${error}` : ''}.
        </div>
      </div>
    );
  }

  const veikkausliiga = filterReliableTeams(data.stats.veikkausliiga);
  const isU21 = ageGroup === 'u21';

  // Laskelmat ikäryhmän mukaan
  const pct = isU21 ? calcU21Pct(veikkausliiga) : calcU23Pct(veikkausliiga);
  const count = isU21
    ? veikkausliiga.reduce((s, t) => s + t.youthPlayersU21, 0)
    : veikkausliiga.reduce((s, t) => s + t.youthPlayersU23, 0);
  const players = isU21 ? u21Players : u23Players;
  const topPlayer = players[0] ?? null;

  // Kesken kauden realistiset laskelmat (ei 1 500 min täyskausitavoitetta)
  const avgU21Min =
    players.length > 0
      ? Math.round(players.reduce((s, p) => s + p.minutes, 0) / players.length)
      : 0;
  const above500 = isU21 ? players.filter((p) => p.minutes >= 500).length : 0;

  const tmIndexedCount = isU21
    ? players.filter((p) => {
        const surname = p.playerName.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
        const mv = surname ? marketValueBySurname.get(surname) ?? null : null;
        return mv !== null && mv <= MAX_REASONABLE_MV;
      }).length
    : 0;

  const totalMv = players.reduce((sum, p) => {
    const surname = p.playerName.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
    const mv = surname ? marketValueBySurname.get(surname) ?? null : null;
    return mv !== null && mv <= MAX_REASONABLE_MV ? sum + mv : sum;
  }, 0);

  const pctVsNordic = isU21 ? pct - NORDIC_AVG : 0;

  // U21-%:n selitys — mistä luku tulee
  const totalU21Minutes = isU21
    ? veikkausliiga.reduce((s, t) => s + t.youthMinutesU21, 0)
    : 0;
  const totalAllMinutes = isU21
    ? veikkausliiga.reduce((s, t) => s + t.totalMinutes, 0)
    : 0;

  return (
    <div className="px-6 py-10 md:py-16 space-y-14">
      {/* ---------- Osio 1 — Hero ---------- */}
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
        title={
          <>
            Peliaika on seuran paras sijoitus.{" "}
            <span className="text-aurora font-medium">Mutta vain jos se näkyy.</span>
          </>
        }
        subtitle="Seurantatyökalu, joka laskee jokaisen alle 21-vuotiaan peliminuutit Veikkausliigassa ja vertaa niitä Pohjoismaiden kärkeen."
        height="lg"
      />

      {/* ---------- Osio 1b — Miksi, kenelle, mikä tekee erilaisen ---------- */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem}>
          <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 h-full">
            <div className="text-xs uppercase tracking-wider text-ice mb-2">
              Miksi
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              CIES:n tutkimus 50 liigasta sanoo suoraan: alle 21-vuotias tarvitsee
              1 500 minuuttia kaudessa siirtyäkseen ulkomaille. Suomessa tätä ei
              tapahdu tarpeeksi — mutta kukaan ei ole aiemmin laskenut tarkasti,
              keille se tapahtuu ja keille ei.
            </p>
          </div>
        </motion.div>
        <motion.div variants={staggerItem}>
          <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 h-full">
            <div className="text-xs uppercase tracking-wider text-ice mb-2">
              Kenelle
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Seuroille, jotka haluavat näyttää scoutille konkreettista dataa.
              Scouteille, jotka etsivät seuraavaa lupausta. Faneille, jotka haluavat
              tietää, ketä kannattaa seurata.
            </p>
          </div>
        </motion.div>
        <motion.div variants={staggerItem}>
          <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 h-full">
            <div className="text-xs uppercase tracking-wider text-ice mb-2">
              Mikä tekee erilaisen
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Faktaa "nuorten kehittämisestä". Numeroita. Peliminuutteja.
              Markkina-arvoja. Sopimusten päättymisiä. Ja vertailun siihen,
              mitä Tanskassa ja Norjassa tapahtuu samalla hetkellä.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* ---------- Osio 2 — Sivuston rakenne ---------- */}
      <section className="space-y-4">
        <div className="text-xs uppercase tracking-wider text-white/40">
          Mistä löydät mitäkin
        </div>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem}>
            <GuideCard
              to="/peliaika"
              icon={BarChart3}
              title="Analyysi"
              body="Joukkueiden peliaika-% -kaaviot, pelaajataulukko filttereillä ja kehityskäyrät. U21-painotus scout-näkökulmasta."
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <GuideCard
              to="/nuoret"
              icon={Users}
              title="U21-pelaajat"
              body="Alle 21-vuotiaiden spotlight: pelaajakortit, markkina-arvot ja CIES-vertailu."
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <GuideCard
              to="/pelaajat"
              icon={Search}
              title="Kaikki pelaajat"
              body="Hakemisto kaikista Veikkausliigan pelaajista. Hae nimellä tai suodata joukkueella."
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <GuideCard
              to="/about"
              icon={HelpCircle}
              title="Tietoa"
              body="Datalähteet, metodologia, U21/U23-määritelmät ja tekijän yhteystiedot."
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ---------- Osio 3 — Ikäryhmä-valitsin + KPI ---------- */}
      <section className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-white/40">
            Ikäryhmä
          </span>
          <div className="inline-flex bg-navy-700 border border-navy-600 rounded-md overflow-hidden">
            <button
              onClick={() => setAgeGroup('u21')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                isU21
                  ? 'bg-ice/15 text-ice'
                  : 'text-white/60 hover:text-white hover:bg-navy-600'
              }`}
            >
              U21
            </button>
            <button
              onClick={() => setAgeGroup('u23')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                !isU21
                  ? 'bg-ice/15 text-ice'
                  : 'text-white/60 hover:text-white hover:bg-navy-600'
              }`}
            >
              U23
            </button>
          </div>
          <span className="text-[11px] text-white/40">
            {isU21
              ? `Pohjoismainen keskiarvo: ${NORDIC_AVG.toFixed(1)}% · kilpailemme Tanskaa, Norjaa ja Ruotsia vastaan`
              : 'U23 on hyödyllinen vertailu, mutta scoutien fokus on U21'}
          </span>
        </div>

        {/* KPI-kortit */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem}>
            <KpiCard
              label={`${ageGroup.toUpperCase()} peliaika-%`}
              value={`${pct.toFixed(1)} %`}
              accent="aurora"
              compare={
                isU21
                  ? {
                      tone: pctVsNordic >= 0 ? 'aurora' : 'red',
                      text:
                        pctVsNordic >= 0
                          ? `+${pctVsNordic.toFixed(1)} pp yli pohjoismaisen keskiarvon (${NORDIC_AVG.toFixed(1)} %)`
                          : `${pctVsNordic.toFixed(1)} pp alle pohjoismaisen keskiarvon (${NORDIC_AVG.toFixed(1)} %)`,
                    }
                  : undefined
              }
              hint={
                isU21
                  ? `${totalU21Minutes.toLocaleString('fi-FI')} U21-min / ${totalAllMinutes.toLocaleString('fi-FI')} kaikki min`
                  : undefined
              }
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <KpiCard
              label={`${ageGroup.toUpperCase()} pelaajia`}
              value={String(count)}
              accent="ice"
              compare={
                isU21
                  ? {
                      tone: above500 > 0 ? 'aurora' : 'red',
                      text: `${above500} pelaajaa ≥500 min (kausi käynnissä)`,
                    }
                  : undefined
              }
              hint={
                isU21
                  ? `Keskiarvo ${avgU21Min} min / pelaaja ≈ ${(avgU21Min / 90).toFixed(1)} täyttä peliä`
                  : undefined
              }
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <KpiCard
              label={`Eniten minuutteja (${ageGroup.toUpperCase()})`}
              value={topPlayer ? String(topPlayer.minutes) : '—'}
              accent="ice"
              hint={
                topPlayer
                  ? `${topPlayer.playerName} · ${topPlayer.teamName} · ≈${Math.round(topPlayer.minutes / 90)} täyttä peliä`
                  : undefined
              }
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <KpiCard
              label={`${ageGroup.toUpperCase()} yhteismarkkina-arvo`}
              value={formatMarketValue(totalMv) ?? '—'}
              accent="amber"
              hint={
                isU21
                  ? `${tmIndexedCount}/${players.length} TM-indeksoitu`
                  : `${players.length} pelaajaa seurannassa`
              }
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ---------- Osio 4 — Kierrostrendi ---------- */}
      <FadeIn y={20}>
        <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ice" />
              U21 peliaika-% kierroksittain — Veikkausliiga {SEASON}
            </h2>
          </div>
          <U21TrendChart />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 pt-4 border-t border-navy-600">
            <CtaLink to="/peliaika" label="Katso peliaika-analyysi" />
            <CtaLink to="/nuoret" label="Katso kaikki nuoret pelaajat" />
          </div>
        </section>
      </FadeIn>

      {/* ---------- Osio 5 — INFO-accordion + missio ---------- */}
      <FadeIn y={20} delay={0.1}>
        <section className="space-y-8">
          <div className="bg-navy-700/40 border border-navy-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setInfoOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-navy-700/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-ice shrink-0" />
                <span className="text-sm font-medium text-white/90">
                  Miksi peliaika ratkaisee? — Tutkimusta, tilastoja ja Pohjoismaista kontekstia
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
                  infoOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {infoOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-navy-600 pt-4"
              >
                <ResearchCard
                  icon={TrendingUp}
                  stat="r = 0.77"
                  title="Peliajan ja huipulle pääsyn korrelaatio nuorilla pelaajilla"
                  source="Stirr et al., University of Antwerp"
                />
                <ResearchCard
                  icon={Target}
                  stat="11,7 %"
                  title="Tanskan Superliga — Euroopan kärki U21-peliajassa"
                  source="CIES Football Observatory 2026"
                />
                <ResearchCard
                  icon={Rocket}
                  stat="40×"
                  title="Red Bull -mallin sijoitetun pääoman tuotto nuoriin pelaajiin"
                  source="Keita · Haaland · Šeško"
                />
              </motion.div>
            )}
          </div>

          <div className="space-y-3">
            {MISSIONS.map((m, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-ice font-mono text-sm mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-lg text-white/85 font-light leading-snug">{m}</p>
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Veikkausliiga {SEASON}</span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          Lähteet: <span className="text-white/60">API-Football</span> ·{' '}
          <span className="text-white/60">Veikkausliiga.com</span> ·{' '}
          <span className="text-white/60">Transfermarkt</span>
        </span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          päivitetty{' '}
          <span className="text-white/60">
            {formatRelativeTime(data.agg.updatedAt)}
          </span>
        </span>
      </footer>
    </div>
  );
}
