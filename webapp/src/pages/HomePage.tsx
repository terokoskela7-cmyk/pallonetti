import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  TrendingUp,
  Target,
  Rocket,
  Loader2,
  Info,
} from 'lucide-react';
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

const SEASON = 2026;

// CIES Football Observatory: Tanskan Superliga johtaa Euroopassa U21-peliajassa.
const CIES_TARGET_PCT = 11.7;
// Tavoiteltava U21-runko Veikkausliigassa (seurannan pohjaluku).
const U21_PLAYER_TARGET = 17;
// Markkina-arvojen yläraja sukunimi-matchille — sama logiikka kuin NuoretPage.
const MAX_REASONABLE_MV = 5_000_000;

// ============================================================
// Apulaskennat
// ============================================================
function calcU21Pct(teams: YouthStats[]): number {
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u21 = teams.reduce((s, t) => s + t.youthMinutesU21, 0);
  return total > 0 ? (u21 / total) * 100 : 0;
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
}

function TrendTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as TrendPoint;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs">
      <div className="text-white/90 font-medium">Kierros {d.round}</div>
      <div className="text-ice tabular">
        {d.pct.toFixed(1)} %
        <span className="text-white/40"> — Tanska: {CIES_TARGET_PCT} %</span>
      </div>
    </div>
  );
}

function U21TrendChart() {
  const { data, loading } = useApi(() => getU21RoundTrend(SEASON), [SEASON]);

  const chartData = useMemo<TrendPoint[]>(
    () => (data ?? []).map((d) => ({ round: d.round, pct: d.u21Pct })),
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

  const maxPct = Math.max(CIES_TARGET_PCT, ...chartData.map((d) => d.pct));

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
            <ReferenceLine
              y={CIES_TARGET_PCT}
              stroke="#f97316"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `CIES-tavoite ${CIES_TARGET_PCT} %`,
                position: 'insideTopLeft',
                fill: '#f97316',
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="pct"
              stroke="#00D4FF"
              strokeWidth={2}
              dot={{ fill: '#00D4FF', r: 2.5 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-white/40 mt-3">
        Toteutunut U21-osuus kierroksittain (sininen) vs. CIES-tavoite{' '}
        {CIES_TARGET_PCT} % (Tanskan Superliga). U21 = syntynyt 2004 tai
        myöhemmin · osuus kaikista pelatuista minuuteista.
      </p>
    </>
  );
}

// ============================================================
// Osio 4 — Tutkimuskortti
// ============================================================
interface ResearchCardProps {
  icon: typeof TrendingUp;
  stat: string;
  title: string;
  source: string;
}

function ResearchCard({ icon: Icon, stat, title, source }: ResearchCardProps) {
  return (
    <div className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-5 flex flex-col">
      <Icon className="w-5 h-5 text-ice mb-3" />
      <div className="text-3xl font-bold font-mono tabular text-aurora leading-none mb-2">
        {stat}
      </div>
      <div className="text-sm text-white/90 leading-snug mb-2">{title}</div>
      <div className="text-xs text-white/45 mt-auto">{source}</div>
    </div>
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

  // U21-kohortti — sama buildU23Players + ikäsuodatus kuin muualla.
  const u21Players = useMemo(() => {
    if (!data) return [];
    return buildU23Players(data.agg.topYouthPlayers, data.official.data)
      .filter((p) => p.age <= 21)
      .sort((a, b) => b.minutes - a.minutes);
  }, [data]);

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
  const u21Pct = calcU21Pct(veikkausliiga);
  const u21Count = veikkausliiga.reduce((s, t) => s + t.youthPlayersU21, 0);
  const u21Missing = Math.max(0, U21_PLAYER_TARGET - u21Count);
  const topU21 = u21Players[0] ?? null;

  // U21 yhteismarkkina-arvo: summaa kohortin pelaajat sukunimi-matchilla.
  const u21TotalMv = u21Players.reduce((sum, p) => {
    const surname = p.playerName.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
    const mv = surname ? marketValueBySurname.get(surname) ?? null : null;
    return mv !== null && mv <= MAX_REASONABLE_MV ? sum + mv : sum;
  }, 0);

  const pctVsTarget = u21Pct - CIES_TARGET_PCT;

  return (
    <div className="px-6 py-10 md:py-16 space-y-14">
      {/* ---------- Osio 1 — Hero ---------- */}
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
        title={
          <>
            Peliaika on <span className="text-aurora font-medium">kaikki</span>
          </>
        }
        subtitle="CIES Football Observatory tutki 50 liigaa: pelaajat jotka saavat riittävästi peliaikaa alle 21-vuotiaina pääsevät huomattavasti todennäköisemmin huipulle. Peliaika ei ole palkinto — se on edellytys."
        height="lg"
      />

      {/* ---------- Osio 2 — Live KPI-kortit ---------- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="U21 peliaika-%"
          value={`${u21Pct.toFixed(1)} %`}
          accent="aurora"
          compare={{
            tone: pctVsTarget >= 0 ? 'aurora' : 'red',
            text:
              pctVsTarget >= 0
                ? `+${pctVsTarget.toFixed(1)} pp yli CIES-tavoitteen (${CIES_TARGET_PCT} %)`
                : `${pctVsTarget.toFixed(1)} pp alle CIES-tavoitteen (${CIES_TARGET_PCT} %)`,
          }}
        />
        <KpiCard
          label="U21 pelaajia"
          value={String(u21Count)}
          accent="ice"
          compare={
            u21Missing > 0
              ? { tone: 'red', text: `${u21Missing} vajaa tavoitteesta ${U21_PLAYER_TARGET}` }
              : { tone: 'aurora', text: `tavoite ${U21_PLAYER_TARGET} saavutettu` }
          }
        />
        <KpiCard
          label="Eniten minuutteja (U21)"
          value={topU21 ? String(topU21.minutes) : '—'}
          accent="ice"
          hint={topU21 ? `${topU21.playerName} · ${topU21.teamName}` : undefined}
        />
        <KpiCard
          label="U21 yhteismarkkina-arvo"
          value={formatMarketValue(u21TotalMv) ?? '—'}
          accent="amber"
          hint={`${u21Players.length} pelaajaa seurannassa`}
        />
      </section>

      {/* ---------- Osio 3 — Kierrostrendi ---------- */}
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

      {/* ---------- Osio 4 — Tutkimus + missio ---------- */}
      <section className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

      <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Veikkausliiga {SEASON}</span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          Lähteet: <span className="text-white/60">API-Football</span> ·{' '}
          <span className="text-white/60">Veikkausliiga.com</span> ·{' '}
          <span className="text-white/60">Transfermarkt</span>
        </span>
      </footer>
    </div>
  );
}
