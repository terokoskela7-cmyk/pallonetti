import { useMemo, useState } from 'react';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import {
  ArrowRight,
  TrendingUp,
  Target,
  Info,
  BarChart3,
  Users,
  Search,
  HelpCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { naytaNimi } from '@/utils/nimet';
import {
  getYouthStatsAll,
  getYouthAggregation,
  getOfficialStats,
  getTrendit,
  getPolku,
  getKaudenKonteksti,
  filterReliableTeams,
  buildU23Players,
  type YouthStats,
} from '@/services/api';
import { useValittuKausi, useValittuSarja } from '@/hooks/useKausi';
import { KausiTrendi } from '@/components/KausiTrendi';
import { VertailuRivi } from '@/components/VertailuRivi';
import {
  NUORET_LABEL,
  NUORET_MAX,
  NUORET_LABEL_PITKA,
  CIES_TANSKA_PCT,
} from '@/constants/ika';
import { pros, luku } from '@/utils/luvut';
import { Hero } from '@/components/Hero';
import { ResearchCard } from '@/components/ResearchCard';
import { EtusivunLause } from '@/components/Valokeila';
import { lahdeMaininta } from '@/constants/lahde';

// ============================================================
// Sivuston rakenne — opastaa käyttäjää
// ============================================================
interface GuideCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

function GuideCard({ to, icon: Icon, title, body }: GuideCardProps) {
  return (
    <SisainenLinkki
      to={to}
      className="bg-navy-700 border border-navy-600 rounded-lg p-4 hover:border-ice/40 transition-colors group"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
        <Icon className="w-4 h-4 text-ice" />
        {title}
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{body}</p>
      <div className="mt-2 text-xs text-ice opacity-0 group-hover:opacity-100 transition-opacity">
        Avaa sivu →
      </div>
    </SisainenLinkki>
  );
}

// ============================================================
// Apulaskennat
// ============================================================
function laskeNuortenOsuus(teams: YouthStats[]): number | null {
  if (teams.length === 0) return null;
  const total = teams.reduce((s, t) => s + t.totalMinutes, 0);
  const u21 = teams.reduce((s, t) => s + t.minuutitNuoret, 0);
  return total > 0 ? (u21 / total) * 100 : null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'juuri nyt';
  if (min < 60) return `${min} min sitten`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} t sitten`;
  const d = Math.floor(h / 24);
  return `${d} pv sitten`;
}

// ============================================================
// Osio 2 — KPI-kortti
// ============================================================
interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  compare?: { text: string; tone: 'red' | 'aurora' | 'neutral' };
  accent?: 'aurora' | 'ice' | 'amber' | 'white';
}

function KpiCard({ label, value, hint, compare, accent = 'white' }: KpiCardProps) {
  const color =
    accent === 'aurora'
      ? 'text-aurora'
      : accent === 'ice'
        ? 'text-ice'
        : accent === 'amber'
          ? 'text-amber-400'
          : 'text-white/90';
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-4 flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
        {label}
      </div>
      <div className={`text-3xl font-bold font-mono tabular leading-none ${color}`}>
        {value}
      </div>
      {compare && (
        <div
          className={`text-xs font-medium mt-2 ${
            compare.tone === 'red'
              ? 'text-red-400'
              : compare.tone === 'neutral'
                ? 'text-white/50'
                : 'text-aurora'
          }`}
        >
          {compare.text}
        </div>
      )}
      {hint && (
        <div className="text-xs text-white/50 mt-2 leading-tight truncate">
          {hint}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sivu
// ============================================================
function CtaLink({ to, label }: { to: string; label: string }) {
  return (
    <SisainenLinkki
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-ice hover:text-white transition-colors font-medium group"
    >
      {label}
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </SisainenLinkki>
  );
}

const MISSIONS = [
  'Teemme nuorten pelaajien peliajan näkyväksi',
  'Autamme seuroja tunnistamaan kehityskohteensa',
  'Rakennamme siltoja nuorten pelaajien ja heidän seuraavan askeleensa välille',
];

export default function HomePage() {
  const kausi = useValittuKausi();
  const sarja = useValittuSarja();
  const [infoOpen, setInfoOpen] = useState(false);

  // Päädata: kolme sarjaa + U23-aggregaatti + viralliset minuutit.
  const { data, loading, error } = useApi(async () => {
    const [stats, agg, official] = await Promise.all([
      getYouthStatsAll(kausi),
      getYouthAggregation(kausi, sarja),
      // Viralliset tilastot on kerätty vain Veikkausliigasta. Toisella
      // sarjalla lista on tyhjä, eikä sitä esitetä puutteena.
      getOfficialStats(kausi).catch(() => ({ data: [], meta: null })),
    ]);
    return { stats, agg, official };
  }, [kausi, sarja]);

  // Etusivun yksi lause. Valinta tehdään rajapinnassa: suurin poikkeama
  // ikäryhmän mediaanista. Epäonnistuminen ei kaada sivua eikä jätä
  // placeholder-lausetta — osio jää silloin kokonaan pois.
  const { data: konteksti } = useApi(async () => {
    try {
      return await getKaudenKonteksti(kausi, sarja);
    } catch (e) {
      console.error('[etusivu] kontekstihaku epäonnistui:', e);
      return null;
    }
  }, [kausi, sarja]);

  // Polkumittarin luku etusivun korttiin. Vain jos siirtymä on olemassa
  // valitulle kaudelle — muuten korttia ei näytetä lainkaan.
  const { data: polkuKortti } = useApi(async () => {
    try {
      const p = await getPolku(kausi);
      return p.saatavilla ? p : null;
    } catch (e) {
      console.error('[etusivu] polkumittarin haku epäonnistui:', e);
      return null;
    }
  }, [kausi]);

  // Kausitrendit: kaikki kaudet kerralla. Samasta vastauksesta tulevat
  // sekä kaavio että vertailurivi, jolloin ne eivät voi näyttää eri
  // lukua samasta kaudesta. Epäonnistuminen ei kaada sivua.
  const { data: trendit } = useApi(async () => {
    try {
      // Kaikki sarjat kerralla: kaavio voi verrata niitä, ja valitun
      // sarjan luvut poimitaan samasta vastauksesta.
      return await getTrendit('kaikki');
    } catch (e) {
      console.error('[etusivu] kausitrendien haku epäonnistui:', e);
      return null;
    }
  }, []);

  // U23 = kaikki topYouthPlayers (backend suodattaa jo U23:iin).
  const kaikkiNuoret = useMemo(() => {
    if (!data) return [];
    return buildU23Players(data.agg.topYouthPlayers, data.official.data).sort(
      (a, b) => b.minutes - a.minutes,
    );
  }, [data]);

  // U21 = U23:sta ikäsuodatettuna.
  const nuoretPelaajat = useMemo(
    () => kaikkiNuoret.filter((p) => p.age <= NUORET_MAX),
    [kaikkiNuoret],
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
        <div className="text-red-400/90 text-sm">
          Datan lataus epäonnistui{error ? `: ${error}` : ''}.
        </div>
      </div>
    );
  }

  // Sama vastaus sisältää molemmat sarjat; valitaan se, jota katsotaan.
  const veikkausliiga = filterReliableTeams(
    (sarja === 'Ykkösliiga'
      ? data.stats.ykkosliiga
      : data.stats.veikkausliiga) ?? [],
  );

  const pct = laskeNuortenOsuus(veikkausliiga);
  const count: number | null =
    veikkausliiga.length === 0
      ? null
      : veikkausliiga.reduce((s, t) => s + t.pelaajatNuoret, 0);
  const players = nuoretPelaajat;
  const topPlayer = players[0] ?? null;

  // Vertailurivi lukee saman trendipisteen kuin kaavio: valitun kauden
  // luvut tulevat yhdestä lähteestä, eivät kahdesta eri hausta.
  const valittuTrendi =
    (trendit ?? []).find((t) => t.kausi === kausi && t.sarja === sarja) ?? null;

  return (
    <div className="px-6 py-10 md:py-16 space-y-14">
      {/* ---------- Osio 1 — Hero ---------- */}
      <Hero
        eyebrow={`${sarja} · Kausi ${kausi}`}
        title={
          <>
            Peliaika on <span className="text-aurora font-medium">kaikki</span>
          </>
        }
        subtitle={
          'Seuraa suomalaisten nuorten pelaajien peliaikaa ' +
          (sarja === 'Ykkösliiga' ? 'Ykkösliigassa' : 'Veikkausliigassa') +
          '. Lähteenä ' +
          lahdeMaininta(sarja) +
          '.'
        }
        height="lg"
      />

      {/* ---------- Osio 1b — Yksi generoitu lause ---------- */}
      <EtusivunLause
        nosto={konteksti?.valokeilassa[0] ?? null}
        tuotuPvm={konteksti?.tuotuPvm ?? null}
        sarja={sarja}
      />

      {/* ---------- Osio 2 — Sivuston rakenne ---------- */}
      <section className="space-y-4">
        <div className="text-xs uppercase tracking-wider text-white/40">
          Mistä löydät mitäkin
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <GuideCard
            to="/peliaika"
            icon={BarChart3}
            title="Analyysi"
            body="Joukkueiden nuorten osuudet, pelaajataulukko filttereillä ja kehityskäyrät. Syväsukellus dataan."
          />
          <GuideCard
            to="/nuoret"
            icon={Users}
            title="Nuoret"
            body="17–21-vuotiaiden valokeila, tilastokärki ja koko pelaajalista haulla."
          />
          <GuideCard
            to="/pelaajat"
            icon={Search}
            title="Kaikki pelaajat"
            body="Hakemisto Veikkausliigan pelaajista virallisista tilastoista. Hae nimellä tai suodata joukkueella."
          />
          <GuideCard
            to="/about"
            icon={HelpCircle}
            title="Tietoa"
            body="Datalähteet, metodologia, ikähaarukan määritelmä ja lukujen varaumat."
          />
        </div>
      </section>

      {/* ---------- Osio 3 — KPI-kortit ---------- */}
      <section className="space-y-4">
        {/* KPI-kortit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            label={'Nuorten osuus peliajasta (' + NUORET_LABEL + ')'}
            value={pros(pct)}
            accent="aurora"
          />
          <KpiCard
            label={'Nuoria pelaajia (' + NUORET_LABEL + ')'}
            value={count === null ? 'ei dataa' : String(count)}
            accent="ice"
            hint={
              count === null ? undefined : 'peliaikaa saaneet 17–21-vuotiaat'
            }
          />
          <KpiCard
            label={'Eniten minuutteja (' + NUORET_LABEL + ')'}
            value={topPlayer ? String(topPlayer.minutes) : '—'}
            accent="ice"
            hint={topPlayer ? `${naytaNimi(topPlayer.playerName)} · ${topPlayer.teamName}` : undefined}
          />
        </div>

        <p className="text-[11px] text-white/40 mt-3 max-w-3xl leading-relaxed">
          Sivuston päämittari on {NUORET_LABEL_PITKA} osuus peliajasta.
          Kansainvälinen vertailu tehdään erikseen alle 21-vuotiaiden luvulla,
          joka on pienempi. Vertailurivi ja sen selite ovat kausitrendin alla.
        </p>
      </section>

      {/* ---------- Osio 4 — Kausitrendi + vertailurivi ---------- */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 space-y-5">
        {trendit === null ? (
          <div className="text-sm text-white/60">
            Kausitrendiä ei voitu ladata juuri nyt. Kauden omat luvut näkyvät
            yllä.
          </div>
        ) : (
          <>
            <KausiTrendi trendit={trendit} sarja={sarja} />
            <div className="pt-4 border-t border-navy-600">
              <VertailuRivi
                osuusAlle21={valittuTrendi?.osuusAlle21 ?? null}
                jako={valittuTrendi?.alle21Jako ?? null}
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 border-t border-navy-600">
          <CtaLink to="/peliaika" label="Katso peliaika-analyysi" />
          <CtaLink to="/nuoret" label="Katso kaikki nuoret pelaajat" />
        </div>
      </section>

      {/* Kierroskohtainen kaavio on poistettu: sen lahde oli ulkoinen
          tilastorajapinta, jota ei enaa kayteta. Tilalle tulee
          tilannekuviin perustuva kayra (B3). */}

      {/* ---------- Osio 6 — INFO-accordion + missio ---------- */}
      <section className="space-y-8">
        <div className="bg-navy-700/40 border border-navy-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-navy-700/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-ice shrink-0" />
              <span className="text-sm font-medium text-white/90">
                Miksi peliaika ratkaisee? — Tutkimusta, tilastoja ja Pohjoismaista kontekstia
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
                infoOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {infoOpen && (
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-navy-600 pt-4">
              {/* Kortteja oli kolme. Kaksi poistettiin, koska niiden
                  lukua ei voinut tarkistaa: "r = 0.77" ilman vuotta ja
                  linkkiä, ja "40×" jonka lähteeksi oli merkitty kolme
                  pelaajan nimeä. Luku ilman lähdettä on väite. */}
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
                  title={
                    'nuorta debytoi Veikkausliigassa Ykkösliigan kautta kaudeksi ' +
                    polkuKortti.kausiN1
                  }
                  source="Polku Veikkausliigaan →"
                  to={'/peliaika?sarja=ykkosliiga&kausi=' + polkuKortti.kausiN1}
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {MISSIONS.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-ice font-mono text-sm mt-0.5 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="text-lg text-white/85 font-light leading-snug">{m}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-navy-700 pt-5 text-xs text-white/40 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {sarja} {kausi}
        </span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          Lähde:{' '}
          <span className="text-white/60">{lahdeMaininta(sarja)}</span>
        </span>
        <span className="w-px h-3 bg-white/20" />
        <span>
          päivitetty{' '}
          <span className="text-white/60">
            {formatRelativeTime(data.agg.updatedAt)}
          </span>
        </span>
      </footer>
    </div>
  );
}
