// ============================================
// NUORET — kolme tasoa
//
//   1. Valokeilassa  kolme korttia, joiden luku poikkeaa eniten oman
//                    ikaryhman mediaanista (valinta rajapinnasta)
//   2. Penkilla      kokoonpanossa mutta ei kentalla — eniten kertoja
//   3. Tilastokarki  suodatettava lista, kymmenen kerrallaan
//   4. Kaikki        taulukko hakukentalla ja seurasuodattimella
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
import { Kontekstirivit } from '@/components/Kontekstirivit';
import { ValokeilaKortit, Tilannerivi } from '@/components/Valokeila';

/** Listanakymassa ei ole ohitettuja — ne ovat katselmointitietoa. */
type Pelaaja = Omit<Konteksti, 'ohitetut'>;

/** Montako pelaajaa "kokoonpanossa, mutta ei kentällä" -listassa. */
const PENKKI_KOKO = 5;

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
          <span className="text-xs text-vaimea">
            {p.joukkue} · {p.ika} v
          </span>
        </span>
        <span className="block mt-1">
          <Kontekstirivit konteksti={p} maxRiveja={TIIVIS_RIVEJA} tiivis />
        </span>
      </span>
      <span className="text-right shrink-0 tabular">
        <span className="block text-ice font-mono">{p.faktat.minuutit}</span>
        <span className="block text-[10px] uppercase tracking-wider text-vaimea">
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
  // Oletuksena vain Suomessa koulutetut (UEFA association-trained), kun
  // koulutustieto on; varalla Suomen kansalaiset. Sivun kysymys on
  // suomalaisen pelaajakehityksen peliaika. Kaikki saa näkyviin.
  const [vainSuomi, setVainSuomi] = useState(true);

  const { data, loading, error } = useApi(
    () => getKaudenKonteksti(kausi, sarja),
    [kausi, sarja],
  );

  const koulutusSaatavilla = data?.koulutusSaatavilla === true;
  const kansalaisuusSaatavilla = koulutusSaatavilla || data?.kansalaisuusSaatavilla === true;
  const suodataSuomi = kansalaisuusSaatavilla && vainSuomi;
  const rajausNimi = koulutusSaatavilla ? 'Suomessa koulutetut' : 'Suomen kansalaiset';
  const kaikkiRivit = useMemo<Pelaaja[]>(() => data?.kontekstit ?? [], [data]);
  const kaikki = useMemo<Pelaaja[]>(
    () =>
      suodataSuomi
        ? (data?.kontekstit ?? []).filter((p) =>
            koulutusSaatavilla ? p.koulutettu === true : p.kansalaisuus === 'suomi',
          )
        : kaikkiRivit,
    [data, kaikkiRivit, suodataSuomi, koulutusSaatavilla],
  );
  // Valokeila valitaan palvelimella kaikista; suodatetaan samalla
  // rajauksella (voi jäädä alle kolmen).
  const suomiSlugit = useMemo(() => new Set(kaikki.map((p) => p.slug)), [kaikki]);
  const valokeila = useMemo(
    () => (data?.valokeilassa ?? []).filter((n) => !suodataSuomi || suomiSlugit.has(n.slug)),
    [data, suodataSuomi, suomiSlugit],
  );

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

  // Eniten kertoja kokoonpanossa ilman peliaikaa. Vain pelaajat, joilta
  // kokoonpanotieto on (penkilla ei ole null), ja joilla kertoja on.
  const penkilla = useMemo(
    () =>
      kaikki
        .filter((p) => typeof p.faktat.penkilla === 'number' && (p.faktat.penkilla as number) > 0)
        .sort(
          (a, b) =>
            (b.faktat.penkilla as number) - (a.faktat.penkilla as number) ||
            a.faktat.minuutit - b.faktat.minuutit,
        ),
    [kaikki],
  );
  const penkkiYhteensa = penkilla.reduce((s, p) => s + (p.faktat.penkilla as number), 0);
  const penkkiYla = penkilla.length > 0 ? (penkilla[0].faktat.penkilla as number) : 1;

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
        <div className="text-sm text-toissijainen">{error ?? 'Tuntematon virhe'}</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-10 md:py-16 space-y-10">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-vaimea font-mono">
          {sarja} · kausi {kausi}
        </p>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Nuoret pelaajat</h1>
        <p className="text-base text-toissijainen">
          {suodataSuomi ? (
            <>
              Mukana {kaikki.length}{' '}
              {koulutusSaatavilla ? 'Suomessa koulutettua pelaajaa' : 'Suomen kansalaista'} (
              {NUORET_LABEL_PITKA}), joista {peliaikaa.length} sai peliaikaa. Kaikkiaan kokoonpanoissa
              oli {kaikkiRivit.length} pelaajaa taustasta riippumatta.
            </>
          ) : (
            <>
              Mukana {kaikki.length} pelaajaa ({NUORET_LABEL_PITKA}), joista {peliaikaa.length} sai
              peliaikaa{kansalaisuusSaatavilla ? ', taustasta riippumatta' : ''}.
            </>
          )}
        </p>
        {kansalaisuusSaatavilla && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div role="group" aria-label="Pelaajat" className="inline-flex border border-navy-500 rounded-lg overflow-hidden">
              <button
                type="button"
                aria-pressed={vainSuomi}
                onClick={() => setVainSuomi(true)}
                className={
                  'px-3 py-1.5 text-sm transition-colors ' +
                  (vainSuomi ? 'bg-ice text-navy-900 font-medium' : 'text-toissijainen hover:text-white')
                }
              >
                {rajausNimi}
              </button>
              <button
                type="button"
                aria-pressed={!vainSuomi}
                onClick={() => setVainSuomi(false)}
                className={
                  'px-3 py-1.5 text-sm transition-colors ' +
                  (!vainSuomi ? 'bg-ice text-navy-900 font-medium' : 'text-toissijainen hover:text-white')
                }
              >
                Kaikki
              </button>
            </div>
            <span className="text-xs text-vaimea">
              {koulutusSaatavilla
                ? 'Suomessa koulutettu = vähintään kolme kautta suomalaisessa seurassa 15–21-vuotiaana (UEFA:n määritelmä). Seurahistoria vuodesta 2020.'
                : 'Kansalaisuus pelaajarekisterin mukaan; pelaaja, jota rekisteristä ei löydy, näkyy vain kohdassa Kaikki.'}
            </span>
          </div>
        )}
      </section>

      {/* 1. VALOKEILASSA */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-vaimea">
            Valokeilassa
          </h2>
          <span className="text-[11px] text-vaimea">
            suurin poikkeama ikäryhmän mediaanista ylöspäin · yksi pelaaja per seura
          </span>
        </div>
        {valokeila.length === 0 ? (
          <p className="text-sm text-toissijainen">
            Kaudelta ei vielä löydy vertailukelpoista poikkeamaa.
          </p>
        ) : (
          <ValokeilaKortit nostot={valokeila} />
        )}
      </section>

      {/* 2. PENKILLÄ */}
      {penkilla.length > 0 && (
        <section aria-labelledby="penkilla-otsikko" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="penkilla-otsikko" className="text-lg font-medium text-white">
              Kokoonpanossa, mutta ei kentällä
            </h2>
            <span className="text-xs text-vaimea">
              Eniten otteluita kokoonpanossa ilman peliaikaa · koko sarjassa {penkkiYhteensa} kertaa
            </span>
          </div>
          <div className="overflow-x-auto border border-navy-600 rounded-xl bg-navy-700/30">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Pelaajat, jotka olivat eniten kertoja kokoonpanossa pelaamatta
              </caption>
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-vaimea border-b border-navy-600">
                  <th scope="col" className="text-left font-medium px-4 py-2.5">Pelaaja</th>
                  <th scope="col" className="text-left font-medium px-3 py-2.5">Seura</th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Ikä</th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Kokoonpanossa</th>
                  <th scope="col" className="text-right font-medium px-3 py-2.5">Pelasi</th>
                  <th scope="col" className="text-left font-medium px-4 py-2.5 min-w-[12rem]">
                    Penkillä ilman peliaikaa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {penkilla.slice(0, PENKKI_KOKO).map((p) => (
                  <tr key={p.slug} className="hover:bg-navy-700/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <SisainenLinkki
                        to={`/pelaaja/${p.slug}`}
                        className="text-white font-medium hover:text-ice transition-colors"
                      >
                        {nimi(p)}
                      </SisainenLinkki>
                    </td>
                    <td className="px-3 py-2.5 text-toissijainen">{p.joukkue}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular text-toissijainen">{p.ika}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular text-toissijainen">
                      {p.faktat.kokoonpanossa ?? '–'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular text-toissijainen">
                      {p.faktat.ottelut}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="h-2 rounded-sm bg-navy-900/60 flex-1" aria-hidden="true">
                          <span
                            className="block h-full rounded-sm bg-amber-400"
                            style={{ width: ((p.faktat.penkilla as number) / penkkiYla) * 100 + '%' }}
                          />
                        </span>
                        <span className="font-mono tabular text-white w-8 text-right">
                          {p.faktat.penkilla}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 3. TILASTOKÄRKI */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-vaimea">
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
                  : 'bg-navy-700/50 border-navy-600 text-toissijainen hover:text-white hover:border-navy-500'
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
                  : 'bg-navy-700/50 border-navy-600 text-toissijainen hover:text-white hover:border-navy-500'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {tilastokarki.length === 0 ? (
          <p className="text-sm text-toissijainen">
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
            <span className="text-vaimea">
              {' '}
              ({naytetaan}/{tilastokarki.length})
            </span>
          </button>
        )}
      </section>

      {/* 4. KAIKKI PELAAJAT */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-wider text-vaimea">
            Kaikki pelaajat
          </h2>
          <span className="text-[11px] text-vaimea tabular">
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
          <p className="text-sm text-toissijainen">Haulla ei löytynyt pelaajia.</p>
        ) : (
          <div className="overflow-x-auto border border-navy-600 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-vaimea border-b border-navy-600">
                  <th className="text-left font-medium px-4 py-2">Pelaaja</th>
                  <th className="text-left font-medium px-3 py-2">Seura</th>
                  <th className="text-right font-medium px-3 py-2">Ikä</th>
                  <th className="text-right font-medium px-3 py-2">Min</th>
                  <th className="text-right font-medium px-3 py-2">Ott</th>
                  <th className="text-right font-medium px-3 py-2">Aloitukset</th>
                  <th className="text-right font-medium px-3 py-2">Penkillä</th>
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
                    <td className="px-3 py-2 text-toissijainen">{p.joukkue}</td>
                    <td className="px-3 py-2 text-right tabular text-toissijainen">
                      {p.ika}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-ice">
                      {p.faktat.minuutit}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-toissijainen">
                      {p.faktat.ottelut}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-toissijainen">
                      {p.faktat.aloitukset}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-toissijainen">
                      {typeof p.faktat.penkilla === 'number' ? p.faktat.penkilla : '–'}
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
