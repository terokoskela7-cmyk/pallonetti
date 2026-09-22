// ============================================
// YHDEN SEURAN SIVU — /seurat/:teamId
//
// Kolme asiaa, jotka tämä sivu tekee toisin kuin listaus:
//
// 1. Pelaajien kontekstirivit tulevat SAMASTA moottorista kuin
//    pelaajasivulla, ja vertailujoukko on koko sarjan ikäryhmä — ei
//    seuran oma joukko. Muuten "ikäryhmän mediaani" tarkoittaisi eri
//    asiaa eri sivuilla.
// 2. Aikasarja kulkee yli sarjojen. Sarjojen lukuja ei lasketa yhteen:
//    jokainen kausi kertoo oman sarjansa, ja sarjan vaihdos näkyy.
// 3. Y-akselin yläraja tulee rajapinnasta — sama luku kuin
//    /seurat-sivulla, jottei lukija vertaa kahta eri mittakaavaa.
// ============================================
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import { useApi } from '@/hooks/useApi';
import { naytaKokoNimi } from '@/utils/nimet';
import { getSeuranSivu, type SeuranSivu, type Siirto } from '@/services/api';
import { useValittuKausi } from '@/hooks/useKausi';
import { AKATEMIA_SELITE } from '@/constants/akatemiat';
import { lahdeRivi } from '@/constants/lahde';
import { desimaali, luku } from '@/utils/luvut';
import { Kontekstirivit } from '@/components/Kontekstirivit';

/** Kontekstirivit listassa: peliaikarivit ensin, enintään kaksi. */
const TIIVIS_RIVEJA = 2;

function LoadingSkeleton() {
  return (
    <div className="px-6 py-14 max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 bg-navy-700/30 rounded w-32" />
      <div className="h-28 bg-navy-700/30 rounded-xl" />
      <div className="h-56 bg-navy-700/30 rounded-xl" />
      <div className="h-72 bg-navy-700/30 rounded-xl" />
    </div>
  );
}

/** Tuntematon tunniste. Sivu kertoo sen suoraan eikä näytä tyhjää. */
function EiLoytynyt({ teamId }: { teamId: string }) {
  return (
    <div className="px-6 py-16 max-w-md mx-auto text-center space-y-4">
      <Info className="w-10 h-10 text-white/40 mx-auto" />
      <div className="text-white/90 font-medium">Seuraa ei löytynyt</div>
      <div className="text-sm text-white/60">
        Tunnisteella <span className="font-mono text-white/70">{teamId}</span> ei
        ole seuraa kummassakaan sarjassa.
      </div>
      <Link to="/seurat" className="inline-block text-sm text-ice hover:text-white">
        ← Kaikki seurat
      </Link>
    </div>
  );
}

function SiirtoMerkki({ siirto }: { siirto: Siirto }) {
  const otsikko =
    siirto.tyyppi === 'laina' ? 'Lainalla' : 'Siirtynyt kesken kauden';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-aurora/30 bg-aurora/5 px-2 py-0.5 text-[11px] text-white/80">
      <span>
        {otsikko}: {siirto.uusi_seura}, {siirto.maa}
      </span>
      <a
        href={siirto.lahde_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-ice hover:text-white transition-colors"
      >
        Lähde
        <ExternalLink className="w-3 h-3" />
      </a>
    </span>
  );
}

interface Piste {
  kausi: number;
  sarja: string | null;
  osuus: number | null;
  liukuva: number | null;
}

function Vihje({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as Piste;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs">
      <div className="text-white/90 font-medium">{d.kausi}</div>
      {d.osuus === null ? (
        <div className="text-white/50">ei kummassakaan sarjassa</div>
      ) : (
        <>
          <div className="text-ice tabular">{desimaali(d.osuus)} %</div>
          <div className="text-white/50">{d.sarja}</div>
        </>
      )}
      {d.liukuva !== null && (
        <div className="text-white/50 tabular">
          liukuva {desimaali(d.liukuva)} %
        </div>
      )}
    </div>
  );
}

function Aikasarja({ data }: { data: SeuranSivu }) {
  const pisteet: Piste[] = data.aikasarja.pisteet.map((p, i) => ({
    kausi: p.kausi,
    sarja: p.sarja,
    osuus: p.osuus,
    liukuva: data.aikasarja.liukuva[i],
  }));

  const katkoja = pisteet.some((p) => p.osuus === null);

  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs uppercase tracking-wider text-white/40">
          Kausikehitys
        </h2>
        <span className="text-[11px] text-white/40 tabular">
          {data.aikasarja.kaudet[0]}–
          {data.aikasarja.kaudet[data.aikasarja.kaudet.length - 1]}
        </span>
      </div>

      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pisteet} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="kausi"
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={{ stroke: '#243350' }}
            />
            <YAxis
              // Sama yläraja kuin /seurat-sivulla, rajapinnasta.
              domain={[0, data.ylaraja]}
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={false}
              width={46}
              unit=" %"
            />
            <Tooltip content={<Vihje />} cursor={{ stroke: '#00C8FF', strokeOpacity: 0.2 }} />
            <Line
              type="monotone"
              dataKey="liukuva"
              stroke="#8899AA"
              strokeWidth={1.5}
              strokeOpacity={0.55}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="osuus"
              stroke="#00C8FF"
              strokeWidth={2.5}
              dot={{ fill: '#00C8FF', r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              // Katko jätetään auki: puuttuva kausi ei ole nolla.
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sarja kauden kohdalla. Sarjojen lukuja ei lasketa yhteen, joten
          jokainen kausi kertoo, missä seura silloin pelasi. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/50 tabular">
        {data.aikasarja.pisteet.map((p) => (
          <span key={p.kausi}>
            {p.kausi}{' '}
            <span className={p.sarja === null ? 'text-white/30' : 'text-white/70'}>
              {p.sarja ?? 'ei sarjassa'}
            </span>
          </span>
        ))}
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Pystyakseli on sama kuin seurojen vertailussa (0–{data.ylaraja} %).
        Harmaa viiva on {data.liukuvaIkkuna} kauden liukuva keskiarvo.
        {katkoja && ' Katko tarkoittaa kautta, jona seura ei ollut kummassakaan sarjassa.'}
        {data.aikasarja.useitaSarjoja &&
          ' Seura on pelannut molemmissa sarjoissa, eikä sarjojen lukuja lasketa yhteen: osuus on aina osuus oman joukkueen otteluiden minuuteista.'}
      </p>
    </section>
  );
}

export default function SeuraPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId ?? '';
  const kausi = useValittuKausi();

  const { data, loading, error } = useApi(
    () => getSeuranSivu(kausi, teamId),
    [kausi, teamId],
  );

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <Info className="w-10 h-10 text-red-400/80 mx-auto mb-4" />
        <div className="text-white/90 font-medium mb-2">
          Datan lataus epäonnistui
        </div>
        <div className="text-sm text-white/60">{error}</div>
      </div>
    );
  }

  if (!data) return <EiLoytynyt teamId={teamId} />;

  const k = data.seurakausi;

  return (
    <div className="px-6 py-10 md:py-14 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm">
        <Link
          to="/seurat"
          className="inline-flex items-center gap-1.5 text-ice hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Seurat
        </Link>
      </div>

      <header className="bg-navy-700/40 border border-navy-600 rounded-xl p-6 space-y-2">
        <div className="text-xs uppercase tracking-[0.2em] text-ice font-medium">
          {data.sarja ?? 'Ei sarjassa'} · Kausi {data.kausi}
        </div>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight leading-tight">
          {data.nimi}
        </h1>
        {data.akatemia && (
          <span
            className="inline-block rounded-md border border-navy-500 bg-navy-700/60 px-2 py-0.5 text-[11px] text-white/60"
            title={AKATEMIA_SELITE}
          >
            akatemiajoukkue
          </span>
        )}
        {k === null && (
          <p className="text-sm text-white/60">
            {data.nimi} ei pelannut kaudella {data.kausi} kummassakaan
            sarjassa. Kausikehitys näyttää ne kaudet, joilta dataa on.
          </p>
        )}
      </header>

      {k !== null && (
        <section className="bg-navy-700/40 border border-navy-600 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-white/40 px-5 pt-4">
            Kauden {data.kausi} luvut
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-navy-600">
            {[
              ['Osuus', desimaali(k.osuus) + ' %', 'ice'],
              ['Minuutit', luku(k.nuortenMinuutit), 'white'],
              ['Pelaajia', String(k.pelaajia), 'white'],
              ['Keski-ikä', k.keskiIka === null ? 'ei dataa' : desimaali(k.keskiIka), 'white'],
            ].map(([label, arvo, vari]) => (
              <div key={label} className="text-center py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                  {label}
                </div>
                <div
                  className={
                    'text-xl md:text-2xl font-bold font-mono tabular leading-none ' +
                    (vari === 'ice' ? 'text-ice' : 'text-white/90')
                  }
                >
                  {arvo}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/40 px-5 pb-4 pt-2">
            Osuus = nuorten minuutit jaettuna joukkueen {k.ottelut} ottelun
            kokonaisminuuteilla.
          </p>
        </section>
      )}

      <Aikasarja data={data} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            17–21-vuotiaat kaudella {data.kausi}
          </h2>
          <span className="text-[11px] text-white/40 tabular">
            {data.pelaajat.length}
          </span>
        </div>

        {data.pelaajat.length === 0 ? (
          <p className="text-sm text-white/60">
            Kaudelta {data.kausi} ei ole pelaajia tälle seuralle.
          </p>
        ) : (
          <div className="bg-navy-700/30 border border-navy-600 rounded-xl divide-y divide-navy-600 overflow-hidden">
            {data.pelaajat.map((p) => (
              <Link
                key={p.slug}
                to={`/pelaaja/${p.slug}`}
                className="block px-4 py-3 hover:bg-navy-700/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-white/95">
                        {naytaKokoNimi(p.etunimi, p.sukunimi)}
                      </span>
                      <span className="text-xs text-white/40">{p.ika} v</span>
                    </div>
                    <div className="mt-1">
                      <Kontekstirivit konteksti={p} maxRiveja={TIIVIS_RIVEJA} tiivis />
                    </div>
                    {p.siirto && (
                      <div className="mt-1.5">
                        <SiirtoMerkki siirto={p.siirto} />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 tabular">
                    <div className="text-ice font-mono">{p.faktat.minuutit}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">
                      min
                    </div>
                    {p.faktat.osuusMinuuteista !== null && (
                      <div className="text-[11px] text-white/50 mt-1">
                        {p.faktat.osuusMinuuteista} %
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Sarja tulee kaudelta: seura on voinut pelata eri kausina eri
          sarjassa. Jos kautta ei ole, sarjaa ei tiedetä — silloin
          lahdeRivi antaa muodon "sarjan", joka on oikein muttei nimeä
          sarjaa. */}
      <p className="text-xs text-white/40">
        {lahdeRivi(data.sarja ?? '')}. Kontekstirivit lasketaan samalla
        moottorilla kuin pelaajasivulla, ja vertailujoukko on koko sarjan
        ikäryhmä.
      </p>
    </div>
  );
}
