// ============================================
// NUORET — kolme tasoa
//
//   1. Valokeilassa  kolme korttia, joiden luku poikkeaa eniten oman
//                    ikaryhman mediaanista (valinta rajapinnasta)
//   2. Tilastokarki  suodatettava lista, kymmenen kerrallaan
//   3. Kaikki        taulukko hakukentalla ja seurasuodattimella
//
// Kaikki lauseet ja luvut tulevat rajapinnasta. Selain suodattaa,
// jarjestaa ja piirtaa — se ei laske osuuksia eika sanoita mitaan.
//
// Aiempi 104 kortin virta on poistettu: se nayttii kaikki pelaajat
// samanarvoisina, jolloin mikaan ei erottunut.
// ============================================
import { useMemo, useState } from 'react';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import { Info, Search } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { naytaKokoNimi } from '@/utils/nimet';
import { getKaudenKonteksti, type Konteksti } from '@/services/api';
import { useValittuKausi, useValittuSarja } from '@/hooks/useKausi';
import { IKAKAISTAT, kaistalla, NUORET_LABEL_PITKA } from '@/constants/ika';
import { Hero } from '@/components/Hero';
import { Kontekstirivit } from '@/components/Kontekstirivit';
import { ValokeilaKortit, Tilannerivi } from '@/components/Valokeila';

/** Listanakymassa ei ole ohitettuja — ne ovat katselmointitietoa. */
type Pelaaja = Omit<Konteksti, 'ohitetut'>;

/** Montako riviä tilastokärki näyttää kerrallaan. */
const SIVUN_KOKO = 10;

/**
 * Tiiviissa nakymassa naytetaan ensin peliaikarivit. Moottori palauttaa
 * rivit jarjestyksessa peliaika ensin, joten katto riittaa.
 */
const TIIVIS_RIVEJA = 2;

type Jarjestys = 'minuutit' | 'maalit' | 'nuorin';

const JARJESTYKSET: Array<{ id: Jarjestys; label: string }> = [
  { id: 'minuutit', label: 'Eniten minuutteja' },
  { id: 'maalit', label: 'Eniten maaleja' },
  { id: 'nuorin', label: 'Nuorin' },
];

function nimi(p: Pelaaja): string {
  return naytaKokoNimi(p.etunimi, p.sukunimi);
}

function jarjesta(pelaajat: Pelaaja[], jarjestys: Jarjestys): Pelaaja[] {
  const kopio = pelaajat.slice();
  if (jarjestys === 'maalit') {
    return kopio.sort(
      (a, b) =>
        b.faktat.maalit - a.faktat.maalit ||
        b.faktat.minuutit - a.faktat.minuutit,
    );
  }
  if (jarjestys === 'nuorin') {
    // Nuorin ensin, ja saman ikaisista se jolla on eniten peliaikaa.
    return kopio.sort(
      (a, b) => a.ika - b.ika || b.faktat.minuutit - a.faktat.minuutit,
    );
  }
  return kopio.sort((a, b) => b.faktat.minuutit - a.faktat.minuutit);
}

function LoadingSkeleton() {
  return (
    <div className="px-6 py-10 md:py-16 space-y-8 animate-pulse">
      <div className="h-44 bg-navy-700/30 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-navy-700/30 rounded-xl" />
        ))}
      </div>
      <div className="h-96 bg-navy-700/30 rounded-xl" />
    </div>
  );
}

function TilastokarjenRivi({ p, sija }: { p: Pelaaja; sija: number }) {
  return (
    <SisainenLinkki
      to={`/pelaaja/${p.slug}`}
      className="flex items-start gap-4 px-4 py-3 hover:bg-navy-700/40 transition-colors"
    >
      <span className="text-sm text-white/30 font-mono tabular w-6 shrink-0 pt-0.5">
        {sija}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-white/95">{nimi(p)}</span>
          <span className="text-xs text-white/40">
            {p.joukkue} · {p.ika} v
          </span>
        </span>
        <span className="block mt-1">
          <Kontekstirivit konteksti={p} maxRiveja={TIIVIS_RIVEJA} tiivis />
        </span>
      </span>
      <span className="text-right shrink-0 tabular">
        <span className="block text-ice font-mono">{p.faktat.minuutit}</span>
        <span className="block text-[10px] uppercase tracking-wider text-white/40">
          min
        </span>
      </span>
    </SisainenLinkki>
  );
}

export default function NuoretPage() {
  const kausi = useValittuKausi();
  const sarja = useValittuSarja();

  const [kaista, setKaista] = useState<string>('all');
  const [jarjestys, setJarjestys] = useState<Jarjestys>('minuutit');
  const [naytetaan, setNaytetaan] = useState(SIVUN_KOKO);
  const [haku, setHaku] = useState('');
  const [seura, setSeura] = useState('all');

  const { data, loading, error } = useApi(
    () => getKaudenKonteksti(kausi, sarja),
    [kausi, sarja],
  );

  const kaikki = useMemo<Pelaaja[]>(() => data?.kontekstit ?? [], [data]);

  // Seurattavat = ne joilla on peliaikaa. Nolla minuuttia ei ole
  // puuttuva arvo vaan tieto siita, ettei pelaaja ole pelannut.
  const peliaikaa = useMemo(
    () => kaikki.filter((p) => p.faktat.minuutit > 0),
    [kaikki],
  );

  const tilastokarki = useMemo(() => {
    const k = IKAKAISTAT.find((x) => x.id === kaista);
    return jarjesta(
      peliaikaa.filter((p) => (k ? kaistalla(p.ika, k) : true)),
      jarjestys,
    );
  }, [peliaikaa, kaista, jarjestys]);

  const seurat = useMemo(
    () => Array.from(new Set(kaikki.map((p) => p.joukkue))).sort(),
    [kaikki],
  );

  const taulukko = useMemo(() => {
    const haettu = haku.trim().toLowerCase();
    return kaikki
      .filter((p) => (seura === 'all' ? true : p.joukkue === seura))
      .filter((p) =>
        haettu === '' ? true : nimi(p).toLowerCase().includes(haettu),
      )
      .sort((a, b) => b.faktat.minuutit - a.faktat.minuutit);
  }, [kaikki, haku, seura]);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
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
            Nuoret pelaajat —{' '}
            <span className="text-aurora font-medium">
              {sarja} {kausi}
            </span>
          </>
        }
        subtitle={`${peliaikaa.length} pelaajaa peliajassa · ${NUORET_LABEL_PITKA}`}
        height="sm"
      />

      {/* 1. VALOKEILASSA */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Valokeilassa
          </h2>
          <span className="text-[11px] text-white/40">
            suurin poikkeama ikäryhmän mediaanista ylöspäin · yksi pelaaja per seura
          </span>
        </div>
        {data.valokeilassa.length === 0 ? (
          <p className="text-sm text-white/60">
            Kaudelta ei vielä löydy vertailukelpoista poikkeamaa.
          </p>
        ) : (
          <ValokeilaKortit nostot={data.valokeilassa} />
        )}
      </section>

      {/* 2. TILASTOKÄRKI */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-white/40">
          Tilastokärki
        </h2>

        <div className="flex flex-wrap gap-1.5">
          {JARJESTYKSET.map((j) => (
            <button
              key={j.id}
              onClick={() => {
                setJarjestys(j.id);
                setNaytetaan(SIVUN_KOKO);
              }}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                jarjestys === j.id
                  ? 'bg-ice/15 border-ice text-ice font-medium'
                  : 'bg-navy-700/50 border-navy-600 text-white/70 hover:text-white hover:border-navy-500'
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', label: 'Kaikki ikävuodet' }, ...IKAKAISTAT].map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setKaista(k.id);
                setNaytetaan(SIVUN_KOKO);
              }}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                kaista === k.id
                  ? 'bg-ice/15 border-ice text-ice font-medium'
                  : 'bg-navy-700/50 border-navy-600 text-white/70 hover:text-white hover:border-navy-500'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {tilastokarki.length === 0 ? (
          <p className="text-sm text-white/60">
            Suodattimella ei löytynyt pelaajia.
          </p>
        ) : (
          <div className="bg-navy-700/30 border border-navy-600 rounded-xl divide-y divide-navy-600 overflow-hidden">
            {tilastokarki.slice(0, naytetaan).map((p, i) => (
              <TilastokarjenRivi key={p.slug} p={p} sija={i + 1} />
            ))}
          </div>
        )}

        {naytetaan < tilastokarki.length && (
          <button
            onClick={() => setNaytetaan(naytetaan + SIVUN_KOKO)}
            className="w-full py-2.5 text-sm text-ice border border-navy-600 rounded-lg hover:border-ice/40 transition-colors"
          >
            Näytä {Math.min(SIVUN_KOKO, tilastokarki.length - naytetaan)} lisää
            <span className="text-white/40">
              {' '}
              ({naytetaan}/{tilastokarki.length})
            </span>
          </button>
        )}
      </section>

      {/* 3. KAIKKI PELAAJAT */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Kaikki pelaajat
          </h2>
          <span className="text-[11px] text-white/40 tabular">
            {taulukko.length}/{kaikki.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={haku}
              onChange={(e) => setHaku(e.target.value)}
              placeholder="Hae nimellä"
              aria-label="Hae pelaajaa nimellä"
              className="w-full bg-navy-700/50 border border-navy-600 rounded-md pl-9 pr-3 py-1.5 text-sm text-white/90 placeholder:text-white/30 focus:border-ice focus:outline-none"
            />
          </div>
          <select
            value={seura}
            onChange={(e) => setSeura(e.target.value)}
            aria-label="Rajaa seuralla"
            className="bg-navy-700/50 border border-navy-600 rounded-md px-3 py-1.5 text-sm text-white/90 focus:border-ice focus:outline-none"
          >
            <option value="all">Kaikki seurat</option>
            {seurat.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {taulukko.length === 0 ? (
          <p className="text-sm text-white/60">Haulla ei löytynyt pelaajia.</p>
        ) : (
          <div className="overflow-x-auto border border-navy-600 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/40 border-b border-navy-600">
                  <th className="text-left font-medium px-4 py-2">Pelaaja</th>
                  <th className="text-left font-medium px-3 py-2">Seura</th>
                  <th className="text-right font-medium px-3 py-2">Ikä</th>
                  <th className="text-right font-medium px-3 py-2">Min</th>
                  <th className="text-right font-medium px-3 py-2">Ott</th>
                  <th className="text-right font-medium px-3 py-2">Al</th>
                  <th className="text-right font-medium px-4 py-2">Maalit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {taulukko.map((p) => (
                  <tr key={p.slug} className="hover:bg-navy-700/40 transition-colors">
                    <td className="px-4 py-2">
                      <SisainenLinkki
                        to={`/pelaaja/${p.slug}`}
                        className="text-white/90 hover:text-ice transition-colors"
                      >
                        {nimi(p)}
                      </SisainenLinkki>
                    </td>
                    <td className="px-3 py-2 text-white/60">{p.joukkue}</td>
                    <td className="px-3 py-2 text-right tabular text-white/70">
                      {p.ika}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-ice">
                      {p.faktat.minuutit}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-white/70">
                      {p.faktat.ottelut}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-white/70">
                      {p.faktat.aloitukset}
                    </td>
                    <td className="px-4 py-2 text-right tabular text-white/90">
                      {p.faktat.maalit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Tilannerivi tuotuPvm={data.tuotuPvm} sarja={sarja} />
    </div>
  );
}
