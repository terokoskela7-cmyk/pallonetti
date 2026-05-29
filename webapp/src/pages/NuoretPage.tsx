import { useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  getYouthAggregation,
  getOfficialStats,
  getTransfermarktLeague,
  buildU23Players,
  filterReliableTeams,
  formatMarketValue,
  type U23Player,
  type YouthStats,
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

// CIES Football Observatory: Tanskan Superliga johtaa Euroopassa U21-peliajassa.
const CIES_TARGET_PCT = 11.7;
// Palkin asteikon yläraja — pitää sekä tavoitteen että Suomen arvon näkyvissä.
const CIES_BAR_MAX = 25;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** U21 peliaika-% painotettuna joukkueiden kesken (datavaje-suodatettu). */
function calcU21Pct(teams: YouthStats[]): number {
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u21 = teams.reduce((s, t) => s + t.youthMinutesU21, 0);
  return total > 0 ? (u21 / total) * 100 : 0;
}

/** CIES-vertailupalkki: Suomen U21-% vs. Tanskan 11,7 % -tavoite. */
function CiesComparisonBar({ pct }: { pct: number }) {
  const diff = pct - CIES_TARGET_PCT;
  const above = diff >= 0;
  const toneClass = above ? 'text-aurora' : 'text-red-400';
  const fillColor = above ? '#00FF88' : '#ef4444';
  const fillPct = Math.min(100, (pct / CIES_BAR_MAX) * 100);
  const targetLeft = Math.min(100, (CIES_TARGET_PCT / CIES_BAR_MAX) * 100);

  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <span className="text-xs uppercase tracking-wider text-white/50">
          CIES-tavoite: {CIES_TARGET_PCT.toFixed(1).replace('.', ',')} % · Tanska Superliga
        </span>
        <span className={`text-sm font-medium ${toneClass}`}>
          Suomi nyt {pct.toFixed(1).replace('.', ',')} %{' '}
          <span className="font-mono tabular">
            {above ? '↑ +' : '↓ '}
            {Math.abs(diff).toFixed(1).replace('.', ',')} pp
          </span>
        </span>
      </div>
      <div className="relative h-3 bg-navy-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${fillPct}%`, backgroundColor: fillColor }}
        />
        {/* CIES-tavoitemerkki */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/70"
          style={{ left: `${targetLeft}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-white/30 font-mono tabular">
        <span>0 %</span>
        <span>{CIES_BAR_MAX} %</span>
      </div>
    </div>
  );
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
  marketValue: number | null;
}

function PlayerCard({ player, index, maxTp, marketValue }: PlayerCardProps) {
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

      {marketValue !== null && (
        <div className="flex items-baseline justify-between border-t border-navy-600 pt-2 -mb-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            Markkina-arvo
          </span>
          <span className="text-sm font-bold text-amber-400 font-mono tabular">
            {formatMarketValue(marketValue)}
          </span>
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

  // Transfermarkt batch — ladataan rinnakkain, sivu ei jää odottamaan.
  // Jos endpointti palauttaa virheen (esim. indeksi tyhjä), tmEntries jää
  // tyhjäksi listaksi → markkina-arvoja ei näytetä, kortit ovat normaalit.
  const { data: tmEntries } = useApi(
    async () => {
      try {
        return await getTransfermarktLeague(SEASON);
      } catch {
        return [] as Awaited<ReturnType<typeof getTransfermarktLeague>>;
      }
    },
    [SEASON],
  );

  // Sukunimi → marketValue -Map. Sukunimi = nimen viimeinen sana,
  // lowercase. Sama logiikka kuin backendin batch-funktiossa.
  const marketValueBySurname = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of tmEntries ?? []) {
      if (e.marketValue === null || e.marketValue === undefined) continue;
      const surname = e.name
        .split(/\s+/)
        .filter(Boolean)
        .pop()
        ?.toLowerCase();
      if (!surname) continue;
      // Jos useita TM-osumia samalla sukunimellä, suosi suurempaa arvoa
      const existing = map.get(surname);
      if (existing === undefined || e.marketValue > existing) {
        map.set(surname, e.marketValue);
      }
    }
    return map;
  }, [tmEntries]);

  function lookupMarketValue(playerName: string): number | null {
    const surname = playerName
      .split(/\s+/)
      .filter(Boolean)
      .pop()
      ?.toLowerCase();
    if (!surname) return null;
    const mv = marketValueBySurname.get(surname) ?? null;
    // Validointi: yli 5M € on lähes varmasti väärä TM-match U23-pelaajalle
    // Veikkausliigassa (sukunimi-haku saattaa osua tunnetumpaan kaimaan).
    return mv !== null && mv <= 5_000_000 ? mv : null;
  }

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

  // Yhdistetty U21-lista (sama helper kuin PelaikaPagessa, suodatettu U21:een).
  // Rikastaa viralliset minuutit/maalit/syötöt sukunimi-matchilla.
  const u21 = buildU23Players(data.agg.topYouthPlayers, data.official.data).filter(
    (p) => p.age <= 21,
  );

  // Lajittele TP desc, toissijaisesti minuutit; max 30.
  const players = u21
    .map((p) => ({ ...p, tp: p.goals + p.assists }))
    .sort((a, b) => (b.tp !== a.tp ? b.tp - a.tp : b.minutes - a.minutes))
    .slice(0, MAX_PLAYERS);

  // U21-osuus CIES-vertailupalkkiin (datavaje-suodatettu, sama kuin etusivu).
  const u21Pct = calcU21Pct(filterReliableTeams(data.agg.teamBreakdown));

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
          subtitle="Alle 21-vuotiaat · ei dataa tälle kaudelle"
          height="sm"
        />
        {/* CIES-vertailu näkyy myös ilman pelaajalistaa — data on teamBreakdownista */}
        <CiesComparisonBar pct={u21Pct} />
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            U21-pelaajakohtaista listaa ei juuri nyt saatavilla (youth-aggregation
            palautti tyhjän pelaajalistan). Liigatason U21-osuus yllä on silti
            ajantasainen.
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
        subtitle={`Alle 21-vuotiaat · ${players.length} pelaajaa seurannassa`}
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
          label={`Kauden ${SEASON} U21-runko`}
          title={`${players.length} pelaajaa rakentaa tulevaisuutta`}
          body="Jokainen minuutti pääsarjassa lisää siirtoarvoa ja kehityspotentiaalia. Alla listatut pelaajat ovat tämän kauden eniten peliaikaa saaneet U21-pelaajat — heidän kehityksensä kertoo Suomen jalkapallon suunnan."
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

      {/* CIES-vertailu: Suomen U21-% vs. Tanskan 11,7 % -tavoite */}
      <CiesComparisonBar pct={u21Pct} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((player, i) => (
          <PlayerCard
            key={`${player.playerName}-${player.teamName}-${i}`}
            player={player}
            index={i}
            maxTp={maxTp}
            marketValue={lookupMarketValue(player.playerName)}
          />
        ))}
      </div>

      <div className="text-xs text-white/40 text-center pt-2">
        Lähde: Veikkausliiga.com (minuutit, maalit, syötöt) + API-Football (ikä)
      </div>
    </div>
  );
}
