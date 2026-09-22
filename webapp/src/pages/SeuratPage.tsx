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
import { Hero } from '@/components/Hero';
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

function Rivi({ s, ylaraja }: { s: Seurakausi; ylaraja: number }) {
  const leveys = s.osuus === null ? 0 : Math.min(100, (s.osuus / ylaraja) * 100);
  return (
    <tr className="hover:bg-navy-700/40 transition-colors">
      <td className="px-4 py-2">
        <span className="text-white/90 whitespace-nowrap">{s.nimi}</span>
        {s.akatemia && (
          <span
            className="ml-2 inline-block rounded border border-navy-500 bg-navy-700/60 px-1.5 text-[10px] text-white/50 align-middle"
            title={AKATEMIA_SELITE}
          >
            akatemiajoukkue
          </span>
        )}
      </td>
      <td className="px-3 py-2 w-40">
        {s.osuus === null ? (
          <span className="text-white/40 text-xs">ei dataa</span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="h-1.5 rounded-full bg-navy-600 flex-1 overflow-hidden">
              <span
                className="block h-full bg-ice/70"
                style={{ width: leveys + '%' }}
              />
            </span>
            <span className="text-ice tabular text-sm w-14 text-right">
              {desimaali(s.osuus)} %
            </span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular text-white/70">{s.ottelut}</td>
      <td className="hidden sm:table-cell px-3 py-2 text-right tabular text-white/70">
        {luku(s.nuortenMinuutit)}
      </td>
      <td className="hidden sm:table-cell px-3 py-2 text-right tabular text-white/70">
        {s.pelaajia}
      </td>
      <td className="hidden md:table-cell px-4 py-2 text-right tabular text-white/70">
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

  // Taulukon palkeille sama yläraja kuin kaavioissa: datasta, ei vakiosta.
  const ylaraja = useMemo(() => {
    const arvot = seurat
      .map((s) => s.osuus)
      .filter((x): x is number => x !== null);
    return Math.ceil(Math.max(10, ...arvot) / 10) * 10;
  }, [seurat]);

  const viiva = kausiData?.vertailuviivat[0] ?? null;

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
      <Hero
        eyebrow={`${sarja} · Kausi ${kausi}`}
        title={
          <>
            Seurat —{' '}
            <span className="text-aurora font-medium">
              {sarja} {kausi}
            </span>
          </>
        }
        subtitle={`${seurat.length} seuraa · ${NUORET_LABEL_PITKA} osuus joukkueen otteluiden minuuteista`}
        height="sm"
      />

      {/* Sarjan taso kahtena lukuna */}
      {viiva && (
        <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-1.5">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Sarjan taso
          </h2>
          <p className="text-sm text-white/85 tabular">
            {viiva.ilmanAkatemioita === null ? (
              <>Kaikki joukkueet {desimaali(viiva.kaikki)} %</>
            ) : (
              <>
                Kaikki joukkueet {desimaali(viiva.kaikki)} %
                <span className="text-white/30"> · </span>
                ilman akatemiajoukkueita {desimaali(viiva.ilmanAkatemioita)} %
              </>
            )}
          </p>
          {/* Toinen luku vain jos sarjassa on akatemiajoukkueita. Kaksi
              identtistä lukua vierekkäin väittäisi vertailua, jota ei ole
              tehty — ehto tulee datasta, ei sarjan nimestä. */}
          {viiva.ilmanAkatemioita !== null && (
            <p className="text-[11px] text-white/40 leading-relaxed max-w-3xl">
              Kaksi lukua, koska akatemiajoukkueen koko idea on peluuttaa
              nuoria. Yksi keskiarvo nostaisi sarjan tason sellaiseksi, joka ei
              kerro muiden seurojen käytännöstä.
            </p>
          )}
        </section>
      )}

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
          <div className="overflow-x-auto border border-navy-600 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/40 border-b border-navy-600">
                  <th className="text-left font-medium px-4 py-2">Seura</th>
                  <th className="text-left font-medium px-3 py-2">Osuus</th>
                  <th className="text-right font-medium px-3 py-2">Ott</th>
                  <th className="hidden sm:table-cell text-right font-medium px-3 py-2">
                    Min
                  </th>
                  <th className="hidden sm:table-cell text-right font-medium px-3 py-2">
                    Pelaajia
                  </th>
                  <th className="hidden md:table-cell text-right font-medium px-4 py-2">
                    Keski-ikä
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {seurat.map((s) => (
                  <Rivi key={s.tunniste} s={s} ylaraja={ylaraja} />
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
              {trendit.kaudet[0]}–{trendit.kaudet[trendit.kaudet.length - 1]}
            </span>
          )}
        </div>
        {trendit === null || trendit === undefined ? (
          <p className="text-sm text-white/60">Kausikehitystä ei saatu haettua.</p>
        ) : (
          <SeuraKaaviot
            seurat={trendit.seurat}
            kaudet={trendit.kaudet}
            vertailuviivat={trendit.vertailuviivat}
            liukuvaIkkuna={trendit.liukuvaIkkuna}
          />
        )}
      </section>

      <p className="text-xs text-white/40">
        {lahdeRivi(sarja)}. Osuus = nuorten minuutit jaettuna joukkueen
        otteluiden kokonaisminuuteilla.
      </p>
    </div>
  );
}
