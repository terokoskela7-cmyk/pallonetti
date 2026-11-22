// ============================================
// YHDEN SEURAN SIVU — /seurat/:teamId
//
// Kolme asiaa, jotka tämä sivu tekee toisin kuin listaus:
//
// 1. Pelaajien kontekstirivit tulevat SAMASTA moottorista kuin
//    pelaajasivulla, ja vertailujoukko on koko sarjan ikäryhmä — ei
//    seuran oma joukko. Muuten "ikäryhmän mediaani" tarkoittaisi eri
//    asiaa eri sivuilla.
// 2. Aikasarja on YKSI yhtenäinen viiva yli sarjojen, eikä se katkea
//    sarjan vaihtuessa — seuran linjan seuraaminen on koko sivun idea.
//    Piirretty suure on SUHDELUKU (seuran osuus ÷ sarjan taso), koska
//    vain se on vertailukelpoinen sarjojen yli: raaka osuus nousee
//    usein sarjasta pudotessa ilman että linja on muuttunut. Raaka
//    osuus ja sarjan taso näkyvät kauden kohdalla numeroina.
// 3. Y-akseli lasketaan seuran OMISTA luvuista, jotta kehitys näkyy.
//    Siksi korkeuksia ei voi verrata /seurat-sivun kaavioihin, ja se
//    sanotaan kaavion alla auki.
// ============================================
import { useParams } from 'react-router-dom';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
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
    <div className="px-6 py-14 space-y-6 animate-pulse">
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
      <Info className="w-10 h-10 text-vaimea mx-auto" />
      <div className="text-white/90 font-medium">Seuraa ei löytynyt</div>
      <div className="text-sm text-toissijainen">
        Tunnisteella <span className="font-mono text-toissijainen">{teamId}</span> ei
        ole seuraa kummassakaan sarjassa.
      </div>
      <SisainenLinkki to="/seurat" className="inline-block text-sm text-ice hover:text-white">
        ← Kaikki seurat
      </SisainenLinkki>
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
  sarjanTaso: number | null;
  suhdeluku: number | null;
  liukuva: number | null;
}

/** Sarjakohtainen pisteen väri. Sama väri myös selitteessä. */
const SARJAN_VARI: Record<string, string> = {
  Veikkausliiga: '#00C8FF',
  Ykkösliiga: '#22C55E',
  'Miesten Ykkönen': '#F59E0B',
};
const TUNTEMATON_VARI = '#8899AA';

function sarjanVari(sarja: string | null): string {
  return sarja === null ? TUNTEMATON_VARI : (SARJAN_VARI[sarja] ?? TUNTEMATON_VARI);
}

/**
 * Pisteen muoto JA väri kertovat sarjan. Kumpikin yksin riittäisi
 * näkevälle lukijalle, mutta väri yksin ei riitä värisokealle — siksi
 * Veikkausliiga on ympyrä, Ykkösliiga neliö ja Miesten Ykkönen kolmio.
 */
function SarjaPiste(props: {
  cx?: number;
  cy?: number;
  payload?: Piste;
}) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.suhdeluku === null) return null;
  const vari = sarjanVari(payload.sarja);
  if (payload.sarja === 'Ykkösliiga') {
    return <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={vari} />;
  }
  if (payload.sarja === 'Miesten Ykkönen') {
    return (
      <polygon
        points={cx + ',' + (cy - 4.5) + ' ' + (cx + 4.5) + ',' + (cy + 3.5) + ' ' + (cx - 4.5) + ',' + (cy + 3.5)}
        fill={vari}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={3.5} fill={vari} />;
}

function Vihje({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as Piste;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs space-y-0.5">
      <div className="text-white/90 font-medium">{d.kausi}</div>
      {d.suhdeluku === null ? (
        <div className="text-vaimea">ei kummassakaan sarjassa</div>
      ) : (
        <>
          <div style={{ color: sarjanVari(d.sarja) }}>{d.sarja}</div>
          <div className="text-white/90 tabular">
            suhdeluku {desimaali(d.suhdeluku)}
          </div>
          <div className="text-vaimea tabular">
            osuus {desimaali(d.osuus)} % · sarjan taso{' '}
            {desimaali(d.sarjanTaso)} %
          </div>
        </>
      )}
      {d.liukuva !== null && (
        <div className="text-vaimea tabular">
          liukuva {desimaali(d.liukuva)}
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
    sarjanTaso: p.sarjanTaso,
    suhdeluku: p.suhdeluku,
    liukuva: data.aikasarja.liukuva[i],
  }));

  const katkoja = pisteet.some((p) => p.suhdeluku === null);

  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs uppercase tracking-wider text-vaimea">
          Suhde sarjan tasoon
        </h2>
        <span className="text-[11px] text-vaimea tabular">
          0–{desimaali(data.ylarajaSuhde)} · {data.aikasarja.kaudet[0]}–
          {data.aikasarja.kaudet[data.aikasarja.kaudet.length - 1]}
        </span>
      </div>

      {/* Tämä on koko sivun tärkein lause: ilman sitä raaka osuus
          luetaan linjan muutoksena, vaikka vain sarja vaihtui. */}
      <p className="text-[11px] text-toissijainen leading-relaxed border-l-2 border-ice/40 pl-3">
        Sarjojen taso eroaa toisistaan, joten raaka osuus nousee usein
        sarjasta pudotessa ilman että seuran linja on muuttunut. Suhdeluku
        kertoo seuran suhteen oman sarjansa tasoon: 1,0 on sarjan taso,
        1,5 puolitoistakertainen siihen nähden.
      </p>

      <div style={{ width: '100%', height: 210 }}>
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
              // Akseli seuran OMISTA luvuista, jotta kehitys näkyy.
              domain={[0, data.ylarajaSuhde]}
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={false}
              width={38}
              // Lukemat puolikkaan välein rajapinnasta: sarjan taso 1,0
              // on aina akselilla, koska se on mittarin vertailukohta.
              ticks={data.suhdeLukemat}
              // Recharts muotoilee pisteellä; sivusto käyttää pilkkua.
              tickFormatter={(v: number) => desimaali(v)}
            />
            <Tooltip content={<Vihje />} cursor={{ stroke: '#00C8FF', strokeOpacity: 0.2 }} />
            {/* Sarjan taso = 1,0. */}
            <ReferenceLine
              y={1}
              stroke="#8899AA"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
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
              dataKey="suhdeluku"
              stroke="#00C8FF"
              strokeWidth={2.5}
              dot={<SarjaPiste />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              // Katko jätetään auki: puuttuva kausi ei ole nolla.
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Selite pisteiden muodolle ja värille. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-vaimea">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: SARJAN_VARI.Veikkausliiga }}
          />
          Veikkausliiga
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5"
            style={{ background: SARJAN_VARI['Ykkösliiga'] }}
          />
          Ykkösliiga
        </span>
        {data.sarjatMukana.includes('Miesten Ykkönen') && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <polygon points="5,0 10,9 0,9" fill={SARJAN_VARI['Miesten Ykkönen']} />
            </svg>
            Miesten Ykkönen
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed border-white/40" />
          sarjan taso 1,0
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-white/30" />
          {data.liukuvaIkkuna} kauden liukuva
        </span>
      </div>

      {/* Kausi kerrallaan: sarja, raaka osuus ja suhdeluku. */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular">
          <thead>
            {/* Kapealla näytöllä näkyvät Kausi, Sarja ja Suhde. Suhde on
                kaavion piirtämä suure, joten se ei saa jäädä piiloon;
                osuus ja sarjan taso ovat sen taustaluvut ja siirtyvät
                vierityksen taakse. */}
            <tr className="text-vaimea text-left">
              <th className="font-medium py-1 pr-2">Kausi</th>
              <th className="font-medium py-1 pr-2">Sarja</th>
              <th className="hidden sm:table-cell font-medium py-1 pr-2 text-right">
                Osuus
              </th>
              <th className="hidden sm:table-cell font-medium py-1 pr-2 text-right whitespace-nowrap">
                Sarjan taso
              </th>
              <th className="font-medium py-1 text-right">Suhde</th>
            </tr>
          </thead>
          <tbody className="text-toissijainen">
            {pisteet.map((p) => (
              <tr key={p.kausi}>
                <td className="py-0.5 pr-2">{p.kausi}</td>
                <td className="py-0.5 pr-2" style={{ color: sarjanVari(p.sarja) }}>
                  {p.sarja ?? 'ei sarjassa'}
                </td>
                <td className="hidden sm:table-cell py-0.5 pr-2 text-right whitespace-nowrap">
                  {p.osuus === null ? '—' : desimaali(p.osuus) + ' %'}
                </td>
                <td className="hidden sm:table-cell py-0.5 pr-2 text-right whitespace-nowrap">
                  {p.sarjanTaso === null ? '—' : desimaali(p.sarjanTaso) + ' %'}
                </td>
                <td className="py-0.5 text-right text-white/90">
                  {p.suhdeluku === null ? '—' : desimaali(p.suhdeluku)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-vaimea leading-relaxed">
        Pystyakseli on seuran oma (0–{desimaali(data.ylarajaSuhde)}), joten
        korkeuksia ei voi verrata silmämääräisesti seuravertailun kaavioihin.
        Liukuva keskiarvo lasketaan suhdeluvusta, ei raa'asta osuudesta, ja se
        vaatii {data.liukuvaIkkuna} peräkkäistä pelattua kautta — sarjan
        vaihdos ei katkaise sitä, katko katkaisee.
        {data.sarjatMukana.includes('Ykkösliiga') &&
          ' Ykkösliigan taso on sarjan taso kaikkine joukkueineen, myös akatemiajoukkueet mukaan luettuina.'}
        {katkoja && ' Katko tarkoittaa kautta, jona seura ei ollut kummassakaan sarjassa.'}
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
        <div className="text-sm text-toissijainen">{error}</div>
      </div>
    );
  }

  if (!data) return <EiLoytynyt teamId={teamId} />;

  const k = data.seurakausi;
  // Suhde sarjan tasoon samasta aikasarjasta kuin kaavio, jotta luku ja
  // kaavio eivät voi kertoa eri asiaa.
  const kaudenPiste = data.aikasarja.pisteet.find((p) => p.kausi === data.kausi) ?? null;
  const suhde = kaudenPiste?.suhdeluku ?? null;

  return (
    <div className="px-6 py-10 md:py-14 space-y-6">
      <div className="flex items-center gap-4 text-sm">
        <SisainenLinkki
          to="/seurat"
          className="inline-flex items-center gap-1.5 text-ice hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Seurat
        </SisainenLinkki>
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
            className="inline-block rounded-md border border-navy-500 bg-navy-700/60 px-2 py-0.5 text-[11px] text-toissijainen"
            title={AKATEMIA_SELITE}
          >
            akatemiajoukkue
          </span>
        )}
        {k === null && (
          <p className="text-sm text-toissijainen">
            {data.nimi} ei pelannut kaudella {data.kausi} kummassakaan
            sarjassa. Kausikehitys näyttää ne kaudet, joilta dataa on.
          </p>
        )}
      </header>

      {k !== null && (
        <section className="bg-navy-700/40 border border-navy-600 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-vaimea px-5 pt-4">
            Kauden {data.kausi} luvut
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-navy-600">
            {[
              ['Nuorten osuus', desimaali(k.osuus) + ' %', 'ice'],
              ['Suhde sarjaan', suhde === null ? '–' : desimaali(suhde) + '×', suhde !== null && suhde >= 1 ? 'aurora' : 'white'],
              [
                'Aloituksista',
                k.aloitusosuus === null || k.aloitusosuus === undefined ? '–' : desimaali(k.aloitusosuus) + ' %',
                'white',
              ],
              [
                'Penkillä ilman peliaikaa',
                k.penkkikerrat === null || k.penkkikerrat === undefined ? '–' : luku(k.penkkikerrat),
                'white',
              ],
              ['Pelaajia', String(k.pelaajia), 'white'],
              ['Keski-ikä', k.keskiIka === null ? 'ei dataa' : desimaali(k.keskiIka), 'white'],
            ].map(([label, arvo, vari]) => (
              <div key={label} className="text-center py-4 px-2 bg-navy-800/90">
                <div className="text-[10px] uppercase tracking-wider text-vaimea mb-1.5">
                  {label}
                </div>
                <div
                  className={
                    'text-xl md:text-2xl font-bold font-mono tabular leading-none ' +
                    (vari === 'ice' ? 'text-ice' : vari === 'aurora' ? 'text-aurora' : 'text-white/90')
                  }
                >
                  {arvo}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-vaimea px-5 pb-4 pt-2">
            Osuus = nuorten minuutit jaettuna joukkueen {k.ottelut} ottelun
            kokonaisminuuteilla. Aloituksista = nuorten osuus {k.ottelut * 11}{' '}
            aloituspaikasta. Penkillä = kerrat, jolloin nuori oli kokoonpanossa
            mutta ei pelannut.
          </p>
        </section>
      )}

      <Aikasarja data={data} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-vaimea">
            17–21-vuotiaat kaudella {data.kausi}
          </h2>
          <span className="text-[11px] text-vaimea tabular">
            {data.pelaajat.length}
          </span>
        </div>

        {data.pelaajat.length === 0 ? (
          <p className="text-sm text-toissijainen">
            Kaudelta {data.kausi} ei ole pelaajia tälle seuralle.
          </p>
        ) : (
          <div className="bg-navy-700/30 border border-navy-600 rounded-xl divide-y divide-navy-600 overflow-hidden">
            {data.pelaajat.map((p) => (
              <SisainenLinkki
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
                      <span className="text-xs text-vaimea">{p.ika} v</span>
                    </div>
                    <div className="mt-1 text-xs text-vaimea tabular">
                      {p.faktat.ottelut} ottelua · aloitti {p.faktat.aloitukset}
                      {typeof p.faktat.penkilla === 'number' ? ` · penkillä ${p.faktat.penkilla}` : ''}
                      {p.faktat.ottelut > 0
                        ? ` · ${Math.round(p.faktat.minuutit / p.faktat.ottelut)} min/ottelu`
                        : ''}
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
                    <div className="text-[10px] uppercase tracking-wider text-vaimea">
                      min
                    </div>
                    {p.faktat.osuusMinuuteista !== null && (
                      <div className="text-[11px] text-vaimea mt-1">
                        {p.faktat.osuusMinuuteista} %
                      </div>
                    )}
                  </div>
                </div>
              </SisainenLinkki>
            ))}
          </div>
        )}
      </section>

      {/* Sarja tulee kaudelta: seura on voinut pelata eri kausina eri
          sarjassa. Jos kautta ei ole, sarjaa ei tiedetä — silloin
          lahdeRivi antaa muodon "sarjan", joka on oikein muttei nimeä
          sarjaa. */}
      <p className="text-xs text-vaimea">
        {lahdeRivi(data.sarja ?? '')}. Kontekstirivit lasketaan samalla
        moottorilla kuin pelaajasivulla, ja vertailujoukko on koko sarjan
        ikäryhmä.
      </p>
    </div>
  );
}
