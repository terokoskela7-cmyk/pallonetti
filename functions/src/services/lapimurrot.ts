// ============================================
// LÄPIMURROT JA DEBYYTIN JÄLKEEN — Veikkausliiga
//
// Kysymykset: ketkä nuoret tekevät läpimurron Veikkausliigassa, mistä he
// tulivat, ja mitä pelaajalle tapahtuu debyyttikauden jälkeen.
//
// MÄÄRITELMÄT (sovittu 22.11.2026):
//   - Debyytti: ensimmäinen kausi, jolla pelaajalla on Veikkausliiga-
//     minuutteja. Aineiston ensimmäisellä kaudella debyyttiä ei voi
//     erottaa aiemmin pelanneesta, joten se merkitään "ei tiedossa" eikä
//     lasketa yhteenvetoihin.
//   - Läpimurto: 450 kumulatiivista Veikkausliiga-minuuttia. Raja on
//     ECA:n ja Football Benchmarkin "successful transition" -määritelmä
//     (450 kumulatiivista edustusjoukkueen minuuttia kilpailullisissa
//     seuraotteluissa).
//   - Vakiintunut kausi: vähintään 20 % pääseuran kauden minuuteista
//     (joukkueen ottelut × 90). Tämä on pallonetin oma raja, ei
//     tutkimuksesta.
//   - Debyytin jälkeen luokitellaan seuraavan kauden perusteella:
//     kasvoi (≥ 1,2 × debyyttikauden minuutit), pysyi (0,8–1,2 ×),
//     laski (< 0,8 ×), ei peliaikaa (Veikkausliigan kokoonpanossa ilman
//     minuutteja), alempi sarja, täytti 22 (ikäraja, ei datassa) ja
//     ei datassa (ulkomaat, alemmat sarjat kuin Ykkönen, lopettanut —
//     näitä ei voi erottaa toisistaan).
//
// KOTIMAINEN: Suomen kansalainen Veikkausliigan pelaajarekisterin mukaan
// (seasons/{kausi}/kansalaisuudet, sama luokittelu kuin trendeissä:
// koodi FIN ja seura vahvistettu). Rekisterissä on yksi koodi per pelaaja,
// joten kaksoiskansalaisuus ei näy. Pelaaja on "suomi", jos hän on FIN
// millä tahansa kaudella; "ei tietoa", jos rekisteristä ei löydy mitään.
//
// AKATEMIAN KAUTTA (22.11.2026): pelaaja pelasi seuran akatemiajoukkueessa
// (HJK Klubi 04, SJK Akatemia, KuPS Akatemia I) viimeistään
// debyyttikaudellaan ja debytoi emoseurassa. EI ole sama kuin oma
// kasvatti: akatemiajoukkueissa pelaa myös hankittuja, ulkomaisia nuoria.
// Oma kasvatti (seurahistoria 15–21-vuotiaana, UEFA/CIES "club-trained")
// lasketaan, kun junioridata tuodaan.
//
// TUNNISTE: palloid. Vanhoilta riveiltä (Veikkausliiga ennen 22.11.2026
// tuontia) palloid puuttuu; niille haetaan palloid saman slugin riveiltä,
// kun slug vastaa täsmälleen yhtä palloidia. Muuten tunniste on slug.
//
// Laskenta on puhdas funktio; Firestore-luku on erikseen.
// ============================================
import type { firestore } from 'firebase-admin';
import { sarjanTaso, VEIKKAUSLIIGA } from './sarjatasot';
import { lueKausi } from './kausiData';
import { OLETUSSARJA } from './kausiImport';
import { AKATEMIA_EMOSEURA } from './polku';
import { luokitteleKansalaisuudet } from './trendit';

export const LAPIMURTO_MIN = 450;
export const VAKIINTUNUT_OSUUS = 0.2;
const KASVOI = 1.2;
const LASKI = 0.8;
/** Ikä, jonka jälkeen pelaaja ei enää ole 17–21-aineistossa. */
const AINEISTON_YLA_IKA = 21;

export interface LapimurtoRivi {
  sarja: string;
  kausi: number;
  palloid?: string | null;
  slug: string;
  nimi: string;
  ika: number;
  joukkue: string;
  minuutit: number;
}

export type JalkeenLuokka =
  | 'kasvoi'
  | 'pysyi'
  | 'laski'
  | 'ei peliaikaa'
  | 'alempi sarja'
  | 'täytti 22'
  | 'ei datassa'
  | 'ei vielä';

export type Kansalaisuus = 'suomi' | 'muu' | 'ei tietoa';

export interface DebytoijanPolku {
  slug: string;
  nimi: string;
  kansalaisuus: Kansalaisuus;
  /** Pelasi emoseuran akatemiajoukkueessa ennen debyyttiä tai sen aikana. */
  akatemianKasvatti: boolean;
  debyyttiKausi: number;
  /** false = aineiston ensimmäinen kausi, aiempaa ei tiedetä. */
  debyyttiTiedossa: boolean;
  debyyttiIka: number;
  debyyttiSeura: string;
  debyyttiMin: number;
  /** Debyyttiä edeltävä kausi alemmalla tasolla, jos datassa. */
  ennen: { sarja: string; taso: number; seura: string; min: number } | null;
  jalkeen: { luokka: JalkeenLuokka; sarja: string | null; min: number | null };
  lapimurtoKausi: number | null;
  vakiintunutKausi: number | null;
  vlMinYhteensa: number;
  kaudet: { kausi: number; sarja: string; seura: string; min: number }[];
}

export interface DebyyttikausiYhteenveto {
  kausi: number;
  debytoineet: number;
  /** Debyyttikauden Veikkausliiga-minuutit yhteensä. */
  debyyttiMinuutit: number;
  /** Ryhmän pelaajien kaikki Veikkausliiga-minuutit (kaikki kaudet). */
  vlMinuutit: number;
  /** Debytoineet, joiden kansalaisuutta ei tiedetä. */
  eiKansalaisuustietoa: number;
  lapimurto: number;
  vakiintunut: number;
  /** Vain alemmalta tasolta tulleet (ennen ≠ null). */
  alemmaltaTasolta: number;
  jalkeen: Record<JalkeenLuokka, number>;
}

export interface LapimurtoTulos {
  maaritelmat: { lapimurtoMin: number; vakiintunutOsuus: number };
  vlKaudet: number[];
  /** Kaudet, joilta Veikkausliigan kansalaisuustieto on. */
  kansalaisuusKaudet: number[];
  yhteenveto: DebyyttikausiYhteenveto[];
  /** Sama vain Suomen kansalaisille. */
  yhteenvetoSuomi: DebyyttikausiYhteenveto[];
  /** Sama vain akatemian kautta tulleille omille kasvateille. */
  yhteenvetoKasvatit: DebyyttikausiYhteenveto[];
  pelaajat: DebytoijanPolku[];
}

interface KausiKooste {
  sarja: string;
  kausi: number;
  min: number;
  rivit: number;
  ika: number;
  seurat: Map<string, number>;
}

function paaseura(k: KausiKooste): string {
  return [...k.seurat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/**
 * @param joukkueenOttelut  avain `${sarja}|${kausi}|${joukkue}` → joukkueen
 *                          ottelut kaudella (kaikki vaiheet yhteensä)
 */
export function laskeLapimurrot(
  rivit: LapimurtoRivi[],
  joukkueenOttelut: Map<string, number>,
  /** slug → 'FIN' tai muu koodi; vain Veikkausliigan rekisteristä. */
  kansalaisuudet: Map<string, 'FIN' | 'muu'> = new Map(),
  kansalaisuusKaudet: number[] = [],
): LapimurtoTulos {
  // 1) Tunniste: palloid, vanhoille riveille slugin kautta.
  const slugPalloidit = new Map<string, Set<string>>();
  for (const r of rivit) {
    if (!r.palloid) continue;
    const s = slugPalloidit.get(r.slug) ?? new Set<string>();
    s.add(r.palloid);
    slugPalloidit.set(r.slug, s);
  }
  const tunniste = (r: LapimurtoRivi): string => {
    if (r.palloid) return 'p:' + r.palloid;
    const p = slugPalloidit.get(r.slug);
    return p && p.size === 1 ? 'p:' + [...p][0] : 's:' + r.slug;
  };

  // 2) Pelaaja → (sarja|kausi) → kooste.
  const pelaajat = new Map<
    string,
    { slug: string; nimi: string; slugit: Set<string>; kaudet: Map<string, KausiKooste> }
  >();
  const vlKaudetSet = new Set<number>();
  for (const r of rivit) {
    if (r.sarja === VEIKKAUSLIIGA) vlKaudetSet.add(r.kausi);
    const t = tunniste(r);
    const p = pelaajat.get(t) ?? {
      slug: r.slug,
      nimi: r.nimi,
      slugit: new Set<string>(),
      kaudet: new Map(),
    };
    p.slugit.add(r.slug);
    // Uusin rivi määrää nimen ja slugin (linkki pelaajasivulle).
    const avain = r.sarja + '|' + r.kausi;
    const k = p.kaudet.get(avain) ?? {
      sarja: r.sarja,
      kausi: r.kausi,
      min: 0,
      rivit: 0,
      ika: 0,
      seurat: new Map<string, number>(),
    };
    k.min += r.minuutit;
    k.rivit += 1;
    k.ika = Math.max(k.ika, r.ika || 0);
    k.seurat.set(r.joukkue, (k.seurat.get(r.joukkue) ?? 0) + r.minuutit);
    p.kaudet.set(avain, k);
    pelaajat.set(t, p);
  }
  const vlKaudet = [...vlKaudetSet].sort((a, b) => a - b);
  const ensimmainenVl = vlKaudet[0];
  const viimeisinVl = vlKaudet[vlKaudet.length - 1];

  const tulos: DebytoijanPolku[] = [];
  for (const p of pelaajat.values()) {
    const vl = [...p.kaudet.values()]
      .filter((k) => k.sarja === VEIKKAUSLIIGA)
      .sort((a, b) => a.kausi - b.kausi);
    const deb = vl.find((k) => k.min > 0);
    if (!deb) continue;

    // Läpimurto: kumulatiivinen raja.
    let kum = 0;
    let lapimurtoKausi: number | null = null;
    for (const k of vl) {
      kum += k.min;
      if (lapimurtoKausi === null && kum >= LAPIMURTO_MIN) lapimurtoKausi = k.kausi;
    }

    // Vakiintunut: pääseuran minuuteista ≥ 20 %.
    let vakiintunutKausi: number | null = null;
    for (const k of vl) {
      const seura = paaseura(k);
      const ott = joukkueenOttelut.get(VEIKKAUSLIIGA + '|' + k.kausi + '|' + seura) ?? 0;
      if (ott > 0 && (k.seurat.get(seura) ?? 0) / (ott * 90) >= VAKIINTUNUT_OSUUS) {
        vakiintunutKausi = k.kausi;
        break;
      }
    }

    // Ennen: debyyttiä edeltävä kausi alemmalla tasolla (eniten minuutteja).
    const edellinen = [...p.kaudet.values()]
      .filter((k) => k.kausi === deb.kausi - 1 && k.sarja !== VEIKKAUSLIIGA && k.min > 0)
      .sort((a, b) => b.min - a.min)[0];
    const ennen = edellinen
      ? {
          sarja: edellinen.sarja,
          taso: sarjanTaso(edellinen.sarja, edellinen.kausi) ?? 0,
          seura: paaseura(edellinen),
          min: edellinen.min,
        }
      : null;

    // Jälkeen: seuraava kausi.
    const seuraava = deb.kausi + 1;
    let jalkeen: DebytoijanPolku['jalkeen'];
    if (seuraava > viimeisinVl) {
      jalkeen = { luokka: 'ei vielä', sarja: null, min: null };
    } else {
      const vlSeur = p.kaudet.get(VEIKKAUSLIIGA + '|' + seuraava);
      const alempi = [...p.kaudet.values()]
        .filter((k) => k.kausi === seuraava && k.sarja !== VEIKKAUSLIIGA && k.min > 0)
        .sort((a, b) => b.min - a.min)[0];
      if (vlSeur && vlSeur.min > 0) {
        const suhde = vlSeur.min / deb.min;
        jalkeen = {
          luokka: suhde >= KASVOI ? 'kasvoi' : suhde >= LASKI ? 'pysyi' : 'laski',
          sarja: VEIKKAUSLIIGA,
          min: vlSeur.min,
        };
      } else if (alempi) {
        jalkeen = { luokka: 'alempi sarja', sarja: alempi.sarja, min: alempi.min };
      } else if (vlSeur) {
        jalkeen = { luokka: 'ei peliaikaa', sarja: VEIKKAUSLIIGA, min: 0 };
      } else if (deb.ika >= AINEISTON_YLA_IKA) {
        jalkeen = { luokka: 'täytti 22', sarja: null, min: null };
      } else {
        jalkeen = { luokka: 'ei datassa', sarja: null, min: null };
      }
    }

    // Kansalaisuus: FIN millä tahansa slugilla voittaa.
    const koodit = [...p.slugit].map((x) => kansalaisuudet.get(x)).filter(Boolean);
    const kansalaisuus: Kansalaisuus = koodit.includes('FIN')
      ? 'suomi'
      : koodit.length > 0
        ? 'muu'
        : 'ei tietoa';

    // Akatemian kasvatti: emoseuran akatemiajoukkue viimeistään debyyttikaudella.
    const debyyttiSeura = paaseura(deb);
    const akatemianKasvatti = [...p.kaudet.values()].some(
      (k) =>
        k.kausi <= deb.kausi &&
        [...k.seurat.keys()].some(
          (seura) =>
            (AKATEMIA_EMOSEURA[seura.replace(/\s+/g, ' ').trim().toLowerCase()] ?? '')
              .toLowerCase() === debyyttiSeura.toLowerCase(),
        ),
    );

    tulos.push({
      slug: p.slug,
      nimi: p.nimi,
      kansalaisuus,
      akatemianKasvatti,
      debyyttiKausi: deb.kausi,
      debyyttiTiedossa: deb.kausi > ensimmainenVl,
      debyyttiIka: deb.ika,
      debyyttiSeura,
      debyyttiMin: deb.min,
      ennen,
      jalkeen,
      lapimurtoKausi,
      vakiintunutKausi,
      vlMinYhteensa: vl.reduce((s, k) => s + k.min, 0),
      kaudet: [...p.kaudet.values()]
        .filter((k) => k.min > 0)
        .sort((a, b) => a.kausi - b.kausi || (sarjanTaso(a.sarja, a.kausi) ?? 9) - (sarjanTaso(b.sarja, b.kausi) ?? 9))
        .map((k) => ({ kausi: k.kausi, sarja: k.sarja, seura: paaseura(k), min: k.min })),
    });
  }

  // Yhteenveto debyyttikausittain (vain tiedossa olevat debyytit).
  const tyhjaJalkeen = (): Record<JalkeenLuokka, number> => ({
    kasvoi: 0,
    pysyi: 0,
    laski: 0,
    'ei peliaikaa': 0,
    'alempi sarja': 0,
    'täytti 22': 0,
    'ei datassa': 0,
    'ei vielä': 0,
  });
  const laskeYhteenveto = (
    mukaan: (t: DebytoijanPolku) => boolean,
  ): DebyyttikausiYhteenveto[] =>
    vlKaudet
      .filter((k) => k > ensimmainenVl)
      .map((kausi) => {
        const ryhma = tulos.filter(
          (t) => t.debyyttiTiedossa && t.debyyttiKausi === kausi && mukaan(t),
        );
        const jalkeen = tyhjaJalkeen();
        for (const t of ryhma) jalkeen[t.jalkeen.luokka] += 1;
        return {
          kausi,
          debytoineet: ryhma.length,
          debyyttiMinuutit: ryhma.reduce((s, t) => s + t.debyyttiMin, 0),
          vlMinuutit: ryhma.reduce((s, t) => s + t.vlMinYhteensa, 0),
          eiKansalaisuustietoa: ryhma.filter((t) => t.kansalaisuus === 'ei tietoa').length,
          lapimurto: ryhma.filter((t) => t.lapimurtoKausi !== null).length,
          vakiintunut: ryhma.filter((t) => t.vakiintunutKausi !== null).length,
          alemmaltaTasolta: ryhma.filter((t) => t.ennen !== null).length,
          jalkeen,
        };
      })
      .sort((a, b) => b.kausi - a.kausi);

  return {
    maaritelmat: { lapimurtoMin: LAPIMURTO_MIN, vakiintunutOsuus: VAKIINTUNUT_OSUUS },
    vlKaudet,
    kansalaisuusKaudet: [...kansalaisuusKaudet].sort((a, b) => a - b),
    yhteenveto: laskeYhteenveto(() => true),
    yhteenvetoSuomi: laskeYhteenveto((t) => t.kansalaisuus === 'suomi'),
    yhteenvetoKasvatit: laskeYhteenveto((t) => t.akatemianKasvatti),
    // Uusin debyytti ensin, saman kauden sisällä eniten VL-minuutteja.
    pelaajat: tulos.sort(
      (a, b) => b.debyyttiKausi - a.debyyttiKausi || b.vlMinYhteensa - a.vlMinYhteensa,
    ),
  };
}

/**
 * Lukee kaikki tuodut kaudet ja sarjat (kaudet-kokoelma, vanhentuneet
 * pois) ja laskee läpimurrot. Pelkkä luku.
 */
export async function haeLapimurrot(db: firestore.Firestore): Promise<LapimurtoTulos> {
  const kaudetSnap = await db.collection('kaudet').get();
  const parit = new Map<string, { kausi: number; sarja: string }>();
  for (const d of kaudetSnap.docs) {
    const x = d.data();
    if (x.vanhentunut === true) continue;
    const kausi = Number(x.vuosi);
    const sarja = (x.sarja as string) || OLETUSSARJA;
    if (isNaN(kausi) || sarjanTaso(sarja, kausi) === null) continue;
    parit.set(sarja + '|' + kausi, { kausi, sarja });
  }

  const luetut = await Promise.all(
    [...parit.values()].map(async (p) => ({ ...p, data: await lueKausi(db, p.kausi, p.sarja) })),
  );

  const rivit: LapimurtoRivi[] = [];
  const joukkueenOttelut = new Map<string, number>();
  for (const { kausi, sarja, data } of luetut) {
    for (const s of data.suoritukset) {
      rivit.push({
        sarja,
        kausi,
        palloid: s.palloid ?? null,
        slug: s.slug,
        nimi: (s.etunimi + ' ' + s.sukunimi).trim(),
        ika: s.ika,
        joukkue: s.joukkue,
        minuutit: s.minuutit,
      });
    }
    for (const n of data.nimittajat) {
      const avain = sarja + '|' + kausi + '|' + n.joukkue;
      joukkueenOttelut.set(avain, (joukkueenOttelut.get(avain) ?? 0) + n.ottelut);
    }
  }
  // Kansalaisuudet Veikkausliigan kausilta (sama luokittelu kuin trendeissä).
  const vlVuodet = [...new Set(luetut.filter((l) => l.sarja === VEIKKAUSLIIGA).map((l) => l.kausi))];
  const kansalaisuudet = new Map<string, 'FIN' | 'muu'>();
  const kansalaisuusKaudet: number[] = [];
  const snapit = await Promise.all(
    vlVuodet.map((k) =>
      db.collection('seasons').doc(String(k)).collection('kansalaisuudet').get()
        .then((snap) => ({ k, snap })),
    ),
  );
  for (const { k, snap } of snapit) {
    const luokat = luokitteleKansalaisuudet(snap.docs);
    if (!luokat.saatavilla) continue;
    kansalaisuusKaudet.push(k);
    for (const slug of luokat.muu) if (!kansalaisuudet.has(slug)) kansalaisuudet.set(slug, 'muu');
    for (const slug of luokat.fin) kansalaisuudet.set(slug, 'FIN');
  }
  return laskeLapimurrot(rivit, joukkueenOttelut, kansalaisuudet, kansalaisuusKaudet);
}
