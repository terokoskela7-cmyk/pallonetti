import { useApi } from '@/hooks/useApi';
import {
  getYouthAggregation,
  getOfficialStats,
  buildU23Players,
  type U23Player,
} from '@/services/api';
import { Hero } from '@/components/Hero';
import {
  Clock,
  Target,
  Sparkles,
  Info,
  ArrowUpRight,
  Users,
  type LucideIcon,
} from 'lucide-react';

const SEASON = 2026;
const MAX_PLAYERS = 30;

const AVATAR_COLORS = ['#00D4FF', '#00FF88', '#6366f1', '#f59e0b', '#ef4444'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface HighlightCardProps {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
}

function HighlightCard({ icon: Icon, label, title, body }: HighlightCardProps) {
  return (
    <div className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 mb-2">
        <Icon className="w-3.5 h-3.5 text-ice" />
        {label}
      </div>
      <div className="font-medium text-white/90 mb-1">{title}</div>
      <div className="text-sm text-white/60 leading-relaxed">{body}</div>
    </div>
  );
}

interface PlayerCardProps {
  player: U23Player & { tp: number };
  index: number;
  maxTp: number;
}

function PlayerCard({ player, index, maxTp }: PlayerCardProps) {
  const initials = getInitials(player.playerName);
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const tpPct = maxTp > 0 ? (player.tp / maxTp) * 100 : 0;

  return (
    <article className="bg-navy-700 border border-navy-600 rounded-lg p-4 flex flex-col gap-3 hover:border-navy-500 transition-colors relative">
      <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-ice/15 text-ice">
        {player.age} v
      </span>

      <div className="flex items-start gap-3 pr-12">
        <div
          className="w-12 h-12 rounded-full bg-ice/10 flex items-center justify-center font-semibold text-sm shrink-0"
          style={{ color: avatarColor }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white/95 truncate leading-tight">
            {player.playerName}
          </div>
          <div className="text-xs text-white/50 truncate mt-0.5">
            {player.teamName}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center border-t border-navy-600 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Min
          </div>
          <div className="text-lg font-bold text-ice font-mono tracking-tight">
            {player.minutes}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            M
          </div>
          <div className="text-lg font-bold text-white/90 font-mono tracking-tight">
            {player.goals}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            TP
          </div>
          <div className="text-lg font-bold text-white/90 font-mono tracking-tight">
            {player.tp}
          </div>
        </div>
      </div>

      <div className="h-1 bg-navy-600/70 rounded-full overflow-hidden">
        <div
          className="h-full bg-ice rounded-full transition-all duration-500"
          style={{ width: `${tpPct}%` }}
        />
      </div>

      {player.goals >= 3 && (
        <div className="text-[11px] font-medium text-aurora bg-aurora/10 border border-aurora/30 rounded-full px-2 py-0.5 self-start">
          🔥 {player.goals} maalia
        </div>
      )}
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-44 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-navy-700/30 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-52 bg-navy-700/30 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function NuoretPage() {
  const { data, loading, error } = useApi(
    async () => {
      const [agg, official] = await Promise.all([
        getYouthAggregation(SEASON),
        getOfficialStats(SEASON),
      ]);
      return { agg, official };
    },
    [SEASON],
  );

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="px-6 py-20 max-w-md mx-auto text-center">
        <Info className="w-10 h-10 text-red-400/80 mx-auto mb-4" />
        <div className="text-white/90 font-medium mb-2">
          Datan lataus epäonnistui
        </div>
        <div className="text-sm text-white/60">{error ?? 'Tuntematon virhe'}</div>
      </div>
    );
  }

  // Yhdistetty U23-lista (sama helper kuin PelaikaPagessa).
  // Rikastaa viralliset minuutit/maalit/syötöt sukunimi-matchilla.
  const u23 = buildU23Players(data.agg.topYouthPlayers, data.official.data);

  // Lajittele TP desc, toissijaisesti minuutit; max 30.
  const players = u23
    .map((p) => ({ ...p, tp: p.goals + p.assists }))
    .sort((a, b) => (b.tp !== a.tp ? b.tp - a.tp : b.minutes - a.minutes))
    .slice(0, MAX_PLAYERS);

  if (players.length === 0) {
    return (
      <div className="px-6 py-10 md:py-16 space-y-8">
        <Hero
          eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
          title={
            <>
              Nuoret pelaajat —{' '}
              <span className="text-aurora font-medium">Veikkausliiga {SEASON}</span>
            </>
          }
          subtitle="Alle 23-vuotiaat · ei dataa tälle kaudelle"
          height="sm"
        />
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            U23-pelaajia ei löytynyt tälle kaudelle. Tarkista youth-aggregation-endpoint.
          </p>
        </div>
      </div>
    );
  }

  const topMinutes = players.reduce(
    (best, p) => (p.minutes > best.minutes ? p : best),
    players[0],
  );
  const topScorer = players.reduce(
    (best, p) => (p.goals > best.goals ? p : best),
    players[0],
  );
  const topTp = players.reduce(
    (best, p) => (p.tp > best.tp ? p : best),
    players[0],
  );
  const maxTp = topTp.tp;

  return (
    <div className="px-6 py-10 md:py-16 space-y-8">
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
        title={
          <>
            Nuoret pelaajat —{' '}
            <span className="text-aurora font-medium">Veikkausliiga {SEASON}</span>
          </>
        }
        subtitle={`Alle 23-vuotiaat · ${players.length} pelaajaa seurannassa`}
        height="sm"
      />

      {/* Konteksti: miksi näiden pelaajien minuutit ovat tärkeitä */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <HighlightCard
          icon={ArrowUpRight}
          label="Wirén 2026 · Pohjoismainen vertailu"
          title="Suomi 14 % → Pohjoismaat 23 %"
          body="Pohjoismaisten vertailujen mukaan suomalaisen U23-pelaajan todennäköisyys ulkomaan siirrolle on noin 14 %, kun pohjoismaiden keskiarvo on 23 %. Käyttöaste seuroissa on suorin tapa kuroa eroa kiinni."
        />
        <HighlightCard
          icon={Users}
          label={`Kauden ${SEASON} U23-runko`}
          title={`${players.length} pelaajaa rakentaa tulevaisuutta`}
          body="Jokainen minuutti pääsarjassa lisää siirtoarvoa ja kehityspotentiaalia. Alla listatut pelaajat ovat tämän kauden eniten peliaikaa saaneet U23-pelaajat — heidän kehityksensä kertoo Suomen jalkapallon suunnan."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HighlightCard
          icon={Clock}
          label="Eniten minuutteja"
          title={topMinutes.playerName}
          body={`${topMinutes.teamName} · ${topMinutes.minutes} minuuttia · ${topMinutes.age} v`}
        />
        <HighlightCard
          icon={Target}
          label="Paras maalintekijä"
          title={topScorer.playerName}
          body={`${topScorer.teamName} · ${topScorer.goals} maalia · ${topScorer.age} v`}
        />
        <HighlightCard
          icon={Sparkles}
          label="Tehokkain"
          title={topTp.playerName}
          body={`${topTp.teamName} · ${topTp.tp} tehopistettä (${topTp.goals} M + ${topTp.assists} S) · ${topTp.age} v`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((player, i) => (
          <PlayerCard
            key={`${player.playerName}-${player.teamName}-${i}`}
            player={player}
            index={i}
            maxTp={maxTp}
          />
        ))}
      </div>

      <div className="text-xs text-white/40 text-center pt-2">
        Lähde: Veikkausliiga.com (minuutit, maalit, syötöt) + API-Football (ikä)
      </div>
    </div>
  );
}
