import type { YouthStats } from '@/services/api';

interface WeeklyNarrativeProps {
  veikkausliiga: YouthStats[];
  ykkosliiga: YouthStats[];
}

function calcAvgU23(teams: YouthStats[]): number {
  const totalMinutes = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u23Minutes = teams.reduce((s, t) => s + t.youthMinutesU23, 0);
  return totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;
}

function findLeader(teams: YouthStats[]): YouthStats | undefined {
  return [...teams].sort(
    (a, b) => b.youthPercentageU23 - a.youthPercentageU23,
  )[0];
}

export function WeeklyNarrative({ veikkausliiga, ykkosliiga }: WeeklyNarrativeProps) {
  if (veikkausliiga.length === 0 && ykkosliiga.length === 0) {
    return (
      <p className="text-2xl md:text-3xl font-light leading-snug tracking-tight text-white/80 max-w-3xl">
        Kausi alkaa pian — dataa kerätään.
      </p>
    );
  }

  const vAvg = calcAvgU23(veikkausliiga);
  const vLeader = findLeader(veikkausliiga);
  const yLeader = findLeader(ykkosliiga);

  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-2xl md:text-3xl font-light leading-snug tracking-tight">
        <span className="text-white/90">Veikkausliigan U23-pelaajat ovat saaneet </span>
        <span className="text-aurora font-medium tabular">{vAvg.toFixed(1)} %</span>
        <span className="text-white/90"> peliajasta. </span>
        {vLeader && (
          <>
            <span className="text-white/70">Eniten nuoria käyttää </span>
            <span className="text-ice font-medium">{vLeader.teamName}</span>
            <span className="text-white/70">
              {' '}({vLeader.youthPercentageU23.toFixed(1)} %).
            </span>
          </>
        )}
      </p>
      {yLeader && (
        <p className="text-base md:text-lg font-light leading-snug text-white/60">
          <span>Ykkösliigassa eniten peliaikaa nuorille antaa </span>
          <span className="text-ice font-medium">{yLeader.teamName}</span>
          <span>
            {' '}<span className="tabular">{yLeader.youthPercentageU23.toFixed(1)} %</span> osuudella.
          </span>
        </p>
      )}
    </div>
  );
}
