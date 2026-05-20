import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, TrendingUp, ExternalLink } from 'lucide-react';
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

interface PlayerView {
  playerName: string;
  teamName: string;
  age?: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  rating?: number;
  appearances: number;
  starts: number;
  passAccuracy: number;
  tackles: number;
}

function findPlayer(
  slug: string,
  topYouth: PlayerStats[],
  official: OfficialPlayer[],
): PlayerView | null {
  const youthMatch = topYouth.find((p) => slugify(p.playerName) === slug);
  if (!youthMatch) return null;

  // Viralliset minuutit sukunimi-matchilla
  const surname = getSurnameKey(youthMatch.playerName);
  const officialMatch = surname
    ? official.find((o) => o.name.toLowerCase().includes(surname))
    : undefined;

  return {
    playerName: youthMatch.playerName,
    teamName: youthMatch.teamName,
    age: youthMatch.age,
    minutes: officialMatch?.minutes ?? youthMatch.minutesPlayed,
    goals: officialMatch?.goals ?? youthMatch.goals,
    assists: officialMatch?.assists ?? youthMatch.assists,
    yellowCards: officialMatch?.yellowCards ?? youthMatch.yellowCards,
    rating: youthMatch.rating,
    appearances: youthMatch.appearances,
    starts: youthMatch.starts,
    passAccuracy: youthMatch.passAccuracy,
    tackles: youthMatch.tackles,
  };
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
      <div className={`text-xl md:text-2xl font-bold font-mono tabular leading-none ${color}`}>
        {value}
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  hint?: string;
}

function DetailRow({ label, value, hint }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-navy-700 last:border-b-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm text-white/90 font-mono tabular">
        {value}
        {hint && <span className="text-white/40 ml-1">{hint}</span>}
      </span>
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

  const player = useMemo(() => {
    if (!data || !slug) return null;
    return findPlayer(slug, data.topYouth, data.official);
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

  if (!player) return <NotFoundState slug={slug} />;

  const tp = player.goals + player.assists;
  const ratingDisplay =
    player.rating !== undefined && player.rating !== null
      ? player.rating.toFixed(2)
      : '—';
  const passAccDisplay =
    player.passAccuracy > 0 ? `${player.passAccuracy.toFixed(0)} %` : '—';
  const initials = getInitials(player.playerName);

  return (
    <div className="px-6 py-10 md:py-14 max-w-4xl mx-auto space-y-6">
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
        <span className="text-white/20">·</span>
        <Link
          to="/peliaika"
          className="text-ice hover:text-white transition-colors"
        >
          Peliaika
        </Link>
      </div>

      {/* Otsikko: iso avatar + nimi/joukkue/ikä/pelipaikka */}
      <header className="bg-navy-700/40 border border-navy-600 rounded-xl p-6 flex items-start gap-5">
        <div
          className="w-16 h-16 rounded-full bg-ice/10 border border-ice/20 flex items-center justify-center font-bold text-lg text-ice shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-1 font-medium">
            Veikkausliiga · Kausi {SEASON}
          </div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight leading-tight">
            {player.playerName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
            <span>{player.teamName}</span>
            {player.age !== undefined && (
              <>
                <span className="text-white/20">·</span>
                <span>{player.age} v</span>
              </>
            )}
            <span className="text-white/20">·</span>
            <span className="text-white/40 italic">Pelipaikka — tulossa</span>
          </div>
        </div>
      </header>

      {/* Päätilastot 6-sarakkeessa */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl">
        <div className="text-xs uppercase tracking-wider text-white/40 px-5 pt-4">
          Kauden tilastot
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-navy-600">
          <StatBlock label="Min" value={String(player.minutes)} accent="ice" />
          <StatBlock label="M" value={String(player.goals)} />
          <StatBlock label="S" value={String(player.assists)} />
          <StatBlock label="TP" value={String(tp)} accent="aurora" />
          <StatBlock label="KK" value={String(player.yellowCards)} />
          <StatBlock label="Rating" value={ratingDisplay} accent="ice" />
        </div>
      </section>

      {/* Lisää tilastoja */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">
          Lisää tilastoja
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          <DetailRow
            label="Aloitukset"
            value={`${player.starts} / ${player.appearances}`}
          />
          <DetailRow label="Passitarkkuus" value={passAccDisplay} />
          <DetailRow label="Torjunnat" value="—" hint="vain maalivahdille" />
          <DetailRow label="Taklaukset" value={String(player.tackles)} />
        </div>
      </section>

      {/* Kehityskäyrä-placeholder */}
      <section className="rounded-xl border border-dashed border-navy-600 bg-navy-700/30 p-6">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
          Kehityskäyrä
        </div>
        <div className="flex flex-col items-center justify-center text-center space-y-2 py-10">
          <TrendingUp className="w-7 h-7 text-white/30" />
          <div className="text-sm font-medium text-white/70">
            Kierroskohtainen data tulossa
          </div>
          <div className="text-xs text-white/40 max-w-md leading-relaxed">
            Ottelukohtainen kehitys (minuutit, tehopisteet, rating per kierros)
            näkyy täällä kun matchday-aggregointi on rakennettu.
          </div>
        </div>
      </section>

      {/* Transfermarkt-placeholder */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-1">
              Transfermarkt
            </div>
            <div className="text-sm text-white/70">
              Markkina-arvo ja siirtohistoria — tulossa
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-white/30" />
        </div>
      </section>

      {/* Lähdemerkintä */}
      <div className="text-xs text-white/40 pt-1">
        Lähde: API-Football (tilastot, ikä) + Veikkausliiga.com (viralliset
        minuutit, maalit, syötöt sukunimi-matchilla)
      </div>
    </div>
  );
}
