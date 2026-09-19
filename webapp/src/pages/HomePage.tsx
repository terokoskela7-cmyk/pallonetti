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
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import { useApi } from '@/hooks/useApi';
import {
  getKansalaisuudet,
  getYouthStatsAll,
  getYouthAggregation,
  getOfficialStats,
  getU21RoundTrend,
  filterReliableTeams,
  buildU23Players,
  type YouthStats,
} from '@/services/api';
import { useValittuKausi } from '@/hooks/useKausi';
import {
  NUORET_LABEL,
  NUORET_MAX,
  ALLE_21_LABEL,
  NUORET_LABEL_PITKA,
} from '@/constants/ika';
import { pros } from '@/utils/luvut';
import { Hero } from '@/components/Hero';
import { ResearchCard } from '@/components/ResearchCard';

// CIES Football Observatory 2025: Tanskan Superliga, alle 21-vuotiaiden osuus
// peliajasta. Ei tavoite vaan vertailuluku — ja se koskee ALLE 21-vuotiaita,
// ei sivuston 17–21-päämittaria. Vertaa tähän vain alle 21 -lukua.
const CIES_TANSKA_PCT = 11.7;

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
function laskeNuortenOsuus(teams: YouthStats[]): number | null {
  if (teams.length === 0) return null;
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u21 = teams.reduce((s, t) => s + t.minuutitNuoret, 0);
  return total > 0 ? (u21 / total) * 100 : null;
}

/**
 * Alle 21-vuotiaiden osuus (ikä ≤ 20) — ainoa luku jota saa verrata CIES:n
 * kansainväliseen vertailuun. Sivuston päämittari on 17–21, joka on tätä
 * suurempi; niiden sekoittaminen liioittelisi Suomen lukua.
 *
 * Suomen luku on YLÄRAJA: CIES laskee osuuden vain maajoukkuekelpoisista
 * pelaajista, tässä ovat mukana kaikki alle 21-vuotiaat.
 */
function calcAlle21Pct(teams: YouthStats[]): number | null {
  if (teams.length === 0) return null;
  if (teams.some((t) => t.minuutitAlle21 === undefined)) return null;
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const alle21 = teams.reduce((s, t) => s + (t.minuutitAlle21 ?? 0), 0);
  return total > 0 ? (alle21 / total) * 100 : null;
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
  compare?: { text: string; tone: 'red' | 'aurora' | 'neutral' };
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
            compare.tone === 'red'
              ? 'text-red-400'
              : compare.tone === 'neutral'
                ? 'text-white/50'
                : 'text-aurora'
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
        {pros(d.pct)}
      </div>
    </div>
  );
}

function U21TrendChart() {
  const kausi = useValittuKausi();
  const { data, loading } = useApi(() => getU21RoundTrend(kausi), [kausi]);

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

  const maxPct = Math.max(...chartData.map((d) => d.pct));

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
            {/* Ei Tanska-vertailuviivaa: tämä sarja on 17–21-vuotiaiden osuus,
                kun taas CIES:n Tanska-luku koskee alle 21-vuotiaita. Eri
                mittarit samalla akselilla antaisivat väärän kuvan. */}
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
        17–21-vuotiaiden osuus peliajasta kierroksittain · vain päättyneet
        ottelut · pelaajat joilla ei ikätietoa eivät vaikuta prosenttiin.
        Kansainvälinen vertailu tehdään erikseen alle 21-vuotiaiden luvulla,
        joka on tätä pienempi.
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
  const kausi = useValittuKausi();
  const [infoOpen, setInfoOpen] = useState(false);

  // Päädata: kolme sarjaa + U23-aggregaatti + viralliset minuutit.
  const { data, loading, error } = useApi(async () => {
    const [stats, agg, official] = await Promise.all([
      getYouthStatsAll(kausi),
      getYouthAggregation(kausi),
      getOfficialStats(kausi),
    ]);
    return { stats, agg, official };
  }, [kausi]);

  // Kansalaisuustiedot: vain osalla kausista. Epäonnistuminen ei kaada
  // sivua, mutta se ei myöskään saa näyttää nollalta — silloin rivi pysyy
  // nykyisessä "enintään X %" -muodossa.
  const { data: kansalaisuus } = useApi(async () => {
    try {
      return await getKansalaisuudet(kausi);
    } catch (e) {
      console.error('[etusivu] kansalaisuustietojen haku epäonnistui:', e);
      return null;
    }
  }, [kausi]);

  // U23 = kaikki topYouthPlayers (backend suodattaa jo U23:iin).
  const kaikkiNuoret = useMemo(() => {
    if (!data) return [];
    return buildU23Players(data.agg.topYouthPlayers, data.official.data).sort(
      (a, b) => b.minutes - a.minutes,
    );
  }, [data]);

  // U21 = U23:sta ikäsuodatettuna.
  const nuoretPelaajat = useMemo(
    () => kaikkiNuoret.filter((p) => p.age <= NUORET_MAX),
    [kaikkiNuoret],
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

  const pct = laskeNuortenOsuus(veikkausliiga);
  const count: number | null =
    veikkausliiga.length === 0
      ? null
      : veikkausliiga.reduce((s, t) => s + t.pelaajatNuoret, 0);
  const players = nuoretPelaajat;
  const topPlayer = players[0] ?? null;

  // Kansainvälinen vertailu tehdään ALLE 21 -luvulla, ei 17–21-päämittarilla.
  // Puuttuva arvo on null, ei 0 — nolla väittäisi että Suomi on tasan Tanskan
  // tasolla. null renderöidään "ei dataa".
  const alle21Pct = calcAlle21Pct(veikkausliiga);
  const alle21VsTanska: number | null =
    alle21Pct === null ? null : alle21Pct - CIES_TANSKA_PCT;

  // Vertailurivin teksti. Kun kansalaisuusdataa on, Suomen kansalaisille
  // mennyt osuus näytetään erikseen. Se on ALARAJA, joten sanamuoto on
  // "noin" ja luku pyöristetään kokonaisluvuksi — tarkempi esitys
  // väittäisi tarkkuutta jota lähteessä ei ole.
  const suomalaistenOsuus = kansalaisuus?.saatavilla
    ? kansalaisuus.osuusAlle21Suomalaiset ?? null
    : null;
  const vertailuTeksti =
    alle21Pct === null
      ? ALLE_21_LABEL + ': ei dataa'
      : suomalaistenOsuus !== null
        ? ALLE_21_LABEL +
          ': ' +
          pros(alle21Pct) +
          ' · Suomen kansalaisille noin ' +
          pros(Math.round(suomalaistenOsuus), 0) +
          ' · Tanska ' +
          pros(CIES_TANSKA_PCT) +
          ' (CIES 2025)'
        : ALLE_21_LABEL +
          ': enintään ' +
          pros(alle21Pct) +
          ' · Tanska ' +
          pros(CIES_TANSKA_PCT) +
          ' (CIES 2025)';

  return (
    <div className="px-6 py-10 md:py-16 space-y-14">
      {/* ---------- Osio 1 — Hero ---------- */}
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${kausi}`}
        title={
          <>
            Peliaika on <span className="text-aurora font-medium">kaikki</span>
          </>
        }
        subtitle="Seuraa suomalaisten nuorten pelaajien peliaikaa Veikkausliigassa. Lähteenä Veikkausliigan viralliset tilastot."
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
            body="Joukkueiden nuorten osuudet, pelaajataulukko filttereillä ja kehityskäyrät. Syväsukellus dataan."
          />
          <GuideCard
            to="/nuoret"
            icon={Users}
            title="Nuoret"
            body="17–21-vuotiaiden spotlight: pelaajakortit, peliaika ja kansainvälinen vertailu."
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
            body="Datalähteet, metodologia, ikähaarukan määritelmä ja tekijän yhteystiedot."
          />
        </div>
      </section>

      {/* ---------- Osio 3 — KPI-kortit ---------- */}
      <section className="space-y-4">
        {/* KPI-kortit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            label={'Nuorten osuus peliajasta (' + NUORET_LABEL + ')'}
            value={pros(pct)}
            accent="aurora"
            compare={
              // Vertailu Tanskaan tehdään alle 21 -luvulla, ei tämän kortin
              // 17–21-luvulla. Puuttuva arvo → "ei dataa", ei nollaa.
              alle21Pct === null || alle21VsTanska === null
                ? { tone: 'neutral', text: ALLE_21_LABEL + ': ei dataa' }
                : {
                      // Sävy on epäsymmetrinen ja perustuu YLÄRAJAAN. Jos
                      // yläraja jää Tanskan alle, Suomi on varmasti perässä —
                      // punainen. Jos yläraja ylittää Tanskan, siitä EI seuraa
                      // että Suomi olisi edellä: Suomen kansalaisten osuus on
                      // alaraja, ja Tanskan luku jää näiden väliin. Neutraali.
                      tone: alle21VsTanska < 0 ? 'red' : 'neutral',
                      text: vertailuTeksti,
                    }
            }
          />
          <KpiCard
            label={'Nuoria pelaajia (' + NUORET_LABEL + ')'}
            value={count === null ? 'ei dataa' : String(count)}
            accent="ice"
            hint={
              count === null ? undefined : 'peliaikaa saaneet 17–21-vuotiaat'
            }
          />
          <KpiCard
            label={'Eniten minuutteja (' + NUORET_LABEL + ')'}
            value={topPlayer ? String(topPlayer.minutes) : '—'}
            accent="ice"
            hint={topPlayer ? `${topPlayer.playerName} · ${topPlayer.teamName}` : undefined}
          />
        </div>

        <p className="text-[11px] text-white/40 mt-3 max-w-3xl leading-relaxed">
          Sivuston päämittari on {NUORET_LABEL_PITKA} osuus peliajasta.
          Kansainvälinen vertailu tehdään erikseen alle 21-vuotiaiden luvulla,
          joka on pienempi.{' '}
          {suomalaistenOsuus !== null ? (
            <>
              Suomen kansalaisten osuus perustuu Veikkausliigan rekisteriin:
              kaksoiskansalaisuus ei näy siinä, joten luku on alaraja. CIES
              laskee osuuden vain maajoukkuekelpoisista pelaajista.
            </>
          ) : (
            <>
              Suomen luku on yläraja: CIES laskee osuuden vain
              maajoukkuekelpoisista pelaajista, kun taas tässä ovat mukana
              kaikki alle 21-vuotiaat.
            </>
          )}
        </p>
      </section>

      {/* ---------- Osio 4 — Kierrostrendi ---------- */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ice" />
            Nuorten osuus peliajasta (17–21 v) kierroksittain — Veikkausliiga{' '}
            {kausi}
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
        <span>Veikkausliiga {kausi}</span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          Lähde: <span className="text-white/60">Veikkausliiga.com</span>
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
