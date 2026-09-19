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
  getSeasonPlayer,
  getPlayerRounds,
  getTransfermarktPlayer,
  formatMarketValue,
  type SeasonPlayer,
  type PlayerRound,
} from '@/services/api';
import { useKausi, useValittuKausi } from '@/hooks/useKausi';
import { MARKKINA_ARVOT_NAKYVISSA } from '@/constants/ominaisuudet';

function fullName(p: SeasonPlayer): string {
  return `${p.etunimi} ${p.sukunimi}`.trim();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

/**
 * Pelaajaa ei ole valitulla kaudella. Tämä ei ole virhe vaan tavallinen
 * tilanne kautta vaihdettaessa: pelaaja on voinut pelata toisella kaudella.
 * Siksi kausi sanotaan auki eikä näytetä tyhjää sivua.
 */
function NotFoundState({ slug, kausi }: { slug: string; kausi: number }) {
  const nimi = slug
    .split('-')
    .filter(Boolean)
    .map((osa) => osa.charAt(0).toUpperCase() + osa.slice(1))
    .join(' ');
  return (
    <div className="px-6 py-16 max-w-md mx-auto text-center space-y-4">
      <Info className="w-10 h-10 text-white/40 mx-auto" />
      <div className="text-white/90 font-medium">
        {nimi || 'Pelaaja'} ei pelannut kaudella {kausi}
      </div>
      <div className="text-sm text-white/60">
        Valitse toinen kausi yläpalkista, tai palaa listaukseen.
      </div>
      <div className="text-xs text-white/40">
        Slug: <span className="font-mono text-white/60">{slug}</span>
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
          to="/peliaika"
          className="text-sm text-ice hover:text-white transition-colors"
        >
          Peliaika
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

interface PlayerAvatarProps {
  photoUrl?: string | null;
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

interface DeltaPoint {
  round: string;
  min: number;
  cumMin: number;
}

function DeltaTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as DeltaPoint;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-sm">
      <div className="text-white/90 font-medium">{d.round}</div>
      <div className="text-ice tabular">{d.min} min</div>
      <div className="text-white/50 text-xs tabular">kum. {d.cumMin}</div>
    </div>
  );
}

/** Kehityskäyrä oikeasta kierrosdatasta.
 *  Delta = tämän kierroksen minuutit = cumMin(K) - cumMin(K-1). */
function ProgressionChart({ rounds }: { rounds: PlayerRound[] }) {
  const data: DeltaPoint[] = rounds.map((r, i) => ({
    round: `K${r.round}`,
    min: i === 0 ? r.cumMin : r.cumMin - rounds[i - 1].cumMin,
    cumMin: r.cumMin,
  }));

  return (
    <div style={{ width: '100%', height: 220 }}>
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
            domain={[0, 90]}
            ticks={[0, 30, 60, 90]}
            unit=" min"
          />
          <Tooltip
            content={<DeltaTooltip />}
            cursor={{ stroke: '#00C8FF', strokeOpacity: 0.3 }}
          />
          <Line
            type="monotone"
            dataKey="min"
            stroke="#00C8FF"
            strokeWidth={2.5}
            dot={{ fill: '#00C8FF', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PelaajaPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';
  const kausi = useValittuKausi();
  const { kaudet } = useKausi();
  // Markkina-arvo on nykyhetken tieto. Menneellä kaudella sitä ei esitetä
  // kyseisen kauden arvona vaan nimetään auki.
  const menneKausi = kausi < (kaudet.length > 0 ? kaudet[0].kausi : kausi);

  // Pääasiallinen lähde: Firestore-pelaaja slug:lla.
  const { data: player, loading, error } = useApi(
    () => getSeasonPlayer(kausi, slug),
    [slug, kausi],
  );

  // Kierrosdata kehityskäyrää varten.
  const { data: rounds } = useApi(
    async () => {
      if (!slug) return [] as PlayerRound[];
      try {
        return await getPlayerRounds(kausi, slug);
      } catch {
        return [] as PlayerRound[];
      }
    },
    [slug, kausi],
  );

  const name = player ? fullName(player) : '';

  // Transfermarkt: markkina-arvo, kuva, pelipaikka. Säilyy kuten ennen —
  // cache-first backendissä; jos ei indeksoitu, jää nulliksi.
  const { data: tmData } = useApi(
    async () => {
      if (!name) return null;
      try {
        return await getTransfermarktPlayer(name, kausi);
      } catch {
        return null;
      }
    },
    [name, kausi],
  );

  const safeMarketValue = useMemo(() => {
    if (!tmData || tmData.marketValue === null) return null;
    // Yli 5M € on lähes varmasti väärä TM-match.
    return tmData.marketValue <= 5_000_000 ? tmData.marketValue : null;
  }, [tmData]);

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
  if (!player) return <NotFoundState slug={slug} kausi={kausi} />;

  const photoUrl = tmData?.imageUrl ?? null;
  const position = tmData?.position ?? null;
  const hasRounds = (rounds?.length ?? 0) > 0;

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
          to="/peliaika"
          className="text-ice hover:text-white transition-colors"
        >
          Peliaika
        </Link>
      </div>

      {/* Header: avatar + nimi + meta */}
      <header className="bg-navy-700/40 border border-navy-600 rounded-xl p-6 flex items-start gap-5">
        <PlayerAvatar photoUrl={photoUrl} name={name} size={80} />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-1 font-medium">
            Veikkausliiga · Kausi {kausi}
          </div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight leading-tight">
            {name}
          </h1>
          {position && (
            <div className="mt-2 text-sm text-white/80">{position}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
            <span>{player.joukkue}</span>
            {player.ika > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span>{player.ika} v</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Päätilastot */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl">
        <div className="text-xs uppercase tracking-wider text-white/40 px-5 pt-4">
          Kauden tilastot
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-navy-600">
          <StatBlock label="Minuutit" value={String(player.minTotal)} accent="ice" />
          <StatBlock label="Maalit" value={String(player.maaliTotal)} accent="aurora" />
          <StatBlock label="Ottelut" value={String(player.ottelutTotal)} />
          <StatBlock label="Aloitukset" value={String(player.aloituksetTotal)} />
        </div>
      </section>

      {/* Transfermarkt — markkina-arvo + lisätiedot (≤ 5M € validointi). */}
      {MARKKINA_ARVOT_NAKYVISSA && tmData && safeMarketValue !== null && (
        <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-white/40 mb-1">
                {menneKausi ? 'Nykyinen arvo' : 'Markkina-arvo'}
              </div>
              <div className="text-3xl md:text-4xl font-bold text-ice font-mono tabular leading-none">
                {formatMarketValue(safeMarketValue) ?? '—'}
              </div>
              {menneKausi && (
                <div className="text-[11px] text-white/40 mt-1">
                  Tämänhetkinen arvo, ei kauden {kausi} arvo.
                </div>
              )}
              {tmData.contractExpires && (
                <div className="text-xs text-white/50 mt-3">
                  Sopimus voimassa:{' '}
                  <span className="text-white/80">{tmData.contractExpires}</span>
                </div>
              )}
            </div>
            <div className="hidden md:flex flex-col items-end text-right text-xs text-white/50 space-y-1 max-w-[40%]">
              {tmData.position && (
                <div>
                  Pelipaikka (TM):{' '}
                  <span className="text-white/80">{tmData.position}</span>
                </div>
              )}
              {tmData.height && (
                <div>
                  Pituus: <span className="text-white/80">{tmData.height}</span>
                </div>
              )}
              {tmData.foot && (
                <div>
                  Jalka: <span className="text-white/80">{tmData.foot}</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-white/30 mt-4 uppercase tracking-wider">
            Lähde: Transfermarkt
          </div>
        </section>
      )}

      {/* Kehityskäyrä — minuutit per kierros (delta kierrosdatasta) */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Kehityskäyrä — minuutit per kierros
          </h2>
          <span className="text-[10px] text-white/30 uppercase tracking-wider">
            {hasRounds
              ? `${rounds!.length} kierrosta`
              : 'Kierrosdata tulossa'}
          </span>
        </div>
        {hasRounds ? (
          <ProgressionChart rounds={rounds!} />
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <TrendingUp className="w-7 h-7 text-white/30 mb-2" />
            <div className="text-sm text-white/60">
              Kierroskohtaista dataa ei vielä saatavilla tälle pelaajalle.
            </div>
          </div>
        )}
      </section>

      <div className="text-xs text-white/40 pt-1">
        Lähde: Veikkausliiga.com (viralliset tilastot)
        {MARKKINA_ARVOT_NAKYVISSA
          ? ' + Transfermarkt (markkina-arvo, kuva, pelipaikka)'
          : ''}
      </div>
    </div>
  );
}
