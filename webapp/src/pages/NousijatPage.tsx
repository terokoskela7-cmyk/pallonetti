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

  return (
    <div className="px-6 py-10 md:py-14 space-y-8">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-vaimea font-mono">
          Toiselta tasolta Veikkausliigaan
        </p>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Nousijat</h1>
        <p className="text-base text-toissijainen max-w-2xl">
          {NUORET_LABEL_PITKA} pelaajat, jotka saivat peliaikaa toisella sarjatasolla ja
          seuraavalla kaudella Veikkausliigassa, ketkä tekivät läpimurron ja mitä debyytin
          jälkeen tapahtui.
        </p>
      </section>

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
                      : 'border-navy-600 text-toissijainen hover:text-white hover:border-ice/40')
                  }
                >
                  {sarjanLyhytNimi(p.alempiSarja || 'Ykkösliiga')} {p.kausiN} → {p.kausiN1}
                  <span className="ml-2 text-vaimea">{p.nousseet}</span>
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
