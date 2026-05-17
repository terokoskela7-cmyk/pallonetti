import { useState } from 'react';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import type { YouthStats } from '@/services/api';

export type AgeGroup = 'u23' | 'u21' | 'u20' | 'u19';

interface PlayerMinutesTableProps {
  teams: YouthStats[];
  ageGroup: AgeGroup;
}

type SortKey = 'pct' | 'minutes' | 'players' | 'age' | 'name';
type SortDir = 'asc' | 'desc';

function getPct(t: YouthStats, ag: AgeGroup): number {
  if (ag === 'u23') return t.youthPercentageU23;
  if (ag === 'u21') return t.youthPercentageU21;
  if (ag === 'u20') return t.youthPercentageU20;
  return t.youthPercentageU19;
}

function getMinutes(t: YouthStats, ag: AgeGroup): number {
  if (ag === 'u23') return t.youthMinutesU23;
  if (ag === 'u21') return t.youthMinutesU21;
  if (ag === 'u20') return t.youthMinutesU20;
  return t.youthMinutesU19;
}

function getPlayers(t: YouthStats, ag: AgeGroup): number {
  // YouthStats sisältää laskurit vain U23/U21/U20 — U19:lle ei
  if (ag === 'u23') return t.youthPlayersU23;
  if (ag === 'u21') return t.youthPlayersU21;
  if (ag === 'u20') return t.youthPlayersU20;
  return 0;
}

const headerLabels: Record<AgeGroup, string> = {
  u23: 'U23-%',
  u21: 'U21-%',
  u20: 'U20-%',
  u19: 'U19-%',
};

export function PlayerMinutesTable({ teams, ageGroup }: PlayerMinutesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (column !== sortKey) {
      return <ArrowUpDown className="w-3 h-3 text-white/30" />;
    }
    return sortDir === 'desc' ? (
      <ArrowDown className="w-3 h-3 text-ice" />
    ) : (
      <ArrowUp className="w-3 h-3 text-ice" />
    );
  }

  const sorted = [...teams].sort((a, b) => {
    let diff = 0;
    if (sortKey === 'pct') diff = getPct(a, ageGroup) - getPct(b, ageGroup);
    else if (sortKey === 'minutes')
      diff = getMinutes(a, ageGroup) - getMinutes(b, ageGroup);
    else if (sortKey === 'players')
      diff = getPlayers(a, ageGroup) - getPlayers(b, ageGroup);
    else if (sortKey === 'age') diff = a.averageAge - b.averageAge;
    else if (sortKey === 'name') diff = a.teamName.localeCompare(b.teamName);
    return sortDir === 'desc' ? -diff : diff;
  });

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-white/50">
            <th className="py-3 pr-3 w-8 font-medium">#</th>
            <th className="py-3 pr-3 font-medium">
              <button
                onClick={() => handleSort('name')}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
              >
                Joukkue <SortIcon column="name" />
              </button>
            </th>
            <th className="py-3 px-3 font-medium">
              <button
                onClick={() => handleSort('age')}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
              >
                Keski-ikä <SortIcon column="age" />
              </button>
            </th>
            <th className="py-3 px-3 font-medium">
              <button
                onClick={() => handleSort('pct')}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
              >
                {headerLabels[ageGroup]} <SortIcon column="pct" />
              </button>
            </th>
            <th className="py-3 px-3 font-medium text-right">
              <button
                onClick={() => handleSort('minutes')}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
              >
                Minuutit <SortIcon column="minutes" />
              </button>
            </th>
            <th className="py-3 pl-3 font-medium text-right hidden sm:table-cell">
              <button
                onClick={() => handleSort('players')}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
              >
                Pelaajia <SortIcon column="players" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, i) => {
            const age = team.averageAge;
            const ageClass =
              age < 23 ? 'text-aurora' : age < 26 ? 'text-ice' : 'text-white/70';
            return (
              <tr
                key={team.teamId}
                className="border-t border-navy-700 hover:bg-navy-700/30 transition-colors"
              >
                <td className="py-3 pr-3 text-white/40 tabular">{i + 1}</td>
                <td className="py-3 pr-3 font-medium text-white/90">
                  {team.teamName}
                </td>
                <td className={`py-3 px-3 tabular ${ageClass}`}>
                  {age.toFixed(1)}
                </td>
                <td className="py-3 px-3 tabular text-white/90">
                  {getPct(team, ageGroup).toFixed(1)} %
                </td>
                <td className="py-3 px-3 text-right tabular text-ice">
                  {getMinutes(team, ageGroup).toLocaleString('fi-FI')}
                </td>
                <td className="py-3 pl-3 text-right tabular text-white/70 hidden sm:table-cell">
                  {getPlayers(team, ageGroup) || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
