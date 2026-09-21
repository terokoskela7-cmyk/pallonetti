// ============================================
// POLKU YKKOSLIIGASTA VEIKKAUSLIIGAAN
//
// Kysymys: kuinka moni nuori nousee Ykkosliigasta Veikkausliigaan, ja
// mita kautta. Pelkka "nousi Veikkausliigaan" -luku olisi harhaanjohtava,
// koska se sisaltaa kolme eri ilmiota: pelaaja vaihtoi seuraa, pelaajan
// seura nousi sarjassa, tai pelaaja siirtyi akatemiajoukkueesta
// emoseuraansa. Nama erotetaan toisistaan.
//
// MAARITELMAT (sovittu 21.9.2026):
//   - Mukaan vain pelaajat, joilla on peliminuutteja MOLEMMISSA: kaudella
//     N Ykkosliigassa ja kaudella N+1 Veikkausliigassa. Pelkka kokoonpano
//     ei riita, ja kokoonpanotapausten maara kerrotaan erikseen.
//   - Debyytti on minuuttipohjainen: pelaajalla ei ole Veikkausliiga-
//     minuutteja millaan aiemmalla kaudella.
//   - Jako lasketaan DEBYTOINEISTA. "Seura nousi" ja "vaihtoi seuraa"
//     summautuvat debytoineisiin; akatemiarivit ovat osa "vaihtoi
//     seuraa" -lukua.
//   - Nousseet seurat paatellaan datasta: seura on kaudella N
//     Ykkosliigassa ja kaudella N+1 Veikkausliigassa. Listaa ei
//     kovakoodata.
//   - Akatemia-emoseura-parit ovat nimetty vakio, ei nimesta paateltava
//     saanto.
// ============================================
import { firestore } from 'firebase-admin';
import { lueKausi, type SuoritusDoc } from './kausiData';
import { onAkatemia } from './akatemiat';

/** Akatemiajoukkueen emoseura. Pari on nimetty, ei paateltava. */
export const AKATEMIA_EMOSEURA: Record<string, string> = {
  'hjk klubi 04': 'HJK',
  'sjk akatemia': 'SJK',
};

const VEIKKAUSLIIGA = 'Veikkausliiga';
const YKKOSLIIGA = 'Ykkösliiga';

/** Ensimmainen kausi, jolta dataa on. */
const ENSIMMAINEN_KAUSI = 2020;

function seuraAvain(nimi: string): string {
  return String(nimi || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface PolkuPelaaja {
  slug: string;
  nimi: string;
  ika: number;
  ylSeura: string;
  ylMinuutit: number;
  vlSeura: string;
  vlMinuutit: number;
  debytoi: boolean;
  /** 'seura nousi' | 'vaihtoi seuraa' — vain debytoineille. */
  luokka: string | null;
  /** 'emoseuraan' | 'muualle' | null. */
  akatemiasta: string | null;
}

export interface PolkuTulos {
  /** Kausi, jolta noustiin. */
  kausiN: number;
  /** Kausi, jolle noustiin. */
  kausiN1: number;
  saatavilla: boolean;
  nousseet: number;
  debytoi: number;
  seuraNousi: number;
  nousseetSeurat: string[];
  vaihtoiSeuraa: number;
  akatemiastaEmoseuraan: number;
  akatemiastaMuualle: number;
  /** Molempien kausien aineistossa, mutta ilman minuutteja jommassakummassa. */
  vainKokoonpanossa: number;
  toiseenSuuntaan: number;
  /** Debytoineiden Ykkosliiga-minuuttien mediaani. */
  mediaaniYlMinuutit: number | null;
  pelaajat: PolkuPelaaja[];
}

interface Kooste {
  slug: string;
  nimi: string;
  ika: number;
  min: number;
  seurat: Map<string, number>;
}

/** Pelaajakohtainen kooste kaudelta. `vainMinuutit` pudottaa 0 min rivit. */
function kooste(
  suoritukset: SuoritusDoc[],
  vainMinuutit: boolean,
): Map<string, Kooste> {
  const m = new Map<string, Kooste>();
  for (const x of suoritukset) {
    if (vainMinuutit && x.minuutit <= 0) continue;
    const e = m.get(x.slug) ?? {
      slug: x.slug,
      nimi: (x.etunimi + ' ' + x.sukunimi).trim(),
      ika: x.ika,
      min: 0,
      seurat: new Map<string, number>(),
    };
    e.min += x.minuutit;
    e.ika = Math.max(e.ika, x.ika);
    e.seurat.set(x.joukkue, (e.seurat.get(x.joukkue) ?? 0) + x.minuutit);
    m.set(x.slug, e);
  }
  return m;
}

/** Seura, jossa pelaaja pelasi kaudella eniten. */
function paaseura(e: Kooste): string {
  return [...e.seurat.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function mediaani(arvot: number[]): number | null {
  if (arvot.length === 0) return null;
  const s = arvot.slice().sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
}

/**
 * Polku kaudelta N kaudelle N+1. Laskenta tehdaan palvelimella: selain ei
 * laske lukuja, jottei sama saanto paase eriytymaan kahteen paikkaan.
 */
export async function laskePolku(
  db: firestore.Firestore,
  kausiN1: number,
): Promise<PolkuTulos> {
  const kausiN = kausiN1 - 1;
  const tyhja: PolkuTulos = {
    kausiN,
    kausiN1,
    saatavilla: false,
    nousseet: 0,
    debytoi: 0,
    seuraNousi: 0,
    nousseetSeurat: [],
    vaihtoiSeuraa: 0,
    akatemiastaEmoseuraan: 0,
    akatemiastaMuualle: 0,
    vainKokoonpanossa: 0,
    toiseenSuuntaan: 0,
    mediaaniYlMinuutit: null,
    pelaajat: [],
  };
  if (kausiN < ENSIMMAINEN_KAUSI) return tyhja;

  const [ylN, vlN1, vlN, ylN1] = await Promise.all([
    lueKausi(db, kausiN, YKKOSLIIGA),
    lueKausi(db, kausiN1, VEIKKAUSLIIGA),
    lueKausi(db, kausiN, VEIKKAUSLIIGA),
    lueKausi(db, kausiN1, YKKOSLIIGA),
  ]);

  // Ilman Ykkosliigan dataa siirtymaa ei ole — ei naytetä tyhjana.
  if (ylN.suoritukset.length === 0 || vlN1.suoritukset.length === 0) {
    return tyhja;
  }

  const yl = kooste(ylN.suoritukset, true);
  const vl = kooste(vlN1.suoritukset, true);
  const ylKaikki = kooste(ylN.suoritukset, false);
  const vlKaikki = kooste(vlN1.suoritukset, false);

  const nousseet = [...yl.values()].filter((e) => vl.has(e.slug));

  // Vain kokoonpanossa: molempien kausien aineistossa, mutta minuutit
  // puuttuvat ainakin toisesta sarjasta.
  const vainKokoonpanossa = [...ylKaikki.values()].filter(
    (e) => vlKaikki.has(e.slug) && !(yl.has(e.slug) && vl.has(e.slug)),
  ).length;

  // Debyytti: ei Veikkausliiga-minuutteja millaan aiemmalla kaudella.
  const aiemmat = new Set<string>();
  for (let k = ENSIMMAINEN_KAUSI; k <= kausiN; k++) {
    const kausi = k === kausiN ? vlN : await lueKausi(db, k, VEIKKAUSLIIGA);
    for (const s of kausi.suoritukset) {
      if (s.minuutit > 0) aiemmat.add(s.slug);
    }
  }

  // Nousseet seurat datasta: sama seura Ykkosliigassa N ja VL:ssa N+1.
  const ylSeurat = new Set(ylN.nimittajat.map((n) => n.joukkue));
  const vlSeurat = new Set(vlN1.nimittajat.map((n) => n.joukkue));
  const nousseetSeurat = [...ylSeurat]
    .filter((j) => vlSeurat.has(j))
    .sort((a, b) => a.localeCompare(b, 'fi'));

  const pelaajat: PolkuPelaaja[] = nousseet.map((e) => {
    const v = vl.get(e.slug)!;
    const ylSeura = paaseura(e);
    const vlSeura = paaseura(v);
    const debytoi = !aiemmat.has(e.slug);
    const samaSeura = seuraAvain(ylSeura) === seuraAvain(vlSeura);
    const emo = AKATEMIA_EMOSEURA[seuraAvain(ylSeura)];
    return {
      slug: e.slug,
      nimi: e.nimi,
      ika: e.ika,
      ylSeura,
      ylMinuutit: e.min,
      vlSeura,
      vlMinuutit: v.min,
      debytoi,
      luokka: debytoi ? (samaSeura ? 'seura nousi' : 'vaihtoi seuraa') : null,
      akatemiasta: onAkatemia(ylSeura)
        ? emo && seuraAvain(emo) === seuraAvain(vlSeura)
          ? 'emoseuraan'
          : 'muualle'
        : null,
    };
  });

  const debytoineet = pelaajat.filter((p) => p.debytoi);
  const vaihtoi = debytoineet.filter((p) => p.luokka === 'vaihtoi seuraa');

  const vlNmin = kooste(vlN.suoritukset, true);
  const ylN1min = kooste(ylN1.suoritukset, true);

  return {
    kausiN,
    kausiN1,
    saatavilla: true,
    nousseet: nousseet.length,
    debytoi: debytoineet.length,
    seuraNousi: debytoineet.filter((p) => p.luokka === 'seura nousi').length,
    nousseetSeurat,
    vaihtoiSeuraa: vaihtoi.length,
    akatemiastaEmoseuraan: vaihtoi.filter((p) => p.akatemiasta === 'emoseuraan')
      .length,
    akatemiastaMuualle: vaihtoi.filter((p) => p.akatemiasta === 'muualle').length,
    vainKokoonpanossa,
    toiseenSuuntaan: [...vlNmin.values()].filter((e) => ylN1min.has(e.slug))
      .length,
    mediaaniYlMinuutit: mediaani(debytoineet.map((p) => p.ylMinuutit)),
    // Jarjestys: eniten Ykkosliiga-minuutteja ensin.
    pelaajat: pelaajat.sort((a, b) => b.ylMinuutit - a.ylMinuutit),
  };
}
