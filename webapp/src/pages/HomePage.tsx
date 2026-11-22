import { useMemo, useState } from 'react';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import { ArrowRight, TrendingUp, Target, Info, ChevronDown } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { naytaNimi } from '@/utils/nimet';
import {
  getYouthStatsAll,
  getYouthAggregation,
  getTrendit,
  getPolku,
  getKaudenKonteksti,
  filterReliableTeams,
  type TrendiKausi,
  type YouthStats,
} from '@/services/api';
import { useValittuKausi, useValittuSarja } from '@/hooks/useKausi';
import { KausiTrendi } from '@/components/KausiTrendi';
import { VertailuRivi } from '@/components/VertailuRivi';
import { NUORET_MAX, CIES_TANSKA_PCT } from '@/constants/ika';
import { pros, luku } from '@/utils/luvut';
import { ResearchCard } from '@/components/ResearchCard';
import { lahdeMaininta, sarjaGenetiivi } from '@/constants/lahde';
import { sarjanRivit } from '@/constants/sarjat';
import { onAkatemia } from '@/constants/akatemiat';
import { muodostaOtsikkolause } from '@/utils/otsikkolause';

// ============================================================
// Etusivu — sivu-uudistus vaihe 3
//
// Rakenne (luonnos "A + B:n otsikko"):
//   1. Otsikkolause kausitrendistä + pieni trendikaavio
//   2. KPI-rivi: peliaika, aloitukset, penkkikerrat, CIES-vertailu
//   3. Seurat nuorten osuuden mukaan (palkit + sarjan taso)
//      ja sivupalstassa eniten peliaikaa; valokeila omana rivinään
//   4. Kausittain: koko trendikaavio ja vertailurivi
//
// Jokainen osio, jonka data puuttuu, jää pois tai näyttää "ei dataa" —
// ei placeholder-lukuja.
// ============================================================

function laskeNuortenOsuus(teams: YouthStats[]): number | null {
  if (teams.length === 0) return null;
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const nuoret = teams.reduce((s, t) => s + t.minuutitNuoret, 0);
  return total > 0 ? (nuoret / total) * 100 : null;
}

function paiva(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

// ------------------------------------------------------------
// Pieni trendikaavio otsikon viereen. Iso kaavio on alempana.
// ------------------------------------------------------------
function MiniTrendi({ pisteet }: { pisteet: TrendiKausi[] }) {
  const arvot = pisteet.filter((p) => p.osuus1721 !== null) as Array<
    TrendiKausi & { osuus1721: number }
  >;
  if (arvot.length < 2) return null;
  const L = 400;
  const K = 130;
  const reuna = 16;
  const min = Math.min(...arvot.map((p) => p.osuus1721));
  const max = Math.max(...arvot.map((p) => p.osuus1721));
  const vali = max - min || 1;
  const x = (i: number) => reuna + (i * (L - 2 * reuna)) / (arvot.length - 1);
  const y = (v: number) => K - reuna - ((v - min) / vali) * (K - 2 * reuna - 10);
  const viiva = arvot.map((p, i) => `${x(i)},${y(p.osuus1721)}`).join(' ');
  const viim = arvot[arvot.length - 1];
  const kuvaus =
    '17–21-vuotiaiden osuus kausittain: ' +
    arvot.map((p) => p.kausi + ' ' + pros(p.osuus1721)).join(', ');
  return (
    <figure className="m-0 w-full max-w-[420px] space-y-1">
      <svg role="img" aria-label={kuvaus} viewBox={`0 0 ${L} ${K + 20}`} className="w-full h-auto">
        <line x1={reuna} y1={K} x2={L - reuna} y2={K} stroke="currentColor" className="text-navy-600" />
        <polyline points={viiva} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-ice" />
        <circle cx={x(arvot.length - 1)} cy={y(viim.osuus1721)} r={5} fill="currentColor" className="text-ice" />
        <text x={reuna} y={K + 16} fontSize={12} fill="currentColor" className="text-white/50 font-mono">
          {arvot[0].kausi}
        </text>
        <text x={L - reuna} y={K + 16} fontSize={12} textAnchor="end" fill="currentColor" className="text-white/50 font-mono">
          {viim.kausi}
        </text>
      </svg>
      <figcaption className="text-xs text-white/50">
        Osuus sarjan minuuttikapasiteetista, %{viim.kesken ? ' · viimeisin kausi kesken' : ''}
      </figcaption>
    </figure>
  );
}

// ------------------------------------------------------------
// KPI-ruutu
// ------------------------------------------------------------
function Kpi({ otsikko, arvo, lisa }: { otsikko: string; arvo: string; lisa?: string | null }) {
  return (
    <div className="bg-navy-700/60 border border-navy-600 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-sm text-white/60">{otsikko}</span>
      <span className="text-3xl font-mono tabular text-white leading-tight">{arvo}</span>
      {lisa && <span className="text-xs text-white/50">{lisa}</span>}
    </div>
  );
}

// ------------------------------------------------------------
// Seurat palkkeina, pystyviiva = sarjan taso
// ------------------------------------------------------------
function SeuraPalkit({ seurat, taso }: { seurat: YouthStats[]; taso: number | null }) {
  const jarjestetty = [...seurat].sort((a, b) => b.osuusNuoret - a.osuusNuoret);
  // Asteikon yläraja: suurin osuus pyöristettynä ylös kymmeneen, vähintään
  // 40 %, jotta Veikkausliigan palkit eivät veny koko leveyteen.
  const yla = Math.max(40, Math.ceil(Math.max(...jarjestetty.map((s) => s.osuusNuoret), 0) / 10) * 10);
  const tasoKohta = taso === null ? null : (taso / yla) * 100;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] gap-x-4 gap-y-2.5 items-center text-sm">
      {jarjestetty.map((s) => {
        const yli = taso !== null && s.osuusNuoret >= taso;
        return (
          <div key={s.teamId} className="contents">
            <SisainenLinkki
              to={`/seurat/${s.teamId}`}
              className="truncate text-white/85 hover:text-ice"
              title={s.teamName}
            >
              {s.teamName}
              {onAkatemia(s.teamName) && <span className="text-white/40"> *</span>}
            </SisainenLinkki>
            <div className="relative h-3 bg-navy-900/60 rounded-sm" aria-hidden="true">
              <div
                className={`h-3 rounded-sm ${yli ? 'bg-ice' : 'bg-ice/40'}`}
                style={{ width: `${Math.min(100, (s.osuusNuoret / yla) * 100)}%` }}
              />
              {tasoKohta !== null && (
                <div className="absolute -top-1 -bottom-1 border-l-2 border-white" style={{ left: `${tasoKohta}%` }} />
              )}
            </div>
            <span className="text-right font-mono tabular text-white">{pros(s.osuusNuoret)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const kausi = useValittuKausi();
  const sarja = useValittuSarja();
  const [infoOpen, setInfoOpen] = useState(false);

  const { data, loading, error } = useApi(async () => {
    const [stats, agg] = await Promise.all([getYouthStatsAll(kausi), getYouthAggregation(kausi, sarja)]);
    return { stats, agg };
  }, [kausi, sarja]);

  // Valokeila. Epäonnistuminen ei kaada sivua: osio jää pois.
  const { data: konteksti } = useApi(async () => {
    try {
      return await getKaudenKonteksti(kausi, sarja);
    } catch (e) {
      console.error('[etusivu] kontekstihaku epäonnistui:', e);
      return null;
    }
  }, [kausi, sarja]);

  const { data: polkuKortti } = useApi(async () => {
    try {
      const p = await getPolku(kausi);
      return p.saatavilla ? p : null;
    } catch (e) {
      console.error('[etusivu] polkumittarin haku epäonnistui:', e);
      return null;
    }
  }, [kausi]);

  // Kaikki sarjat kerralla: otsikkolause, minikaavio, iso kaavio ja
  // vertailurivi lukevat saman vastauksen, joten ne eivät voi näyttää eri
  // lukua samasta kaudesta.
  const { data: trendit } = useApi(async () => {
    try {
      return await getTrendit('kaikki');
    } catch (e) {
      console.error('[etusivu] kausitrendien haku epäonnistui:', e);
      return null;
    }
  }, []);

  const otsikko = useMemo(() => muodostaOtsikkolause(trendit ?? null, sarja, kausi), [trendit, sarja, kausi]);
  const sarjanTrendi = useMemo(
    () => (trendit ?? []).filter((t) => t.sarja === sarja && t.kausi <= kausi).sort((a, b) => a.kausi - b.kausi),
    [trendit, sarja, kausi],
  );

  if (loading) {
    return (
      <div className="px-6 py-20">
        <div className="text-white/40 text-sm">Ladataan kauden tilastoja…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-20">
        <div className="text-red-400/90 text-sm">Datan lataus epäonnistui{error ? `: ${error}` : ''}.</div>
      </div>
    );
  }

  const seurat = filterReliableTeams(sarjanRivit(data.stats, sarja));
  const agg = data.agg;
  const taso = laskeNuortenOsuus(seurat);
  const paaluku = otsikko?.osuus ?? taso;
  const valittuTrendi = (trendit ?? []).find((t) => t.kausi === kausi && t.sarja === sarja) ?? null;

  // Kärkiseurat lauseeseen ilman akatemiajoukkueita: niiden koko tehtävä
  // on peluuttaa nuoria, joten "kärjessä HJK Klubi 04" ei kertoisi mitään.
  const karki = [...seurat]
    .filter((s) => !onAkatemia(s.teamName))
    .sort((a, b) => b.osuusNuoret - a.osuusNuoret)
    .slice(0, 2);
  const akatemioita = seurat.some((s) => onAkatemia(s.teamName));

  const pelaajat = (agg.topYouthPlayers ?? [])
    .filter((p) => p.age !== undefined && p.age <= NUORET_MAX)
    .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
    .slice(0, 5);
  const valokeila = (konteksti?.valokeilassa ?? []).slice(0, 3);
  const tilanne = paiva(konteksti?.tuotuPvm ?? agg.updatedAt);

  const peliajalla = agg.pelaajatPeliajalla ?? null;
  const kaikkiaan = agg.pelaajatNuoret ?? null;

  return (
    <div className="px-6 py-10 md:py-14 space-y-10">
      {/* ---------- 1. Otsikkolause ---------- */}
      <section aria-labelledby="paaotsikko" className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex-1 min-w-[18rem] max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-[0.12em] text-white/50 font-mono">
            {sarja} · kausi {kausi}
            {tilanne ? ` · tilanne ${tilanne}` : ''}
          </p>
          <h1 id="paaotsikko" className="text-3xl md:text-[2.75rem] leading-tight font-medium tracking-tight text-white">
            Nuoret saivat <span className="font-mono text-ice">{pros(paaluku)}</span> peliajasta
            {otsikko?.jatko ? <> — {otsikko.jatko}</> : null}.
          </h1>
          <p className="text-base md:text-lg text-white/70 leading-relaxed">
            17–21-vuotiaiden osuus {sarjaGenetiivi(sarja)} minuuteista.
            {otsikko?.edellinen ? ` Kausi ${otsikko.edellinen.kausi} oli ${pros(otsikko.edellinen.osuus)}.` : ''}
            {otsikko?.kesken ? ' Kausi on kesken.' : ''}
            {karki.length === 2
              ? ` Kärjessä ${karki[0].teamName} (${pros(karki[0].osuusNuoret)}) ja ${karki[1].teamName} (${pros(karki[1].osuusNuoret)}).`
              : ''}
          </p>
        </div>
        <MiniTrendi pisteet={sarjanTrendi} />
      </section>

      {/* ---------- 2. KPI-rivi ---------- */}
      <section aria-label="Kauden luvut" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          otsikko="Peliaikaa saaneet 17–21-vuotiaat"
          arvo={peliajalla === null ? 'ei dataa' : luku(peliajalla)}
          lisa={kaikkiaan !== null ? `${luku(kaikkiaan)} kokoonpanoissa` : null}
        />
        <Kpi
          otsikko="Aloituspaikoista nuorille"
          arvo={pros(agg.aloitusosuus ?? null)}
          lisa={agg.nuortenAloitukset !== undefined ? `${luku(agg.nuortenAloitukset)} aloitusta` : null}
        />
        <Kpi
          otsikko="Kokoonpanossa, ei peliaikaa"
          arvo={agg.penkkikerrat === null || agg.penkkikerrat === undefined ? 'ei dataa' : `${luku(agg.penkkikerrat)} kertaa`}
          lisa={
            agg.pelaajatIlmanMinuutteja !== undefined
              ? `${luku(agg.pelaajatIlmanMinuutteja)} nuorta ilman minuuttiakaan`
              : null
          }
        />
        <Kpi
          otsikko="Alle 21-vuotiaat (CIES-vertailu)"
          arvo={pros(valittuTrendi?.osuusAlle21 ?? null)}
          lisa={`Tanska ${pros(CIES_TANSKA_PCT)} (CIES 2025)`}
        />
      </section>

      {/* ---------- 3. Seurat + sivupalsta ---------- */}
      <div className="flex flex-wrap gap-6 items-start">
        <section
          aria-labelledby="seurat-otsikko"
          className="flex-[999_1_34rem] min-w-0 bg-navy-700/40 border border-navy-600 rounded-xl p-5 md:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="seurat-otsikko" className="text-lg font-medium text-white">
              Seurat nuorten osuuden mukaan
            </h2>
            <SisainenLinkki to="/seurat" className="text-sm text-ice hover:text-white">
              Kaikki seuraluvut →
            </SisainenLinkki>
          </div>
          <p className="text-xs text-white/50">
            Osuus seuran otteluiden minuuteista · valkoinen viiva = sarjan taso {pros(taso)}
            {akatemioita ? ' · * akatemiajoukkue' : ''}
          </p>
          {seurat.length > 0 ? (
            <SeuraPalkit seurat={seurat} taso={taso} />
          ) : (
            <p className="text-sm text-white/60">Seurakohtaista dataa ei ole tältä kaudelta.</p>
          )}
        </section>

        <aside className="flex-[1_1_20rem]">
          <section aria-labelledby="karki" className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 md:p-6">
            <h2 id="karki" className="text-lg font-medium text-white mb-4">
              Eniten peliaikaa
            </h2>
            {pelaajat.length > 0 ? (
              <ol className="space-y-3">
                {pelaajat.map((p, i) => (
                  <li key={p.playerId} className="flex items-center gap-3">
                    <span className="w-5 font-mono text-white/40">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <SisainenLinkki
                        to={`/pelaaja/${p.playerId}`}
                        className="block truncate text-white font-medium hover:text-ice"
                      >
                        {naytaNimi(p.playerName)}
                      </SisainenLinkki>
                      <span className="text-xs text-white/50">
                        {p.teamName} · {p.age} v
                      </span>
                    </div>
                    <span className="font-mono tabular text-white">{luku(p.minutesPlayed)} min</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-white/60">Ei pelaajia tältä kaudelta.</p>
            )}
            <SisainenLinkki to="/nuoret" className="inline-block mt-4 text-sm text-ice hover:text-white">
              Kaikki nuoret →
            </SisainenLinkki>
          </section>

        </aside>
      </div>

      {/* ---------- 3b. Valokeila omana rivinään ----------
          Sivupalstassa valokeila teki palstasta pidemmän kuin seuralista,
          ja seuralaatikon alle jäi tyhjää. Omana rivinään kolme nostoa
          mahtuvat rinnakkain. */}
      {valokeila.length > 0 && (
        <section aria-labelledby="valokeila" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="valokeila" className="text-lg font-medium text-white">
              Valokeilassa
            </h2>
            <span className="text-xs text-white/50">Suurin ero oman ikäryhmän mediaaniin</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {valokeila.map((n) => (
              <SisainenLinkki
                key={n.slug}
                to={`/pelaaja/${n.slug}`}
                className="block bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-2 hover:border-ice/50 transition-colors"
              >
                <p className="text-xs uppercase tracking-[0.08em] text-white/50 font-mono">
                  {n.ika} v · {n.joukkue}
                </p>
                <p className="text-lg text-white font-medium">{naytaNimi(n.etunimi + ' ' + n.sukunimi)}</p>
                <p className="text-sm text-white/80 tabular">{n.rivi.teksti}</p>
              </SisainenLinkki>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 4. Kausittain ---------- */}
      <section aria-labelledby="kausittain" className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 md:p-6 space-y-5">
        <h2 id="kausittain" className="text-lg font-medium text-white">
          Kausittain
        </h2>
        {trendit === null ? (
          <p className="text-sm text-white/60">Kausitrendiä ei voitu ladata juuri nyt. Kauden omat luvut näkyvät yllä.</p>
        ) : (
          <>
            <KausiTrendi trendit={trendit} sarja={sarja} />
            <div className="pt-4 border-t border-navy-600">
              <VertailuRivi osuusAlle21={valittuTrendi?.osuusAlle21 ?? null} jako={valittuTrendi?.alle21Jako ?? null} />
            </div>
          </>
        )}
        <SisainenLinkki
          to="/seurat"
          className="inline-flex items-center gap-1.5 text-sm text-ice hover:text-white font-medium group"
        >
          Seurat tarkemmin
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </SisainenLinkki>
      </section>

      {/* ---------- 5. Tausta ---------- */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          aria-expanded={infoOpen}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-navy-700/60 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-white/90">
            <Info className="w-4 h-4 text-ice shrink-0" aria-hidden="true" />
            Miksi peliaika ratkaisee? — Tutkimusta ja Pohjoismaista kontekstia
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${infoOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {infoOpen && (
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-navy-600 pt-4">
            <ResearchCard
              icon={Target}
              stat={pros(CIES_TANSKA_PCT)}
              title="Tanskan Superliga — kärkeä alle 21-vuotiaiden peliajassa"
              source="CIES Football Observatory 2025"
            />
            {polkuKortti && (
              <ResearchCard
                icon={TrendingUp}
                stat={luku(polkuKortti.debytoi)}
                title={'nuorta debytoi Veikkausliigassa Ykkösliigan kautta kaudeksi ' + polkuKortti.kausiN1}
                source="Nousijat →"
                to="/nousijat"
              />
            )}
          </div>
        )}
      </section>

      <footer className="border-t border-navy-700 pt-5 text-sm text-white/50 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Lähde: <span className="text-white/70">{lahdeMaininta(sarja)}</span>
        </span>
        {tilanne && <span>tilanne {tilanne}</span>}
        <SisainenLinkki to="/about" className="text-ice hover:text-white">
          Miten luvut lasketaan →
        </SisainenLinkki>
      </footer>
    </div>
  );
}
