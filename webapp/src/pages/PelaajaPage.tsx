import { useParams } from 'react-router-dom';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import {
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import { useApi } from '@/hooks/useApi';
import { naytaKokoNimi } from '@/utils/nimet';
import { Kontekstirivit } from '@/components/Kontekstirivit';
import { lahdeRivi } from '@/constants/lahde';
import {
  getSeasonPlayer,
  getPlayerRounds,
  getKonteksti,
  getPelaajanPolku,
  type PolkuKausi,
  type SeasonPlayer,
  type PlayerRound,
  type Siirto,
  type Konteksti,
} from '@/services/api';
import { useValittuKausi, useValittuSarja } from '@/hooks/useKausi';
import { sarjaAvain, sarjanLyhytNimi } from '@/constants/sarjat';

const luku = (n: number) => n.toLocaleString('fi-FI');

function fullName(p: SeasonPlayer): string {
  // Lähteen kirjoitusasu vaihtelee ("OSKU MAUKONEN", "alex RAMULA"),
  // joten näyttöasu tulee yhdestä paikasta. Dataa ei muuteta.
  return naytaKokoNimi(p.etunimi, p.sukunimi);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function LoadingState() {
  return (
    <div className="px-6 py-16 animate-pulse space-y-6">
      <div className="h-8 bg-navy-700/30 rounded w-32" />
      <div className="h-32 bg-navy-700/30 rounded-xl" />
      <div className="h-24 bg-navy-700/30 rounded-xl" />
      <div className="h-40 bg-navy-700/30 rounded-xl" />
    </div>
  );
}

/**
 * Pelaajaa ei ole valitulla kaudella. Tämä ei ole virhe vaan tavallinen
 * tilanne kautta vaihdettaessa: pelaaja on voinut pelata toisella kaudella.
 * Siksi kausi sanotaan auki eikä näytetä tyhjää sivua.
 */
function NotFoundState({ slug, kausi }: { slug: string; kausi: number }) {
  const nimi = slug
    .split('-')
    .filter(Boolean)
    .map((osa) => osa.charAt(0).toUpperCase() + osa.slice(1))
    .join(' ');
  return (
    <div className="px-6 py-16 max-w-md mx-auto text-center space-y-4">
      <Info className="w-10 h-10 text-vaimea mx-auto" />
      <div className="text-white/90 font-medium">
        {nimi || 'Pelaaja'} ei pelannut kaudella {kausi}
      </div>
      <div className="text-sm text-toissijainen">
        Valitse toinen kausi yläpalkista, tai palaa listaukseen.
      </div>
      <div className="text-xs text-vaimea">
        Slug: <span className="font-mono text-toissijainen">{slug}</span>
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <SisainenLinkki
          to="/nuoret"
          className="text-sm text-ice hover:text-white transition-colors"
        >
          ← Nuoret
        </SisainenLinkki>
        <span className="text-white/20">·</span>
        <SisainenLinkki
          to="/pelaajat"
          className="text-sm text-ice hover:text-white transition-colors"
        >
          Pelaajat
        </SisainenLinkki>
      </div>
    </div>
  );
}

interface StatBlockProps {
  label: string;
  value: string;
  /** Pieni selite luvun alla, esim. "24 / 24 ottelua". */
  sub?: string;
  accent?: 'ice' | 'aurora' | 'white';
}

function StatBlock({ label, value, sub, accent = 'white' }: StatBlockProps) {
  const color =
    accent === 'ice'
      ? 'text-ice'
      : accent === 'aurora'
        ? 'text-aurora'
        : 'text-white/90';
  return (
    <div className="text-center py-3">
      <div className="text-[10px] uppercase tracking-wider text-vaimea mb-1.5">
        {label}
      </div>
      <div
        className={`text-xl md:text-2xl font-bold font-mono tabular leading-none ${color}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-vaimea">{sub}</div>}
    </div>
  );
}

/** Sarjan väri minuuttikaaviossa: ylin taso kirkkain. */
const SARJAN_VARI: Record<string, string> = {
  Veikkausliiga: '#00C8FF',
  Ykkösliiga: '#7FDFFF',
  'Miesten Ykkönen': '#8899AA',
};

/**
 * Minuutit kausittain, pinottuna sarjan mukaan (sama kausi voi olla
 * kahdessa sarjassa siirron takia). Luvut tulevat polusta sellaisinaan.
 */
function MinuutitKausittain({ kaudet }: { kaudet: PolkuKausi[] }) {
  const sarjat = Array.from(new Set(kaudet.map((k) => k.sarja))).sort(
    (a, b) => Object.keys(SARJAN_VARI).indexOf(a) - Object.keys(SARJAN_VARI).indexOf(b),
  );
  const vuodet = Array.from(new Set(kaudet.map((k) => k.kausi))).sort((a, b) => a - b);
  const data = vuodet.map((v) => {
    const rivi: Record<string, number | string> = { kausi: String(v) };
    for (const k of kaudet.filter((x) => x.kausi === v)) {
      rivi[sarjanLyhytNimi(k.sarja)] = k.minTotal;
    }
    return rivi;
  });
  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1a2640" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="kausi"
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={{ stroke: '#243350' }}
          />
          <YAxis
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => Number(v).toLocaleString('fi-FI')}
          />
          <Tooltip
            cursor={{ fill: '#00C8FF', fillOpacity: 0.06 }}
            contentStyle={{ background: '#0B1120', border: '1px solid #1a2640', borderRadius: 6 }}
            labelStyle={{ color: '#FFFFFF' }}
            formatter={(arvo) => Number(arvo).toLocaleString('fi-FI') + ' min'}
          />
          {sarjat.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, color: '#A5B4C8' }} iconType="square" />
          )}
          {sarjat.map((s) => (
            <Bar
              key={s}
              dataKey={sarjanLyhytNimi(s)}
              stackId="min"
              fill={SARJAN_VARI[s] ?? '#8899AA'}
              isAnimationActive={false}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Pelaajan polku kausittain, vanhin ensin. Näytettävä kausi korostetaan;
 * muut ovat linkkejä saman pelaajan sivulle kyseisellä kaudella ja sarjalla.
 */
function Polku({
  slug,
  kaudet,
  kausi,
  sarja,
}: {
  slug: string;
  kaudet: PolkuKausi[];
  kausi: number;
  sarja: string;
}) {
  const jarjestys = [...kaudet].sort(
    (a, b) => a.kausi - b.kausi || a.sarja.localeCompare(b.sarja),
  );
  return (
    <ol className="flex flex-col md:flex-row md:flex-wrap gap-3">
      {jarjestys.map((k) => {
        const nykyinen = k.kausi === kausi && k.sarja === sarja;
        const sisalto = (
          <>
            <div className="text-[11px] uppercase tracking-wider text-vaimea font-mono">
              {k.kausi}
              {k.ika > 0 && ` · ${k.ika} v`}
            </div>
            <div className="mt-1 text-white/90 font-medium">
              {sarjanLyhytNimi(k.sarja)}
            </div>
            <div className="text-sm text-toissijainen">
              {(k.joukkueet.length > 0 ? k.joukkueet : [k.joukkue]).join(', ')}
            </div>
            <div className="mt-2 text-xs text-vaimea font-mono tabular">
              {luku(k.minTotal)} min · {k.ottelutTotal} ott · aloitti {k.aloituksetTotal}
              {k.maaliTotal > 0 && ` · ${k.maaliTotal} maalia`}
            </div>
          </>
        );
        const luokka =
          'block rounded-lg border px-4 py-3 md:min-w-[12rem] ' +
          (nykyinen
            ? 'border-ice/50 bg-ice/5'
            : 'border-navy-600 bg-navy-800/40 hover:border-ice/40 transition-colors');
        return (
          <li key={k.kausi + k.sarja} className="md:flex-1">
            {nykyinen ? (
              <div className={luokka} aria-current="page">
                {sisalto}
              </div>
            ) : (
              <SisainenLinkki
                to={`/pelaaja/${slug}?sarja=${sarjaAvain(k.sarja)}&kausi=${k.kausi}`}
                className={luokka}
              >
                {sisalto}
              </SisainenLinkki>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Nimikirjainmerkki. Pelaajakuvia ei nayteta: ainoa kaytossa ollut
 * kuvalahde oli Transfermarkt, jonka kaytto on lopetettu.
 */
function PlayerAvatar({ name, size = 80 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-ice/10 border border-ice/20 flex items-center justify-center font-bold text-ice shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

interface DeltaPoint {
  round: string;
  min: number;
  cumMin: number;
}

function DeltaTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as DeltaPoint;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-sm">
      <div className="text-white/90 font-medium">{d.round}</div>
      <div className="text-ice tabular">{d.min} min</div>
      <div className="text-vaimea text-xs tabular">kum. {d.cumMin}</div>
    </div>
  );
}

/** Kehityskäyrä oikeasta kierrosdatasta.
 *  Delta = tämän kierroksen minuutit = cumMin(K) - cumMin(K-1). */
function ProgressionChart({ rounds }: { rounds: PlayerRound[] }) {
  const data: DeltaPoint[] = rounds.map((r, i) => ({
    round: `K${r.round}`,
    min: i === 0 ? r.cumMin : r.cumMin - rounds[i - 1].cumMin,
    cumMin: r.cumMin,
  }));

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#1a2640" strokeDasharray="2 4" />
          <XAxis
            dataKey="round"
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={{ stroke: '#243350' }}
          />
          <YAxis
            stroke="#8899AA"
            tick={{ fontSize: 11, fill: '#A5B4C8' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 90]}
            ticks={[0, 30, 60, 90]}
            unit=" min"
          />
          <Tooltip
            content={<DeltaTooltip />}
            cursor={{ stroke: '#00C8FF', strokeOpacity: 0.3 }}
          />
          <Line
            type="monotone"
            dataKey="min"
            stroke="#00C8FF"
            strokeWidth={2.5}
            dot={{ fill: '#00C8FF', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Siirto- tai lainamerkinta (B5).
 *
 * Merkinta tehdaan vain, kun rivilla on julkinen lahde, ja lahde nakyy
 * linkkina. Siirtosummia ei nayteta. Jos lahde ei kerro tarkkaa paivaa,
 * naytetaan "kesa {kausi}" eika keksita paivaa.
 */
function SiirtoMerkinta({ siirto, kausi }: { siirto: Siirto; kausi: number }) {
  const otsikko =
    siirto.tyyppi === 'laina' ? 'Lainalla' : 'Siirtynyt kesken kauden';
  const paiva = siirto.pvm
    ? new Date(siirto.pvm).toLocaleDateString('fi-FI', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      })
    : `kesä ${kausi}`;
  return (
    <div className="mt-3 rounded-lg border border-aurora/30 bg-aurora/5 px-3 py-2 text-sm">
      <span className="text-white/90">
        {otsikko}: {siirto.uusi_seura}, {siirto.maa}
      </span>
      <span className="text-vaimea"> · {paiva}</span>
      <a
        href={siirto.lahde_url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 inline-flex items-center gap-1 text-ice hover:text-white transition-colors"
      >
        Lähde
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

export default function PelaajaPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';
  const kausi = useValittuKausi();
  const sarja = useValittuSarja();
  // Pääasiallinen lähde: Firestore-pelaaja slug:lla.
  const { data: player, loading, error } = useApi(
    () => getSeasonPlayer(kausi, slug, sarja),
    [slug, kausi, sarja],
  );

  // Kontekstilauseet. Backend muodostaa lauseet kauden datasta; selain
  // ei laske eika sanoita mitaan. Virhe ei kaada sivua: konteksti on
  // lisaa lukujen paalle, ei niiden korvaaja.
  const { data: konteksti } = useApi(
    async () => {
      if (!slug) return null as Konteksti | null;
      try {
        return await getKonteksti(kausi, slug, sarja);
      } catch {
        return null as Konteksti | null;
      }
    },
    [slug, kausi, sarja],
  );

  // Kierrosdata kehityskäyrää varten.
  const { data: rounds } = useApi(
    async () => {
      if (!slug) return [] as PlayerRound[];
      try {
        return await getPlayerRounds(kausi, slug, sarja);
      } catch {
        return [] as PlayerRound[];
      }
    },
    [slug, kausi, sarja],
  );

  // Polku muista kausista ja sarjoista. Virhe ei kaada sivua.
  const { data: polku } = useApi(
    async () => {
      if (!slug) return [] as PolkuKausi[];
      try {
        return await getPelaajanPolku(slug, kausi, sarja);
      } catch {
        return [] as PolkuKausi[];
      }
    },
    [slug, kausi, sarja],
  );

  const name = player ? fullName(player) : '';

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <Info className="w-10 h-10 text-red-400/80 mx-auto mb-4" />
        <div className="text-white/90 font-medium mb-2">
          Datan lataus epäonnistui
        </div>
        <div className="text-sm text-toissijainen">{error}</div>
      </div>
    );
  }
  if (!player) return <NotFoundState slug={slug} kausi={kausi} />;

  const hasRounds = (rounds?.length ?? 0) > 0;
  const ott = player.ottelutTotal;
  const kok = typeof player.kokoonpanossaTotal === 'number' ? player.kokoonpanossaTotal : null;
  // Aloitusosuus pelaajalle = aloitukset / pelatut ottelut.
  const aloitusosuus = ott > 0 ? Math.round((player.aloituksetTotal / ott) * 100) : null;
  const penkilla = kok !== null ? Math.max(0, kok - ott) : null;
  const minOttelu = ott > 0 ? Math.round(player.minTotal / ott) : null;

  return (
    <div className="px-6 py-10 md:py-14 space-y-6">
      <div className="flex items-center gap-4 text-sm">
        <SisainenLinkki
          to="/nuoret"
          className="inline-flex items-center gap-1.5 text-ice hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Nuoret
        </SisainenLinkki>
        <span className="text-white/20">·</span>
        <SisainenLinkki
          to="/pelaajat"
          className="text-ice hover:text-white transition-colors"
        >
          Pelaajat
        </SisainenLinkki>
      </div>

      {/* Header: avatar + nimi + meta */}
      <header className="bg-navy-700/40 border border-navy-600 rounded-xl p-6 flex items-start gap-5">
        <PlayerAvatar name={name} size={80} />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-1 font-medium">
            {sarja} · Kausi {kausi}
          </div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight leading-tight">
            {name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-toissijainen">
            <span>{player.joukkue}</span>
            {player.ika > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span>{player.ika} v</span>
              </>
            )}
          </div>
          {player.siirto && (
            <SiirtoMerkinta siirto={player.siirto} kausi={kausi} />
          )}
        </div>
      </header>

      {/* Konteksti — tarina ennen numeroita */}
      <Kontekstirivit konteksti={konteksti ?? null} />

      {/* Päätilastot */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl">
        <div className="text-xs uppercase tracking-wider text-vaimea px-5 pt-4">
          Kauden tilastot
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-navy-600">
          <StatBlock label="Minuutit" value={luku(player.minTotal)} accent="ice" />
          <StatBlock label="Ottelut" value={String(ott)} sub={`aloitti ${player.aloituksetTotal}`} />
          <StatBlock
            label="Aloitusosuus"
            value={aloitusosuus !== null ? `${aloitusosuus} %` : '–'}
            sub={`${player.aloituksetTotal} / ${ott} ottelua`}
          />
          <StatBlock
            label="Penkillä ilman peliaikaa"
            value={penkilla !== null ? String(penkilla) : '–'}
            sub={kok !== null ? `${kok} kertaa kokoonpanossa` : 'kokoonpanotieto puuttuu'}
          />
          <StatBlock
            label="Min / ottelu"
            value={minOttelu !== null ? String(minOttelu) : '–'}
            sub={`maalit ${player.maaliTotal}`}
            accent="aurora"
          />
        </div>
      </section>

      {/* Polku — kaudet ja sarjat, joissa sama pelaaja esiintyy */}
      <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-vaimea">Polku</h2>
        {(polku?.length ?? 0) > 1 ? (
          <>
            <MinuutitKausittain kaudet={polku!} />
            <Polku slug={slug} kaudet={polku!} kausi={kausi} sarja={sarja} />
          </>
        ) : (
          <p className="text-sm text-vaimea">
            Polku näytetään, kun pelaaja löytyy useamman kauden tai sarjan datasta.
          </p>
        )}
      </section>

      {/* Kehityskäyrä — minuutit per kierros (delta kierrosdatasta).
          Näytetään vain, kun kierrosdataa on: kausituonti ei tuota
          kierroksia, joten tyhjä "tulossa"-laatikko ei kertonut mitään. */}
      {hasRounds && (
        <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <h2 className="text-xs uppercase tracking-wider text-vaimea">
              Kehityskäyrä — minuutit per kierros
            </h2>
            <span className="text-[10px] text-vaimea uppercase tracking-wider">
              {rounds!.length} kierrosta
            </span>
          </div>
          <ProgressionChart rounds={rounds!} />
        </section>
      )}

      <div className="text-xs text-vaimea pt-1">
        {lahdeRivi(sarja)}
      </div>
    </div>
  );
}
