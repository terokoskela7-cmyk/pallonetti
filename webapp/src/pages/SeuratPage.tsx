// ============================================
// SEURAVERTAILU — /seurat
//
// Kaksi näkymää samasta datasta: valitun kauden taulukko ja
// kausikehitys pieninä kaavioina. Molemmat luvut tulevat samasta
// backend-laskennasta, joten taulukko ja kaavio eivät voi kertoa eri
// lukua samasta seurasta ja kaudesta.
//
// Akatemiajoukkueita EI piiloteta: ne ovat oikeita joukkueita. Ne
// merkitään, ja sarjan taso näytetään kahtena lukuna — kaikki ja ilman
// akatemioita — jotta lukija näkee eron itse.
// ============================================
import { useMemo } from 'react';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import { Info } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import {
  getSeuratKausi,
  getSeuratTrendit,
  type Seurakausi,
} from '@/services/api';
import { useValittuKausi, useValittuSarja } from '@/hooks/useKausi';
import { NUORET_LABEL_PITKA } from '@/constants/ika';
import { AKATEMIA_SELITE } from '@/constants/akatemiat';
import { lahdeRivi } from '@/constants/lahde';
import { desimaali, luku } from '@/utils/luvut';
import { SeuraKaaviot } from '@/components/SeuraKaaviot';

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-40 bg-navy-700/30 rounded-xl" />
      <div className="h-72 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 bg-navy-700/30 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function Rivi({
  s,
  ylaraja,
  taso,
}: {
  s: Seurakausi;
  ylaraja: number;
  taso: number | null;
}) {
  const leveys = s.osuus === null ? 0 : Math.min(100, (s.osuus / ylaraja) * 100);
  const tasoKohta = taso === null ? null : Math.min(100, (taso / ylaraja) * 100);
  const yli = s.osuus !== null && taso !== null && s.osuus >= taso;
  const suhde = s.osuus !== null && taso ? s.osuus / taso : null;
  return (
    <tr className="hover:bg-navy-700/40 transition-colors">
      <td className="px-4 py-2.5">
        {/* Seuran nimi vie seuran omalle sivulle. Tunniste on sama kuin
            siellä, joten linkki ei voi osoittaa eri seuraan. */}
        <SisainenLinkki
          to={`/seurat/${s.tunniste}`}
          className="text-white font-medium whitespace-nowrap hover:text-ice transition-colors"
        >
          {s.nimi}
        </SisainenLinkki>
        {s.akatemia && (
          <span
            className="ml-2 inline-block rounded border border-navy-500 bg-navy-700/60 px-1.5 text-[10px] text-white/50 align-middle"
            title={AKATEMIA_SELITE}
          >
            akatemiajoukkue
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 min-w-[14rem]">
        {s.osuus === null ? (
          <span className="text-white/40 text-xs">ei dataa</span>
        ) : (
          <span className="flex items-center gap-3">
            <span className="relative h-3 rounded-sm bg-navy-900/60 flex-1" aria-hidden="true">
              <span
                className={'block h-full rounded-sm ' + (yli ? 'bg-ice' : 'bg-ice/40')}
                style={{ width: leveys + '%' }}
              />
              {tasoKohta !== null && (
                <span
                  className="absolute -top-1 -bottom-1 border-l-2 border-white"
                  style={{ left: tasoKohta + '%' }}
                />
              )}
            </span>
            <span className="text-white font-mono tabular w-16 text-right">
              {desimaali(s.osuus)} %
            </span>
          </span>
        )}
      </td>
      <td
        className={
          'px-3 py-2.5 text-right font-mono tabular ' +
          (suhde !== null && suhde >= 1 ? 'text-aurora' : 'text-white/70')
        }
      >
        {suhde === null ? '–' : desimaali(suhde) + '×'}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular text-white/80">
        {s.aloitusosuus === null || s.aloitusosuus === undefined
          ? '–'
          : desimaali(s.aloitusosuus) + ' %'}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular text-white/80">
        {s.penkkikerrat === null || s.penkkikerrat === undefined ? '–' : luku(s.penkkikerrat)}
      </td>
      <td className="hidden sm:table-cell px-3 py-2.5 text-right font-mono tabular text-white/70">
        {s.ottelut}
      </td>
      <td className="hidden md:table-cell px-3 py-2.5 text-right font-mono tabular text-white/70">
        {luku(s.nuortenMinuutit)}
      </td>
      <td className="hidden md:table-cell px-3 py-2.5 text-right font-mono tabular text-white/70">
        {s.pelaajia}
      </td>
      <td className="hidden lg:table-cell px-4 py-2.5 text-right font-mono tabular text-white/70">
        {s.keskiIka === null ? 'ei dataa' : desimaali(s.keskiIka)}
      </td>
    </tr>
  );
}

export default function SeuratPage() {
  const kausi = useValittuKausi();
  const sarja = useValittuSarja();

  const { data: kausiData, loading, error } = useApi(
    () => getSeuratKausi(kausi, sarja),
    [kausi, sarja],
  );

  // Kausikehitys on oma kyselynsä: se kattaa kaikki kaudet, eikä sen
  // epäonnistuminen saa kaataa kauden taulukkoa.
  const { data: trendit } = useApi(async () => {
    try {
      return await getSeuratTrendit(sarja);
    } catch (e) {
      console.error('[seurat] trendihaku epäonnistui:', e);
      return null;
    }
  }, [sarja]);

  const seurat = useMemo(
    () =>
      (kausiData?.seurat ?? [])
        .slice()
        .sort((a, b) => (b.osuus ?? -1) - (a.osuus ?? -1)),
    [kausiData],
  );

  /**
   * Kausikehitys vain valitun kauden seuroista.
   *
   * Trendirajapinta palauttaa KAIKKI sarjassa joskus pelanneet seurat —
   * Veikkausliigassa 18, vaikka kaudella pelaa 12. Se on oikein
   * rajapinnalta, mutta kauden näkymässä RoPS (viimeksi 2020) ja HIFK
   * (2022) luetaan sarjan nykyisiksi joukkueiksi. Ne eivät katoa: niillä
   * on omat sivunsa, ja historia on tallessa.
   */
  const kaudenTunnisteet = useMemo(
    () => new Set(seurat.map((s) => s.tunniste)),
    [seurat],
  );

  const kaudenTrendit = useMemo(
    () => (trendit?.seurat ?? []).filter((t) => kaudenTunnisteet.has(t.tunniste)),
    [trendit, kaudenTunnisteet],
  );

  const aiempiaSeuroja = (trendit?.seurat.length ?? 0) - kaudenTrendit.length;

  // Taulukon palkeille sama yläraja kuin kaavioissa. Luku tulee
  // rajapinnasta; ennen trendien latautumista käytetään kauden omaa
  // maksimia, jottei palkki hyppää myöhemmin eri mittakaavaan.
  const ylaraja = useMemo(() => {
    if (trendit) return trendit.ylaraja;
    const arvot = seurat
      .map((s) => s.osuus)
      .filter((x): x is number => x !== null);
    return Math.ceil(Math.max(10, ...arvot) / 10) * 10;
  }, [seurat, trendit]);

  const viiva = kausiData?.vertailuviivat[0] ?? null;
  const taso = viiva?.kaikki ?? null;
  const yliTason =
    taso === null ? 0 : seurat.filter((x) => x.osuus !== null && x.osuus >= taso).length;

  if (loading) return <LoadingSkeleton />;

  if (error || !kausiData) {
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
    <div className="px-6 py-10 md:py-16 space-y-10 max-w-6xl mx-auto">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.12em] text-white/50 font-mono">
            {sarja} · kausi {kausi}
          </p>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Seurat</h1>
          <p className="text-base text-white/70 leading-relaxed">
            Kuinka suuren osan seuran otteluminuuteista {NUORET_LABEL_PITKA} pelasivat.
            Suhde kertoo, montako kertaa sarjan tason seura on.
          </p>
        </div>
        {viiva && (
          <dl className="flex flex-wrap gap-8">
            <div>
              <dt className="text-sm text-white/60">Sarjan taso</dt>
              <dd className="text-3xl font-mono tabular text-white">{desimaali(viiva.kaikki)} %</dd>
            </div>
            {viiva.ilmanAkatemioita !== null && (
              <div>
                <dt className="text-sm text-white/60">Ilman akatemiajoukkueita</dt>
                <dd className="text-3xl font-mono tabular text-white">
                  {desimaali(viiva.ilmanAkatemioita)} %
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-white/60">Yli sarjan tason</dt>
              <dd className="text-3xl font-mono tabular text-white">
                {yliTason} / {seurat.length}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* Kauden taulukko */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-white/40">
          Kausi {kausi}
        </h2>
        {seurat.length === 0 ? (
          <p className="text-sm text-white/60">
            Kaudelta {kausi} ei ole seuradataa tässä sarjassa.
          </p>
        ) : (
          <div className="overflow-x-auto border border-navy-600 rounded-xl bg-navy-700/30">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {sarja} {kausi}: seurat nuorten osuuden mukaan
              </caption>
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-white/50 border-b border-navy-600">
                  <th scope="col" className="text-left font-medium px-4 py-2.5">Seura</th>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">
                    Osuus · viiva = sarjan taso
                  </th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Suhde</th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Aloituksista</th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Penkillä*</th>
                  <th scope="col" className="hidden sm:table-cell text-right font-medium px-3 py-2.5">Ott</th>
                  <th scope="col" className="hidden md:table-cell text-right font-medium px-3 py-2.5">
                    Nuorten min
                  </th>
                  <th scope="col" className="hidden md:table-cell text-right font-medium px-3 py-2.5">
                    Pelaajia
                  </th>
                  <th scope="col" className="hidden lg:table-cell text-right font-medium px-4 py-2.5">
                    Keski-ikä
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {seurat.map((s) => (
                  <Rivi key={s.tunniste} s={s} ylaraja={ylaraja} taso={taso} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Kausikehitys pieninä kaavioina */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Kausikehitys
          </h2>
          {trendit && (
            <span className="text-[11px] text-white/40 tabular">
              {kaudenTrendit.length} seuraa · {trendit.kaudet[0]}–
              {trendit.kaudet[trendit.kaudet.length - 1]}
            </span>
          )}
        </div>
        {trendit === null || trendit === undefined ? (
          <p className="text-sm text-white/60">Kausikehitystä ei saatu haettua.</p>
        ) : (
          <>
            <SeuraKaaviot
              seurat={kaudenTrendit}
              kaudet={trendit.kaudet}
              vertailuviivat={trendit.vertailuviivat}
              liukuvaIkkuna={trendit.liukuvaIkkuna}
              ylaraja={trendit.ylaraja}
            />
            {aiempiaSeuroja > 0 && (
              <p className="text-[11px] text-white/40 leading-relaxed">
                Kaaviot ovat kauden {kausi} seuroista. {aiempiaSeuroja}{' '}
                {aiempiaSeuroja === 1 ? 'seura on' : 'seuraa on'} pelannut
                sarjassa aiemmin mutta ei tällä kaudella; niiden historia on
                tallessa omilla sivuillaan.
              </p>
            )}
          </>
        )}
      </section>

      <p className="text-xs text-white/40">
        {lahdeRivi(sarja)}. Osuus = nuorten minuutit jaettuna joukkueen
        otteluiden kokonaisminuuteilla. Aloituksista = nuorten osuus seuran
        aloituspaikoista (ottelut × 11). *Penkillä = kerrat, jolloin
        17–21-vuotias oli kokoonpanossa mutta ei pelannut.
      </p>
    </div>
  );
}
