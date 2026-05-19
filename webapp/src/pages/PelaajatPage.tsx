import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Info } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getOfficialStats, type OfficialPlayer } from '@/services/api';
import { Hero } from '@/components/Hero';

const SEASON = 2026;

/** Yksinkertainen slugify joka säilyttää ascii:n. Käytetään tulevan
 *  /pelaaja/:id-reitin parametriksi (placeholder-navigointi). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PelaajatPage() {
  const { data, loading, error } = useApi(
    () => getOfficialStats(SEASON),
    [SEASON],
  );
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const navigate = useNavigate();

  const teams = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.data.map((p) => p.team))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as OfficialPlayer[];
    const q = search.trim().toLowerCase();
    return data.data.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (teamFilter && p.team !== teamFilter) return false;
      return true;
    });
  }, [data, search, teamFilter]);

  if (loading) {
    return (
      <div className="px-6 py-20">
        <div className="text-white/40 text-sm">Ladataan pelaajia…</div>
      </div>
    );
  }

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

  return (
    <div className="px-6 py-10 md:py-16 space-y-6">
      <Hero
        eyebrow={`Veikkausliiga · Kausi ${SEASON}`}
        title={
          <>
            Pelaajat —{' '}
            <span className="text-aurora font-medium">viralliset tilastot</span>
          </>
        }
        subtitle={`${data.data.length} pelaajaa · suodattuna ${filtered.length}`}
        height="sm"
      />

      {/* Suodattimet */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hae nimellä…"
            className="w-full bg-navy-700 border border-navy-600 rounded-md pl-9 pr-3 py-2 text-sm text-white/90 placeholder-white/40 focus:outline-none focus:border-ice/50"
          />
        </div>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="bg-navy-700 border border-navy-600 rounded-md px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-ice/50"
        >
          <option value="">Kaikki joukkueet</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Taulukko */}
      {filtered.length === 0 ? (
        <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <p className="text-sm text-white/60">
            Yhtään pelaajaa ei vastaa suodattimia.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-navy-600">
                <th className="py-2 pr-3 w-10 text-right">#</th>
                <th className="py-2 pr-3">Pelaaja</th>
                <th className="py-2 pr-3">Joukkue</th>
                <th className="py-2 pr-3 text-right">Min</th>
                <th className="py-2 pr-3 text-right">M</th>
                <th className="py-2 pr-3 text-right">S</th>
                <th className="py-2 pr-3 text-right">TP</th>
                <th className="py-2 pl-3 text-right">KK</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const tp = p.goals + p.assists;
                return (
                  <tr
                    key={`${p.name}-${p.team}-${p.rank}`}
                    onClick={() => navigate(`/pelaaja/${slugify(p.name)}`)}
                    className="border-b border-navy-700 hover:bg-navy-700/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 pr-3 text-right text-white/40 font-mono tabular">
                      {p.rank}
                    </td>
                    <td className="py-2 pr-3 font-medium text-white/95">
                      {p.name}
                    </td>
                    <td className="py-2 pr-3 text-white/60">{p.team}</td>
                    <td className="py-2 pr-3 text-right text-ice font-mono tabular">
                      {p.minutes}
                    </td>
                    <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                      {p.goals}
                    </td>
                    <td className="py-2 pr-3 text-right text-white/90 font-mono tabular">
                      {p.assists}
                    </td>
                    <td className="py-2 pr-3 text-right text-aurora font-mono tabular">
                      {tp}
                    </td>
                    <td className="py-2 pl-3 text-right text-white/60 font-mono tabular">
                      {p.yellowCards}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
