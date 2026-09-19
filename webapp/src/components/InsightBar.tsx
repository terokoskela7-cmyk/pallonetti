import { TrendingUp, TrendingDown, Users, Star, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { YouthStats } from '@/services/api';

interface InsightBarProps {
  teams: YouthStats[];
}

const PREV_SEASON_AVG = 18.0;
// Wirén (2026): 10 pp käyttöasteen nousu → +4,3 pp siirtotodennäköisyys (FI)
const WIREN_COEFFICIENT = 0.43;
const FI_BASE_TRANSFER_PROB = 14.0;

interface Insight {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
}

function computeInsights(teams: YouthStats[]): Insight[] {
  if (teams.length === 0) return [];

  // Lähde on suodatettu 17–21-vuotiaisiin, joten luvut ovat U21.
  const topU21 = [...teams].sort(
    (a, b) => b.youthPercentageU21 - a.youthPercentageU21,
  )[0];

  const totalMin = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u21Min = teams.reduce((s, t) => s + t.youthMinutesU21, 0);
  const leagueAvg = totalMin > 0 ? (u21Min / totalMin) * 100 : 0;
  const diff = leagueAvg - PREV_SEASON_AVG;
  const trendUp = diff >= 0;

  const mostU20 = [...teams].sort(
    (a, b) => b.youthPlayersU20 - a.youthPlayersU20,
  )[0];

  // Wirén-kytkös: lasketaan liigan käyttöasteen perusteella
  // arvioitu siirtotodennäköisyys verrattuna pohjoismaiden keskiarvoon (18,5%)
  const wirenDeltaPP = (leagueAvg - 18.5) / 10 * WIREN_COEFFICIENT;
  const estimatedTransferProb = Math.max(0, FI_BASE_TRANSFER_PROB + wirenDeltaPP).toFixed(1);

  return [
    {
      icon: Star,
      label: 'Eniten peliaikaa nuorille',
      title: topU21.teamName,
      body: `Antaa eniten peliaikaa nuorille — ${topU21.youthPercentageU21.toFixed(1)} % joukkueen peliminuuteista menee alle 21-vuotiaille.`,
    },
    {
      icon: trendUp ? TrendingUp : TrendingDown,
      label: 'Liigan suunta',
      title: `${leagueAvg.toFixed(1)} % keskiarvo`,
      body: trendUp
        ? `Veikkausliiga antaa nuorille enemmän peliaikaa kuin koskaan — ${diff.toFixed(1)} % enemmän kuin viime kaudella.`
        : `Nuorten peliaika on laskenut ${Math.abs(diff).toFixed(1)} % viime kaudesta.`,
    },
    {
      icon: Users,
      label: 'Luottaa nuorimpiin',
      title: mostU20.teamName,
      body: `${mostU20.youthPlayersU20} alle 20-vuotiasta pelaajaa on saanut peliaikaa tällä kaudella.`,
    },
    {
      icon: ArrowUpRight,
      label: 'Siirtopotentiaali · Wirén 2026',
      title: `~${estimatedTransferProb} % siirtotodennäköisyys`,
      body: `Tämän kauden käyttöasteen perusteella arvioitu todennäköisyys ulkomaan siirrolle. Suomen lähtötaso on 14 % — jokainen +10 pp nostaa todennäköisyyttä 4,3 pp.`,
    },
  ];
}

export function InsightBar({ teams }: InsightBarProps) {
  const insights = computeInsights(teams);
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {insights.map((ins) => {
        const Icon = ins.icon;
        return (
          <div
            key={ins.label}
            className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 mb-2">
              <Icon className="w-3.5 h-3.5 text-ice" />
              {ins.label}
            </div>
            <div className="font-medium text-white/90 mb-2">{ins.title}</div>
            <div className="text-sm text-white/60 leading-relaxed">
              {ins.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}
