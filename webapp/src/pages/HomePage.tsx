import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import {
  getYouthStatsAll,
  getYouthAggregation,
  getOfficialStats,
  filterReliableTeams,
  type YouthStats,
} from '@/services/api';
import { Hero } from '@/components/Hero';
import { WeeklyNarrative } from '@/components/WeeklyNarrative';
import { KPICard } from '@/components/KPICard';
import { WhyMattersSection } from '@/components/WhyMattersSection';
import { TopPlayersCard } from '@/components/TopPlayersCard';

const SEASON = 2026;

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80';

function calcU23Pct(teams: YouthStats[]): number {
  const totalMinutes = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u23Minutes = teams.reduce((s, t) => s + t.youthMinutesU23, 0);
  return totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;
}

interface CtaLinkProps {
  to: string;
  label: string;
}

function CtaLink({ to, label }: CtaLinkProps) {
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

export default function HomePage() {
  const { data, loading, error } = useApi(() => getYouthStatsAll(SEASON), [SEASON]);
  // U23-pelaajat (valmiiksi ikäfiltteröity backendissä) top-listalle — ladataan
  // rinnakkain, etusivu ei jää odottamaan tätä.
  const { data: youthAgg } = useApi(() => getYouthAggregation(SEASON), [SEASON]);
  // Veikkausliiga.com viralliset tilastot — käytetään ENSISIJAISESTI minuutit,
  // koska virallinen lähde on tarkempi kuin API-Football.
  const { data: officialStats } = useApi(() => getOfficialStats(SEASON), [SEASON]);

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

  // Datavaje-suodatin: totalMinutes < 1000 putoaa pois.
  const veikkausliiga = filterReliableTeams(data.veikkausliiga);
  const ykkosliiga = filterReliableTeams(data.ykkosliiga);
  const ykkonen = filterReliableTeams(data.ykkonen);
  const vPct = calcU23Pct(veikkausliiga);
  const ylPct = calcU23Pct(ykkosliiga);
  const yPct = calcU23Pct(ykkonen);

  // Rikasta topYouthPlayers Veikkausliiga.com:n virallisilla minuuteilla.
  // Match: API-Footballin "E. Sukunimi" → sukunimi (viimeinen "." :n jälkeen)
  // → etsi virallisesta listasta jonka name sisältää sukunimen.
  const enrichedPlayers = (youthAgg?.topYouthPlayers ?? []).map((p) => {
    const lastName = p.playerName.split('.').pop()?.trim().toLowerCase() ?? '';
    const official = officialStats?.data?.find((o) =>
      o.name.toLowerCase().includes(lastName),
    );
    return {
      ...p,
      minutesPlayed: official?.minutes ?? p.minutesPlayed,
    };
  });

  return (
    <div className="px-6 py-10 md:py-16 space-y-12">
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

      {/* Viikon narratiivi + KPI-kortit = liigan tilannekuva yhdellä silmäyksellä */}
      <section className="space-y-6">
        <WeeklyNarrative veikkausliiga={veikkausliiga} ykkosliiga={ykkosliiga} />

        {/* HUOM: Sparkline-arvot 2022–2025 ovat placeholderia kunnes historia-data
            tarjoaa todelliset arvot. Viimeinen arvo on tämän hetken laskettu prosentti. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
          <CtaLink to="/peliaika" label="Katso peliaika-analyysi" />
          <CtaLink to="/joukkueet" label="Katso kaikki joukkueet" />
        </div>
      </section>

      {/* Viikon U23-tähdet — sisäinen "Katso kaikki nuoret" -linkki kortissa.
          Minuutit rikastetaan Veikkausliiga.com:n virallisesta datasta
          sukunimi-matchilla; jos vastinetta ei löydy käytetään API-Footballin
          minutesPlayed:tä. */}
      <section className="max-w-2xl">
        <TopPlayersCard players={enrichedPlayers} />
      </section>

      {/* Konteksti — miksi tämä on tärkeää */}
      <WhyMattersSection />
    </div>
  );
}
