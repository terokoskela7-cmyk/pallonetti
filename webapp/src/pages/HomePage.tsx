import { useApi } from '@/hooks/useApi';
import {
  getYouthStatsAll,
  getOfficialStats,
  type YouthStats,
} from '@/services/api';
import { Hero } from '@/components/Hero';
import { WeeklyNarrative } from '@/components/WeeklyNarrative';
import { KPICard } from '@/components/KPICard';
import { AgeDistributionChart } from '@/components/AgeDistributionChart';
import { InsightBar } from '@/components/InsightBar';
import { LeagueSection } from '@/components/LeagueSection';
import { WhyMattersSection } from '@/components/WhyMattersSection';
import { TopPlayersCard } from '@/components/TopPlayersCard';

const SEASON = 2026;

// Hero-tausta. Vaihda URL halutessasi (Unsplash, Pexels, oma kuva).
// Tällä hetkellä iltavalaistu jalkapallokenttä Unsplashista.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80';

function calcU23Pct(teams: YouthStats[]): number {
  const totalMinutes = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u23Minutes = teams.reduce((s, t) => s + t.youthMinutesU23, 0);
  return totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;
}

const leagueLinks = [
  { href: '#veikkausliiga', label: 'Veikkausliiga' },
  { href: '#ykkosliiga', label: 'Ykkösliiga' },
  { href: '#ykkonen', label: 'Ykkönen' },
];

export default function HomePage() {
  const { data, loading, error } = useApi(() => getYouthStatsAll(SEASON), [SEASON]);
  // Virallinen Veikkausliiga.com-data top-listalle — ladataan rinnakkain,
  // sivu ei jää odottamaan tätä.
  const { data: officialData } = useApi(() => getOfficialStats(SEASON), [SEASON]);

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

  const { veikkausliiga, ykkosliiga, ykkonen } = data;
  const vPct = calcU23Pct(veikkausliiga);
  const ylPct = calcU23Pct(ykkosliiga);
  const yPct = calcU23Pct(ykkonen);

  return (
    <div className="px-6 py-10 md:py-16 space-y-12">
      {/* 0. Hero-kuva */}
      <Hero
        eyebrow={`Suomalaisen jalkapallon U23 · Kausi ${SEASON}`}
        title={
          <>
            Nuorten peliaika{' '}
            <span className="text-aurora font-medium">näkyväksi</span>
          </>
        }
        subtitle="Pallonetti.fi seuraa kuinka paljon alle 23-vuotiaat suomalaispelaajat saavat minuutteja Veikkausliigassa, Ykkösliigassa ja Ykkösessä."
        backgroundImage={HERO_IMAGE}
        imageAlt="Jalkapallokenttä iltavalossa"
        height="lg"
      />

      {/* 1. Viikon narratiivi */}
      <section>
        <WeeklyNarrative veikkausliiga={veikkausliiga} ykkosliiga={ykkosliiga} />
      </section>

      {/* 2. KPI-kortit — vain sarjoille joista on pelaajadataa */}
      {/* HUOM: Sparkline-arvot 2022-2025 ovat placeholderia kunnes TASO-data
          tarjoaa historian. Viimeinen arvo on tämän hetken laskettu prosentti. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {veikkausliiga.length > 0 && (
          <KPICard
            label="Veikkausliiga U23"
            value={vPct.toFixed(1)}
            suffix="%"
            accent="aurora"
            sparkline={[15, 17, 19, 22, vPct]}
            trendLabel="vs 2025"
          />
        )}
        {ykkosliiga.length > 0 && (
          <KPICard
            label="Ykkösliiga U23"
            value={ylPct.toFixed(1)}
            suffix="%"
            accent="ice"
            sparkline={[12, 14, 15, 17, ylPct]}
            trendLabel="vs 2025"
          />
        )}
        {ykkonen.length > 0 && (
          <KPICard
            label="Ykkönen U23"
            value={yPct.toFixed(1)}
            suffix="%"
            accent="ice"
            sparkline={[13, 15, 17, 19, yPct]}
            trendLabel="vs 2025"
          />
        )}
        <KPICard
          label="Sarjat seurannassa"
          value={3}
          accent="white"
          sparkline={[1, 1, 1, 2, 3]}
          neutralTrendText="Laajenee myöhemmin"
        />
      </section>

      {/* 3a. Ikäjakauma-kaavio — Veikkausliiga */}
      {veikkausliiga.length > 0 && (
        <section>
          <div style={{ width: '100%', height: '320px' }}>
            <AgeDistributionChart teams={veikkausliiga} />
          </div>
        </section>
      )}

      {/* 3b. InsightBar — narratiiviset löydökset Veikkausliigasta */}
      {veikkausliiga.length > 0 && (
        <section>
          <InsightBar teams={veikkausliiga} />
        </section>
      )}

      {/* 4. Ankkurinavigaatio sarjojen välillä */}
      <nav className="flex items-center gap-1 text-sm border-b border-navy-700 -mx-6 px-6 pb-3 overflow-x-auto">
        {leagueLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-md text-white/70 hover:text-ice hover:bg-navy-700/40 transition-colors whitespace-nowrap"
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* 4. Sarjat — yksi LeagueSection per sarja */}
      <LeagueSection
        id="veikkausliiga"
        title="Veikkausliiga"
        season={SEASON}
        teams={veikkausliiga}
      />

      <LeagueSection
        id="ykkosliiga"
        title="Ykkösliiga"
        season={SEASON}
        teams={ykkosliiga}
      />

      <LeagueSection
        id="ykkonen"
        title="Ykkönen"
        season={SEASON}
        teams={ykkonen}
      />

      {/* 5. Miksi tämä on tärkeää — tutkimusdataan pohjautuva motivaatio */}
      <WhyMattersSection />

      {/* 6. Top 5 pelaajaa — Veikkausliiga.com viralliset tilastot */}
      <section className="max-w-2xl">
        <TopPlayersCard players={officialData?.data ?? []} />
      </section>
    </div>
  );
}
