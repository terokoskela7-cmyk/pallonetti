import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { getKaudet, type KausiInfo } from '@/services/api';
import { OLETUSSARJA, sarjaAvain, jarjestaSarjat } from '@/constants/sarjat';

/**
 * Kauden valinta — yksi lähde koko sovellukselle.
 *
 * Kausi luetaan URL-parametrista ?kausi=YYYY, jotta linkki on jaettavissa.
 * Saatavilla olevat kaudet haetaan backendin /api/kaudet-endpointista, joka
 * lukee kaudet-kokoelman. Listaa ei kovakoodata: kun uusi kausi tuodaan,
 * se ilmestyy valitsimeen ilman koodimuutosta.
 *
 * Oletus on uusin saatavilla oleva kausi. Tuntematon tai virheellinen
 * parametri (?kausi=abc, ?kausi=1999) palauttaa oletuksen — sivu ei kaadu
 * eikä jaettu linkki tuota tyhjää näkymää.
 */
interface KausiContextArvo {
  /** Valittu kausi. null vain niin kauan kuin lista latautuu. */
  kausi: number | null;
  /** Valitun sarjan kaudet, uusin ensin. */
  kaudet: KausiInfo[];
  /** Vaihda kausi. Säilyttää polun ja muut hakuparametrit. */
  setKausi: (kausi: number) => void;
  /** Valittu sarja, esim. "Veikkausliiga". */
  sarja: string;
  /** Sarjat, joista on dataa. Johdetaan kausilistasta, ei kovakoodata. */
  sarjat: string[];
  /** Vaihda sarja. Kausi säilyy, jos se on myös uudessa sarjassa. */
  setSarja: (sarja: string) => void;
  loading: boolean;
  /** Tosi jos URL pyysi kautta jota ei ole — käyttöliittymä voi kertoa siitä. */
  pyydettyTuntematon: boolean;
}

const KausiContext = createContext<KausiContextArvo | null>(null);

export function KausiProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [kaikkiKaudet, setKaudet] = useState<KausiInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let peruttu = false;
    // Haetaan KAIKKI sarjat kerralla: sarjavalitsimen lista johdetaan
    // tästä, eikä uusi sarja vaadi koodimuutosta.
    getKaudet('kaikki')
      .then((lista) => {
        if (!peruttu) setKaudet(lista);
      })
      .catch((e: unknown) => {
        // Ei vaienneta: ilman kausilistaa valitsin jää tyhjäksi ja se pitää
        // näkyä lokissa, ei pelkkänä tyhjänä pudotusvalikkona.
        console.error('[useKausi] kausilistan haku epäonnistui:', e);
        if (!peruttu) setKaudet([]);
      })
      .finally(() => {
        if (!peruttu) setLoading(false);
      });
    return () => {
      peruttu = true;
    };
  }, []);

  // ---------- Sarja ----------
  const sarjat = useMemo(
    () => jarjestaSarjat(Array.from(new Set(kaikkiKaudet.map((k) => k.sarja)))),
    [kaikkiKaudet],
  );
  const raakaSarja = searchParams.get('sarja');
  // Tuntematon sarja palautuu oletukseen sen sijaan että sivu kaatuisi.
  // Jaettu linkki ei siis tuota tyhjää näkymää.
  const sarja =
    sarjat.find((x) => sarjaAvain(x) === sarjaAvain(raakaSarja || '')) ??
    (sarjat.includes(OLETUSSARJA) ? OLETUSSARJA : (sarjat[0] ?? OLETUSSARJA));

  // ---------- Kausi valitun sarjan sisällä ----------
  const kaudet = useMemo(
    () => kaikkiKaudet.filter((k) => k.sarja === sarja),
    [kaikkiKaudet, sarja],
  );

  const oletus = kaudet.length > 0 ? kaudet[0].kausi : null;
  const raaka = searchParams.get('kausi');
  const pyydetty = raaka === null ? null : Number.parseInt(raaka, 10);
  const kelvollinen =
    pyydetty !== null &&
    !Number.isNaN(pyydetty) &&
    kaudet.some((k) => k.kausi === pyydetty);

  const kausi = kelvollinen ? pyydetty : oletus;
  const pyydettyTuntematon = raaka !== null && !kelvollinen && !loading;

  const setKausi = useCallback(
    (uusi: number) => {
      // Muokataan nykyisiä parametreja, ei korvata niitä: muut suodattimet
      // ja polku säilyvät kauden vaihdossa.
      const seuraavat = new URLSearchParams(searchParams);
      seuraavat.set('kausi', String(uusi));
      setSearchParams(seuraavat, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const setSarja = useCallback(
    (uusi: string) => {
      const seuraavat = new URLSearchParams(searchParams);
      seuraavat.set('sarja', sarjaAvain(uusi));
      // Kausi säilyy, jos uudessa sarjassa on sama kausi. Muuten siirrytään
      // sen uusimpaan kauteen — tyhjä näkymä olisi huonompi kuin vaihto,
      // joka sanotaan valitsimessa auki.
      const uudenKaudet = kaikkiKaudet.filter((k) => k.sarja === uusi);
      const nykyinen = kausi;
      if (nykyinen !== null && !uudenKaudet.some((k) => k.kausi === nykyinen)) {
        if (uudenKaudet.length > 0) {
          seuraavat.set('kausi', String(uudenKaudet[0].kausi));
        }
      }
      setSearchParams(seuraavat, { replace: false });
    },
    [searchParams, setSearchParams, kaikkiKaudet, kausi],
  );

  const arvo = useMemo(
    () => ({
      kausi,
      kaudet,
      setKausi,
      sarja,
      sarjat,
      setSarja,
      loading,
      pyydettyTuntematon,
    }),
    [kausi, kaudet, setKausi, sarja, sarjat, setSarja, loading, pyydettyTuntematon],
  );

  return <KausiContext.Provider value={arvo}>{children}</KausiContext.Provider>;
}

export function useKausi(): KausiContextArvo {
  const ctx = useContext(KausiContext);
  if (ctx === null) {
    throw new Error('useKausi vaatii KausiProviderin');
  }
  return ctx;
}

/**
 * Portti, joka renderöi sivut vasta kun kausi on ratkaistu. Näin yksikään
 * sivu ei joudu käsittelemään "kausi ei vielä tiedossa" -tilaa, eikä yhtään
 * API-kutsua lähde vajaalla kaudella.
 */
export function KausiPortti({ children }: { children: ReactNode }) {
  const { kausi, loading } = useKausi();

  if (loading) {
    return (
      <div className="px-6 py-20 text-center text-sm text-white/50">
        Haetaan kausia…
      </div>
    );
  }

  if (kausi === null) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-white/70">Kausilistaa ei saatu haettua.</p>
        <p className="text-sm text-white/40 mt-2">
          Yhtään kautta ei ole tuotu, tai taustapalvelu ei vastaa.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Valittu kausi numerona. Käytettävissä vain KausiPortin sisällä, jolloin
 * kausi on aina ratkaistu.
 */
export function useValittuKausi(): number {
  const { kausi } = useKausi();
  if (kausi === null) {
    throw new Error('useValittuKausi vaatii KausiPortin');
  }
  return kausi;
}

/** Valittu sarja. Oletus on Veikkausliiga, joten arvo ei ole koskaan tyhjä. */
export function useValittuSarja(): string {
  return useKausi().sarja;
}
