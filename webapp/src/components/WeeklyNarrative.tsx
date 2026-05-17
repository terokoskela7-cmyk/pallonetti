import type { YouthStats } from '@/services/api';

interface WeeklyNarrativeProps {
  teams: YouthStats[];
}

export function WeeklyNarrative({ teams }: WeeklyNarrativeProps) {
  if (teams.length === 0) {
    return (
      <p className="text-2xl md:text-3xl font-light leading-snug tracking-tight text-white/80 max-w-3xl">
        Veikkausliigan kausi alkaa pian — dataa kerätään.
      </p>
    );
  }

  const totalMinutes = teams.reduce((sum, t) => sum + t.totalMinutes, 0);
  const u23Minutes = teams.reduce((sum, t) => sum + t.youthMinutesU23, 0);
  const avgU23 = totalMinutes > 0 ? (u23Minutes / totalMinutes) * 100 : 0;

  const leader = [...teams].sort(
    (a, b) => b.youthPercentageU23 - a.youthPercentageU23,
  )[0];

  return (
    <p className="text-2xl md:text-3xl font-light leading-snug tracking-tight max-w-3xl">
      <span className="text-white/90">Veikkausliigan U23-pelaajat ovat saaneet </span>
      <span className="text-aurora font-medium tabular">{avgU23.toFixed(1)} %</span>
      <span className="text-white/90"> peliajasta. </span>
      {leader && (
        <>
          <span className="text-white/70">Eniten nuoria käyttää </span>
          <span className="text-ice font-medium">{leader.teamName}</span>
          <span className="text-white/70">
            {' '}({leader.youthPercentageU23.toFixed(1)} %).
          </span>
        </>
      )}
    </p>
  );
}
