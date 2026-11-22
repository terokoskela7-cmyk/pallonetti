// ============================================
// NOUSIJAT — toiselta tasolta Veikkausliigaan, läpimurrot ja jatko
//
// 1. Siirtymät (kausi N toisella tasolla → kausi N+1 Veikkausliigassa).
//    Toinen taso on Ykkönen 2021–2023 ja Ykkösliiga 2024 →.
// 2. Läpimurrot: 450 kumulatiivista Veikkausliiga-minuuttia (ECA).
// 3. Debyytin jälkeen: mitä debytoineille tapahtui seuraavalla kaudella.
//
// Luvut tulevat /polku/:kausi- ja /lapimurrot-rajapinnoista sellaisinaan;
// selain ei laske mitään.
//
// Sivu ei riipu yläpalkin sarjavalinnasta: siirtymä koskee aina kahta
// sarjaa. Siirtymä valitaan sivun omilla painikkeilla.
// ============================================
import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getKaudet, getLapimurrot, getPolku, type PolkuTulos } from '@/services/api';
import { PolkuVeikkausliigaan } from '@/components/PolkuVeikkausliigaan';
import { DebyytinJalkeen, Lapimurrot, RyhmaValitsin, type Ryhma } from '@/components/Lapimurrot';
import { sarjanLyhytNimi } from '@/constants/sarjat';
import { NUORET_LABEL_PITKA } from '@/constants/ika';

/** Toisen tason sarja elatiivissa otsikkolauseeseen. */
const ELATIIVI: Record<string, string> = {
  Ykkösliiga: 'Ykkösliigasta',
  'Miesten Ykkönen': 'Ykkösestä',
};

function Kpi({ otsikko, arvo, lisa }: { otsikko: string; arvo: string; lisa?: string | null }) {
  return (
    <div className="bg-navy-700/60 border border-navy-600 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-sm text-toissijainen">{otsikko}</span>
      <span className="text-3xl font-mono tabular text-white leading-tight">{arvo}</span>
      {lisa && <span className="text-xs text-vaimea">{lisa}</span>}
    </div>
  );
}

async function haeSiirtymat(): Promise<PolkuTulos[]> {
  const kaudet = await getKaudet('Veikkausliiga');
  const vuodet = Array.from(new Set(kaudet.map((k) => k.kausi))).sort((a, b) => b - a);
  const tulokset = await Promise.all(
    vuodet.map(async (v) => {
      try {
        return await getPolku(v);
      } catch (e) {
        console.error('[nousijat] polun haku epäonnistui kaudelle', v, e);
        return null;
      }
    }),
  );
  return tulokset.filter((p): p is PolkuTulos => p !== null && p.saatavilla);
}

export default function NousijatPage() {
  const { data: siirtymat, loading, error } = useApi(haeSiirtymat, []);
  // Oma haku: siirtymät näkyvät, vaikka tämä ei latautuisi.
  const { data: lapimurrot } = useApi(async () => {
    try {
      return await getLapimurrot();
    } catch (e) {
      console.error('[nousijat] läpimurtojen haku epäonnistui:', e);
      return null;
    }
  }, []);
  const [valittu, setValittu] = useState<number | null>(null);
  const [ryhma, setRyhma] = useState<Ryhma>('kaikki');

  // Oletuksena uusin siirtymä.
  useEffect(() => {
    if (valittu === null && siirtymat && siirtymat.length > 0) {
      setValittu(siirtymat[0].kausiN1);
    }
  }, [siirtymat, valittu]);

  const polku = siirtymat?.find((p) => p.kausiN1 === valittu) ?? null;

  // Otsikkolause ja avainluvut: uusin siirtymä ja uusin debyyttikausi,
  // jonka seuraava kausi on jo pelattu. Luvut rajapinnoista sellaisinaan.
  const uusin = siirtymat && siirtymat.length > 0 ? siirtymat[0] : null;
  const uusinAlempi = uusin ? uusin.alempiSarja || 'Ykkösliiga' : 'Ykkösliiga';
  const yhteenveto = (lapimurrot?.yhteenveto ?? []).filter((y) => y.debytoineet > 0);
  const uusinDebyytti = yhteenveto[0] ?? null;
  const valmisDebyytti =
    yhteenveto.find((y) => y.jalkeen['ei vielä'] < y.debytoineet) ?? null;
  const ylin = Math.max(1, ...(siirtymat ?? []).map((p) => p.nousseet));

  return (
    <div className="px-6 py-10 md:py-14 space-y-8">
      <section className="space-y-3" aria-labelledby="nousijat-otsikko">
        <p className="text-xs uppercase tracking-[0.12em] text-vaimea font-mono">
          Toiselta tasolta Veikkausliigaan · {NUORET_LABEL_PITKA}
        </p>
        <h1
          id="nousijat-otsikko"
          className="text-3xl md:text-[44px] md:leading-[1.15] font-medium tracking-tight text-white max-w-4xl"
        >
          {uusin ? (
            <>
              <span className="font-mono text-ice">{uusin.nousseet}</span> nuorta nousi{' '}
              {ELATIIVI[uusinAlempi] ?? 'toiselta tasolta'} Veikkausliigaan kaudeksi{' '}
              {uusin.kausiN1} — <span className="font-mono text-ice">{uusin.debytoi}</span>{' '}
              heistä debytoi.
            </>
          ) : (
            'Nousijat'
          )}
        </h1>
        <p className="text-base md:text-[17px] text-toissijainen max-w-3xl leading-relaxed">
          {valmisDebyytti && (
            <>
              Kauden {valmisDebyytti.kausi} debytoineista {valmisDebyytti.lapimurto} ylitti 450
              minuutin läpimurtorajan.{' '}
            </>
          )}
          Toinen taso oli Ykkönen kausina 2021–2023 ja on Ykkösliiga siitä lähtien.
        </p>
      </section>

      {(uusin || uusinDebyytti) && (
        <section aria-label="Avainluvut" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {uusin && (
            <Kpi
              otsikko="Nousi toiselta tasolta"
              arvo={String(uusin.nousseet)}
              lisa={sarjanLyhytNimi(uusinAlempi) + ' ' + uusin.kausiN + ' → Veikkausliiga ' + uusin.kausiN1}
            />
          )}
          {uusinDebyytti && (
            <Kpi
              otsikko="Debytoi Veikkausliigassa"
              arvo={String(uusinDebyytti.debytoineet)}
              lisa={
                'kaudella ' + uusinDebyytti.kausi + ', joista ' +
                uusinDebyytti.alemmaltaTasolta + ' alemmalta tasolta'
              }
            />
          )}
          {valmisDebyytti && (
            <Kpi
              otsikko="Läpimurto, 450 min"
              arvo={valmisDebyytti.lapimurto + ' / ' + valmisDebyytti.debytoineet}
              lisa={'kauden ' + valmisDebyytti.kausi + ' debytoineista'}
            />
          )}
          {valmisDebyytti && (
            <Kpi
              otsikko="Minuutit kasvoivat"
              arvo={String(valmisDebyytti.jalkeen.kasvoi)}
              lisa={'kauden ' + valmisDebyytti.kausi + ' debytoineista seuraavalla kaudella'}
            />
          )}
        </section>
      )}

      {loading && <div className="h-64 bg-navy-700/30 rounded-xl animate-pulse" />}

      {error && (
        <div className="text-center py-10 space-y-2">
          <Info className="w-8 h-8 text-red-400/80 mx-auto" />
          <div className="text-white/80">Siirtymien haku epäonnistui</div>
          <div className="text-sm text-vaimea">{error}</div>
        </div>
      )}

      {siirtymat && siirtymat.length === 0 && (
        <p className="text-sm text-toissijainen">
          Siirtymiä ei ole vielä: tarvitaan toisen tason kausi ja sitä seuraava
          Veikkausliigan kausi.
        </p>
      )}

      {siirtymat && siirtymat.length > 0 && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-medium text-white">Siirtymät</h2>
            <span className="text-xs text-vaimea">peliaikaa molemmissa sarjoissa</span>
          </div>
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3"
            role="group"
            aria-label="Siirtymä"
          >
            {siirtymat.map((p) => {
              const valittuNyt = p.kausiN1 === valittu;
              return (
                <button
                  key={p.kausiN1}
                  type="button"
                  aria-pressed={valittuNyt}
                  onClick={() => setValittu(p.kausiN1)}
                  className={
                    'text-left px-4 py-3.5 rounded-lg border text-sm transition-colors flex flex-col gap-2.5 ' +
                    (valittuNyt
                      ? 'border-ice bg-ice/10 text-white'
                      : 'border-navy-500 text-toissijainen hover:text-white hover:border-ice/40')
                  }
                >
                  <span>
                    {sarjanLyhytNimi(p.alempiSarja || 'Ykkösliiga')} {p.kausiN} → {p.kausiN1}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="flex-1 h-1.5 rounded-sm bg-navy-600" aria-hidden="true">
                      <span
                        className={'block h-full rounded-sm ' + (valittuNyt ? 'bg-ice' : 'bg-vaimea')}
                        style={{ width: (p.nousseet / ylin) * 100 + '%' }}
                      />
                    </span>
                    <span className="font-mono tabular">{p.nousseet}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {polku && <PolkuVeikkausliigaan polku={polku} />}
        </>
      )}

      {lapimurrot && (
        <div className="space-y-6">
          <RyhmaValitsin ryhma={ryhma} onChange={setRyhma} tulos={lapimurrot} />
          <Lapimurrot tulos={lapimurrot} ryhma={ryhma} />
          <DebyytinJalkeen tulos={lapimurrot} ryhma={ryhma} />
        </div>
      )}
    </div>
  );
}
