import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, TrendingUp } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import {
  getOfficialStats,
  getYouthAggregation,
  type OfficialPlayer,
  type PlayerStats,
} from '@/services/api';

const SEASON = 2026;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface PelaajaView {
  name: string;
  team: string;
  age?: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  source: 'official+api' | 'official' | 'api';
}

function buildView(
  slug: string,
  official: OfficialPlayer[],
  topYouth: PlayerStats[],
): PelaajaView | null {
  const officialMatch = official.find((p) => slugify(p.name) === slug);
  const youthMatch = topYouth.find((p) => slugify(p.playerName) === slug);

  if (officialMatch && youthMatch) {
    return {
      name: officialMatch.name,
      team: officialMatch.team || youthMatch.teamName,
      age: youthMatch.age,
      minutes: officialMatch.minutes,
      goals: officialMatch.goals,
      assists: officialMatch.assists,
      yellowCards: officialMatch.yellowCards,
      source: 'official+api',
    };
  }

  if (officialMatch) {
    return {
      name: officialMatch.name,
      team: officialMatch.team,
      age: officialMatch.age,
      minutes: officialMatch.minutes,
      goals: officialMatch.goals,
      assists: officialMatch.assists,
      yellowCards: officialMatch.yellowCards,
      source: 'official',
    };
  }

  if (youthMatch) {
    return {
      name: youthMatch.playerName,
      team: youthMatch.teamName,
      age: youthMatch.age,
      minutes: youthMatch.minutesPlayed,
      goals: youthMatch.goals,
      assists: youthMatch.assists,
      yellowCards: youthMatch.yellowCards,
      source: 'api',
    };
  }

  return null;
}

function LoadingState() {
  return (
    <div className="px-6 py-16 max-w-3xl mx-auto animate-pulse space-y-6">
      <div className="h-8 bg-navy-700/30 rounded w-32" />
      <div className="h-24 bg-navy-700/30 rounded-xl" />
      <div className="h-32 bg-navy-700/30 rounded-xl" />
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

interface StatProps {
  label: string;
  value: number | string;
  accent?: 'ice' | 'aurora' | 'white';
}

function Stat({ label, value, accent = 'white' }: StatProps) {
  const color =
    accent === 'ice'
      ? 'text-ice'
      : accent === 'aurora'
        ? 'text-aurora'
        : 'text-white/90';
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono tabular ${color}`}>
        {value}
      </div>
    </div>
  );
}

export default function PelaajaPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';

  const { data, loading, error } = useApi(
    async () => {
      const [official, agg] = await Promise.all([
        getOfficialStats(SEASON),
        getYouthAggregation(SEASON),
      ]);
      return { official: official.data, topYouth: agg.topYouthPlayers };
    },
    [SEASON],
  );

  const view = useMemo(() => {
    if (!data || !slug) return null;
    return buildView(slug, data.official, data.topYouth);
  }, [data, slug]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <Info className="w-10 h-10 text-red-400/80 mx-auto mb-4" />
        <div className="text-white/90 font-medium mb-2">
          Datan lataus epäonnistui
        </div>
        <div className="text-sm text-white/60">{error}</div>
      </div>
    );
  }

  if (!view) return <NotFoundState slug={slug} />;

  const tp = view.goals + view.assists;

  return (
    <div className="px-6 py-10 md:py-14 max-w-3xl mx-auto space-y-8">
      {/* Takaisin-linkit */}
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
      </div>

      {/* Otsikko */}
      <header className="space-y-3 border-b border-navy-700 pb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ice font-medium">
          Veikkausliiga · Kausi {SEASON}
        </div>
        <h1 className="text-3xl md:text-4xl font-light tracking-tight leading-tight">
          {view.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
          <span>{view.team}</span>
          {view.age !== undefined && (
            <>
              <span className="text-white/20">·</span>
              <span>{view.age} v</span>
            </>
          )}
        </div>
      </header>

      {/* Kauden tilastot */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-white/40">
          Kauden tilastot
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Min" value={view.minutes} accent="ice" />
          <Stat label="M" value={view.goals} />
          <Stat label="S" value={view.assists} />
          <Stat label="TP" value={tp} accent="aurora" />
          <Stat label="KK" value={view.yellowCards} />
        </div>
      </section>

      {/* Placeholder kehityskäyrälle */}
      <section className="rounded-xl border border-dashed border-navy-600 bg-navy-700/30 p-8 text-center space-y-2">
        <TrendingUp className="w-6 h-6 text-white/30 mx-auto" />
        <div className="text-sm font-medium text-white/70">
          Kehityskäyrä — tulossa
        </div>
        <div className="text-xs text-white/40 max-w-md mx-auto">
          Kauden aikana kerätty otteluittainen kehitys: minuutit, tehopisteet ja
          xG/xA-trendi. Vaatii historiadataa, joka kerätään seuraavalla sprintillä.
        </div>
      </section>

      {/* Lähde */}
      <div className="text-xs text-white/40 pt-2">
        Lähde:{' '}
        {view.source === 'official+api'
          ? 'Veikkausliiga.com (minuutit, maalit, syötöt) + API-Football (ikä)'
          : view.source === 'official'
            ? 'Veikkausliiga.com'
            : 'API-Football'}
      </div>
    </div>
  );
}
