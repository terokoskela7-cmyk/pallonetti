import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

// CIES Football Observatory: Tanskan Superliga johtaa Euroopassa U21-peliajassa.
const CIES_TARGET_PCT = 11.7;
// Tavoiteltava U21-runko Veikkausliigassa (seurannan pohjaluku).
const U21_PLAYER_TARGET = 17;
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
        {CIES_TARGET_PCT} % (Tanskan Superliga). U21 = syntynyt 2005 tai
        myöhemmin · vain päättyneet ottelut · pelaajat joilla ei ikätietoa
        eivät vaikuta prosenttiin.
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
  const missing = isU21 ? Math.max(0, U21_PLAYER_TARGET - count) : 0;
  const players = isU21 ? u21Players : u23Players;
  const topPlayer = players[0] ?? null;

  const totalMv = players.reduce((sum, p) => {
    const surname = p.playerName.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
    const mv = surname ? marketValueBySurname.get(surname) ?? null : null;
    return mv !== null && mv <= MAX_REASONABLE_MV ? sum + mv : sum;
  }, 0);

  const pctVsTarget = isU21 ? pct - CIES_TARGET_PCT : 0;

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
        subtitle="Seuraa suomalaisten nuorten pelaajien peliaikaa Veikkausliigassa. Yhdistämme API-Footballin, Veikkausliigan viralliset tilastot ja Transfermarktin markkina-arvot yhdeksi näkymäksi."
        height="lg"
      />

      {/* ---------- Osio 2 — Sivuston rakenne ---------- */}
      <section className="space-y-4">
        <div className="text-xs uppercase tracking-wider text-white/40">
          Mistä löydät mitäkin
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <GuideCard
            to="/peliaika"
            icon={BarChart3}
            title="Analyysi"
            body="Joukkueiden U23-%-kaaviot, pelaajataulukko filttereillä ja kehityskäyrät. Syväsukellus dataan."
          />
          <GuideCard
            to="/nuoret"
            icon={Users}
            title="U21-pelaajat"
            body="Alle 21-vuotiaiden spotlight: pelaajakortit, markkina-arvot ja CIES-vertailu."
          />
          <GuideCard
            to="/pelaajat"
            icon={Search}
            title="Kaikki pelaajat"
            body="Hakemisto kaikista Veikkausliigan pelaajista. Hae nimellä tai suodata joukkueella."
          />
          <GuideCard
            to="/about"
            icon={HelpCircle}
            title="Tietoa"
            body="Datalähteet, metodologia, U21/U23-määritelmät ja tekijän yhteystiedot."
          />
        </div>
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
          {isU21 && (
            <span className="text-[11px] text-white/40">
              CIES-tavoite: {CIES_TARGET_PCT}% (Tanskan Superliga)
            </span>
          )}
        </div>

        {/* KPI-kortit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label={`${ageGroup.toUpperCase()} peliaika-%`}
            value={`${pct.toFixed(1)} %`}
            accent="aurora"
            compare={
              isU21
                ? {
                    tone: pctVsTarget >= 0 ? 'aurora' : 'red',
                    text:
                      pctVsTarget >= 0
                        ? `+${pctVsTarget.toFixed(1)} pp yli CIES-tavoitteen (${CIES_TARGET_PCT} %)`
                        : `${pctVsTarget.toFixed(1)} pp alle CIES-tavoitteen (${CIES_TARGET_PCT} %)`,
                  }
                : undefined
            }
          />
          <KpiCard
            label={`${ageGroup.toUpperCase()} pelaajia`}
            value={String(count)}
            accent="ice"
            compare={
              isU21 && missing > 0
                ? { tone: 'red', text: `${missing} vajaa tavoitteesta ${U21_PLAYER_TARGET}` }
                : isU21
                  ? { tone: 'aurora', text: `tavoite ${U21_PLAYER_TARGET} saavutettu` }
                  : undefined
            }
          />
          <KpiCard
            label={`Eniten minuutteja (${ageGroup.toUpperCase()})`}
            value={topPlayer ? String(topPlayer.minutes) : '—'}
            accent="ice"
            hint={topPlayer ? `${topPlayer.playerName} · ${topPlayer.teamName}` : undefined}
          />
          <KpiCard
            label={`${ageGroup.toUpperCase()} yhteismarkkina-arvo`}
            value={formatMarketValue(totalMv) ?? '—'}
            accent="amber"
            hint={`${players.length} pelaajaa seurannassa`}
          />
        </div>
      </section>

      {/* ---------- Osio 4 — Kierrostrendi ---------- */}
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

      {/* ---------- Osio 5 — INFO-accordion + missio ---------- */}
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
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-navy-600 pt-4">
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
