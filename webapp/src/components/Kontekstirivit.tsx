// ============================================
// KONTEKSTIRIVIT — luvut lauseina
//
// Lauseet EIVAT synny taalla. Ne tulevat rajapinnasta valmiina, koska
// sama lause naytetaan myohemmin useassa paikassa ja se on
// yksikkotestattava ilman selainta. Tama komponentti valitsee vain,
// montako rivia naytetaan, ja piirtaa nuolen.
//
// Nuoli tarkoittaa vertailua ikaryhman mediaaniin: yli, tasolla tai
// alle. Mediaani lasketaan peliaikaa saaneista. Jos mediaania ei voi
// laskea, nuolta ei nayteta — tyhja merkki on rehellisempi kuin
// arvattu suunta. Merkin merkitys sanotaan auki rivin vieressa, jotta
// symbolia ei tarvitse arvata.
// ============================================
import type { Konteksti, Kontekstirivi, Nuoli } from '@/services/api';

/**
 * Pelaajasivulla naytetaan KAIKKI moottorin tuottamat rivit. Kolmen
 * rivin katto pudottaisi juuri sen lauseen, joka erottaa pelaajan
 * muista: Ruopilla se olisi maalisijoitus, Likalla Ykkosliigan
 * maalikarki. Tiiviimmat nakymat (listat, kortit) antavat oman
 * maxRiveja-arvonsa.
 */
const OLETUS_MAX_RIVIA = Number.POSITIVE_INFINITY;

const NUOLI_MERKKI: Record<Nuoli, string> = {
  yli: '↑',
  tasolla: '→',
  alle: '↓',
};

const NUOLI_SELITE: Record<Nuoli, string> = {
  yli: 'yli ikäryhmän mediaanin',
  tasolla: 'ikäryhmän mediaanin tasolla',
  alle: 'alle ikäryhmän mediaanin',
};

function NuoliMerkki({ rivi }: { rivi: Kontekstirivi }) {
  if (rivi.nuoli === null) {
    // Paikka varataan silti, jotta lauseet pysyvat samassa linjassa.
    return <span className="w-4 shrink-0" aria-hidden="true" />;
  }
  const selite =
    NUOLI_SELITE[rivi.nuoli] +
    (rivi.mediaani === null
      ? ''
      : ' (' + rivi.mediaani + ' ' + rivi.yksikko + ')') +
    (rivi.vertailujoukko === null ? '' : ' · ' + rivi.vertailujoukko);
  return (
    <span
      className="w-4 shrink-0 text-ice/70 text-center leading-6"
      title={selite}
      aria-label={selite}
      role="img"
    >
      {NUOLI_MERKKI[rivi.nuoli]}
    </span>
  );
}

interface Props {
  /** Riittaa, etta objektilla on rivit — listanakymissa ei ole ohitettuja. */
  konteksti: Pick<Konteksti, 'rivit'> | null;
  /**
   * Montako rivia naytetaan enintaan. Moottori palauttaa rivit
   * jarjestyksessa peliaika ensin, joten tiiviissa nakymassa katto
   * jattaa nakyviin juuri peliaikarivit.
   */
  maxRiveja?: number;
  /** Tiivis muoto listoihin: pelkat rivit ilman kehysta ja selitetta. */
  tiivis?: boolean;
}

export function Kontekstirivit({
  konteksti,
  maxRiveja = OLETUS_MAX_RIVIA,
  tiivis = false,
}: Props) {
  const rivit = (konteksti?.rivit ?? []).slice(0, maxRiveja);
  // Ei lauseita = ei osiota. Tyhja tila on parempi kuin merkityksetön
  // lause, eika puuttuvaa lausetta korvata placeholder-tekstilla.
  if (rivit.length === 0) return null;

  const nuoliaNakyvissa = rivit.some((r) => r.nuoli !== null);

  const lista = (
    <ul className="space-y-1.5">
      {rivit.map((rivi) => (
        <li key={rivi.id} className="flex items-start gap-2 text-sm text-white/85">
          <NuoliMerkki rivi={rivi} />
          <span className="tabular leading-6">{rivi.teksti}</span>
        </li>
      ))}
    </ul>
  );

  if (tiivis) return lista;

  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-white/40">
        Konteksti
      </h2>
      {lista}
      {nuoliaNakyvissa && (
        <p className="text-[11px] text-white/40 leading-relaxed">
          Nuoli vertaa ikäryhmän mediaaniin: ↑ yli, → tasolla, ↓ alle.
          Mediaani lasketaan peliaikaa saaneista.
        </p>
      )}
    </section>
  );
}
