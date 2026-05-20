import { useState } from 'react';
import { Info, RefreshCw, TrendingUp } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import {
  getYouthStatsAll,
  filterReliableTeams,
  type YouthStats,
} from '@/services/api';
import {
  LeagueTabBar,
  type LeagueId,
} from '@/components/LeagueTabBar';
import { AgeDistributionChart } from '@/components/AgeDistributionChart';
import { InsightBar } from '@/components/InsightBar';
import {
  PlayerMinutesTable,
  type AgeGroup,
} from '@/components/PlayerMinutesTable';

const SEASON = 2026;

const leagueLabels: Record<LeagueId, string> = {
  veikkausliiga: 'Veikkausliiga',
  ykkosliiga: 'Ykkösliiga',
  ykkonen: 'Ykkönen',
};

const ageGroupTabs: { value: AgeGroup; label: string }[] = [
  { value: 'u23', label: 'Kaikki U23' },
  { value: 'u21', label: 'U21' },
  { value: 'u20', label: 'U20' },
  { value: 'u19', label: 'U19' },
];

const minMinutesOptions = [0, 90, 180, 360];

function calcLeagueAvg(teams: YouthStats[], ag: AgeGroup): number {
  const totalMin = teams.reduce((s, t) => s + t.totalMinutes, 0);
  if (totalMin <= 0) return 0;
  const youthMin = teams.reduce((s, t) => {
    if (ag === 'u23') return s + t.youthMinutesU23;
    if (ag === 'u21') return s + t.youthMinutesU21;
    if (ag === 'u20') return s + t.youthMinutesU20;
    return s + t.youthMinutesU19;
  }, 0);
  return (youthMin / totalMin) * 100;
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-12 bg-navy-700/50 rounded w-2/3 max-w-2xl" />
        <div className="h-6 bg-navy-700/30 rounded w-1/2 max-w-md" />
      </div>
      <div className="h-12 bg-navy-700/40 rounded" />
      <div className="h-80 bg-navy-700/30 rounded" />
      <div className="h-96 bg-navy-700/30 rounded" />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-6 py-20 max-w-md mx-auto text-center space-y-4">
      <Info className="w-10 h-10 text-red-400/80 mx-auto" />
      <div className="text-white/90 font-medium">Datan lataus epäonnistui</div>
      <div className="text-sm text-white/60">{message}</div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 border border-navy-500 rounded-md text-sm transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Yritä uudelleen
      </button>
    </div>
  );
}

function NoDataBanner({ league }: { league: LeagueId }) {
  return (
    <div className="rounded-r-md bg-navy-600 border-l-2 border-ice px-5 py-4 flex items-start gap-3">
      <Info className="w-4 h-4 text-ice shrink-0 mt-0.5" />
      <p className="text-sm text-white/60 leading-relaxed">
        Pelaajatilastot {leagueLabels[league]}-sarjalle tulossa — laajennamme
        kattavuutta yhteistyössä Palloliiton kanssa.
      </p>
    </div>
  );
}

export default function PelaikaPage() {
  const { data, loading, error, refetch } = useApi(
    () => getYouthStatsAll(SEASON),
    [SEASON],
  );
  const [activeLeague, setActiveLeague] = useState<LeagueId>('veikkausliiga');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('u23');
  const [minMinutes, setMinMinutes] = useState<number>(0);

  // Väliaikainen debug — poistetaan kun /peliaika toimii vakaasti
  // eslint-disable-next-line no-console
  console.log('[PelaikaPage] state:', {
    loading,
    error,
    hasData: !!data,
    veikkausliigaCount: data?.veikkausliiga?.length ?? null,
    ykkosliigaCount: data?.ykkosliiga?.length ?? null,
    ykkonenCount: data?.ykkonen?.length ?? null,
    activeLeague,
  });

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? 'Tuntematon virhe'} onRetry={refetch} />
    );
  }

  // Suodata pois joukkueet joilla totalMinutes < 1000 (datavaje) ennen
  // mitään muuta laskentaa. Tämä koskee KAIKKIA kolmea sarjaa.
  const reliable: Record<LeagueId, YouthStats[]> = {
    veikkausliiga: filterReliableTeams(data.veikkausliiga),
    ykkosliiga: filterReliableTeams(data.ykkosliiga),
    ykkonen: filterReliableTeams(data.ykkonen),
  };

  const hasData: Record<LeagueId, boolean> = {
    veikkausliiga: reliable.veikkausliiga.length > 0,
    ykkosliiga: reliable.ykkosliiga.length > 0,
    ykkonen: reliable.ykkonen.length > 0,
  };

  const allTeams: YouthStats[] = reliable[activeLeague];

  // Minimi minuutit -filtteri: rajaa joukkueet joiden totalMinutes ylittää rajan
  const teams = allTeams.filter((t) => t.totalMinutes >= minMinutes);

  // Liigan painotettu keskiarvo nykyisen ikäryhmän mukaan
  // (lasketaan kaikista luotettavista joukkueista, ei minMinutes-suodatetuista)
  const leagueAvg = calcLeagueAvg(allTeams, ageGroup);

  const totalU23Players = teams.reduce(
    (sum, t) => sum + t.youthPlayersU23,
    0,
  );

  return (
    <div className="px-6 py-10 md:py-16 space-y-10">
      {/* 1. Hero */}
      <header className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-600 via-navy-700 to-navy-800 border border-navy-600 px-6 md:px-10 py-10 md:py-14">
        {/* dekoratiiviset accentit */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-aurora/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-ice/10 blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-3 font-medium">
            Kausi {SEASON}
          </div>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight leading-tight">
            Peliaika —{' '}
            <span className="text-aurora font-medium">
              {leagueLabels[activeLeague]}
            </span>
          </h1>
          <p className="mt-3 text-base md:text-lg text-white/60 max-w-2xl">
            Kuinka paljon nuoret pelaajat saavat peliaikaa?
          </p>
        </div>
      </header>

      {/* 2. Sarja-välilehdet */}
      <LeagueTabBar
        active={activeLeague}
        onChange={setActiveLeague}
        hasData={hasData}
      />

      {/* Ei dataa → info-banneri ja stop */}
      {!hasData[activeLeague] ? (
        <NoDataBanner league={activeLeague} />
      ) : (
        <>
          {/* 3. Ikäjakauma-kaavio */}
          <section>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-lg font-medium">Ikäjakauma joukkueittain</h2>
              <span className="text-xs text-white/40">
                % peliminuuteista
              </span>
            </div>
            <AgeDistributionChart teams={teams} />
          </section>

          {/* 3.2. Liigan U23%-trendi kauden aikana (placeholder — kierroskohtainen
              data ei vielä saatavilla. Vaatii matches/lineups-pohjaisen aggregoinnin
              joka rakennetaan seuraavalla sprintillä.) */}
          <section className="rounded-xl border border-dashed border-navy-600 bg-navy-700/30 p-8 text-center space-y-2">
            <TrendingUp className="w-6 h-6 text-white/30 mx-auto" />
            <div className="text-sm font-medium text-white/70">
              Liigan U23-% kauden aikana — tulossa
            </div>
            <div className="text-xs text-white/40 max-w-md mx-auto leading-relaxed">
              Kierroskohtainen trendi näyttää onko nuorten käyttöaste nousussa vai
              laskussa kauden edetessä. Vaatii ottelukohtaisen aggregoinnin —
              rakennetaan seuraavalla sprintillä.
            </div>
          </section>

          {/* 3.5. Tarinankerronta — automaattiset nostot */}
          <section>
            <InsightBar teams={teams} />
          </section>

          {/* 4. Filtterit (ilman ikäryhmää — se on tab-bar:issa alla) */}
          <section className="space-y-4 border-y border-navy-700 py-5">
            <FilterRow
              label="Minimi minuutit"
              value={String(minMinutes)}
              options={minMinutesOptions.map((m) => ({
                value: String(m),
                label: m === 0 ? 'Kaikki' : `≥ ${m}`,
              }))}
              onChange={(v) => setMinMinutes(Number(v))}
            />
            <FilterRow
              label="Positio"
              value="all"
              options={[{ value: 'all', label: 'Kaikki' }]}
              onChange={() => undefined}
              disabledNote="Tulossa Vaihe 2"
            />
          </section>

          {/* 5. Ikäryhmä-tabit + joukkuetason taulukko */}
          <section className="space-y-4">
            <nav className="border-b border-navy-600">
              <div className="flex gap-1 overflow-x-auto">
                {ageGroupTabs.map((tab) => {
                  const isActive = tab.value === ageGroup;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setAgeGroup(tab.value)}
                      className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-ice'
                          : 'text-white/60 hover:text-white/90'
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <span className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-ice" />
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
            <PlayerMinutesTable
              teams={teams}
              ageGroup={ageGroup}
              leagueAvg={leagueAvg}
            />
          </section>

          {/* 6. Yhteenveto */}
          <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {leagueLabels[activeLeague]} {SEASON}
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span>
              <span className="text-white/70 tabular">{teams.length}</span>{' '}
              joukkuetta
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span>
              <span className="text-white/70 tabular">{totalU23Players}</span>{' '}
              U23-pelaajaa pelannut minuutteja
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

interface FilterRowProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabledNote?: string;
}

function FilterRow<T extends string>({
  label,
  value,
  options,
  onChange,
  disabledNote,
}: FilterRowProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-white/40 w-32 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = opt.value === value;
          const isDisabled = !!disabledNote;
          return (
            <button
              key={opt.value}
              onClick={() => !isDisabled && onChange(opt.value)}
              disabled={isDisabled}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                isActive
                  ? 'bg-ice/15 border-ice text-ice'
                  : isDisabled
                    ? 'bg-navy-700/30 border-navy-700 text-white/30 cursor-not-allowed'
                    : 'bg-navy-700/50 border-navy-600 text-white/70 hover:text-white hover:border-navy-500'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {disabledNote && (
          <span className="text-xs text-white/30 self-center ml-2">
            {disabledNote}
          </span>
        )}
      </div>
    </div>
  );
}
