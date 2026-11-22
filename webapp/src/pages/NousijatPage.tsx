// ============================================
// NOUSIJAT — Ykkösliigasta Veikkausliigaan
//
// Kokoaa kaikki saatavilla olevat siirtymät (kausi N Ykkösliigassa →
// kausi N+1 Veikkausliigassa) yhdelle sivulle. Luvut ja pelaajalista
// tulevat /polku/:kausi-rajapinnasta sellaisinaan; selain ei laske mitään.
//
// Sivu ei riipu yläpalkin sarjavalinnasta: siirtymä koskee aina kahta
// sarjaa. Siirtymä valitaan sivun omilla painikkeilla.
// ============================================
import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getKaudet, getPolku, type PolkuTulos } from '@/services/api';
import { PolkuVeikkausliigaan } from '@/components/PolkuVeikkausliigaan';
import { NUORET_LABEL_PITKA } from '@/constants/ika';

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
  const [valittu, setValittu] = useState<number | null>(null);

  // Oletuksena uusin siirtymä.
  useEffect(() => {
    if (valittu === null && siirtymat && siirtymat.length > 0) {
      setValittu(siirtymat[0].kausiN1);
    }
  }, [siirtymat, valittu]);

  const polku = siirtymat?.find((p) => p.kausiN1 === valittu) ?? null;

  return (
    <div className="px-6 py-10 md:py-14 max-w-5xl mx-auto space-y-8">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-white/50 font-mono">
          Ykkösliiga → Veikkausliiga
        </p>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Nousijat</h1>
        <p className="text-base text-white/70 max-w-2xl">
          {NUORET_LABEL_PITKA} pelaajat, jotka saivat peliaikaa Ykkösliigassa ja seuraavalla
          kaudella Veikkausliigassa, sekä minuutit molemmilta kausilta.
        </p>
      </section>

      {loading && <div className="h-64 bg-navy-700/30 rounded-xl animate-pulse" />}

      {error && (
        <div className="text-center py-10 space-y-2">
          <Info className="w-8 h-8 text-red-400/80 mx-auto" />
          <div className="text-white/80">Siirtymien haku epäonnistui</div>
          <div className="text-sm text-white/50">{error}</div>
        </div>
      )}

      {siirtymat && siirtymat.length === 0 && (
        <p className="text-sm text-white/60">
          Siirtymiä ei ole vielä: tarvitaan Ykkösliigan kausi ja sitä seuraava
          Veikkausliigan kausi.
        </p>
      )}

      {siirtymat && siirtymat.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Siirtymä">
            {siirtymat.map((p) => {
              const valittuNyt = p.kausiN1 === valittu;
              return (
                <button
                  key={p.kausiN1}
                  type="button"
                  aria-pressed={valittuNyt}
                  onClick={() => setValittu(p.kausiN1)}
                  className={
                    'px-3 py-1.5 rounded-md border text-sm font-mono transition-colors ' +
                    (valittuNyt
                      ? 'border-ice bg-ice/10 text-white'
                      : 'border-navy-600 text-white/60 hover:text-white hover:border-ice/40')
                  }
                >
                  {p.kausiN} → {p.kausiN1}
                  <span className="ml-2 text-white/40">{p.nousseet}</span>
                </button>
              );
            })}
          </div>
          {polku && <PolkuVeikkausliigaan polku={polku} />}
        </>
      )}
    </div>
  );
}
