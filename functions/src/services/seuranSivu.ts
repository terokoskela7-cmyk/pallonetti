// ============================================
// SEURAN SIVUN KOKOAMINEN
//
// Reitti (index.ts) ei laske mitaan: se jasentaa parametrit, kutsuu
// tata ja muotoilee vastauksen. Kaikki luku ja laskenta on taalla,
// jotta se on testattavissa ilman Expressia ja jotta sama kokoaminen
// on kaytettavissa tarkistusskriptista kasin.
//
// Laskenta itse on seurat.ts:ssa ja konteksti.ts:ssa — tama moduuli
// vain lukee Firestoresta ja yhdistaa palaset.
// ============================================
import type { firestore } from 'firebase-admin';
import { lueKausi } from './kausiData';
import {
  laskeSeurakausi,
  laskeSeuranAikasarja,
  laskeSeuranYlaraja,
  LIUKUVA_IKKUNA,
  type Seurakausi,
  type SeuranKausipiste,
} from './seurat';
import { laskeKaudenKontekstit, type Konteksti } from './konteksti';
import { haeSiirto, type Siirto } from './siirrot';
import { TUETUT_SARJAT, OLETUSSARJA } from './kausiImport';

export interface SeuranSivu {
  tunniste: string;
  nimi: string;
  akatemia: boolean;
  kausi: number;
  /** Sarja, jossa seura pelasi valittuna kautena. null = ei kummassakaan. */
  sarja: string | null;
  seurakausi: Seurakausi | null;
  pelaajat: Array<Omit<Konteksti, 'ohitetut'> & { siirto: Siirto | null }>;
  aikasarja: {
    kaudet: number[];
    pisteet: SeuranKausipiste[];
    liukuva: Array<number | null>;
    useitaSarjoja: boolean;
  };
  /** Sarjat, joissa seura on pelannut. Akselin selite nojaa tahan. */
  sarjatMukana: string[];
  ylaraja: number;
  liukuvaIkkuna: number;
}

/**
 * Kaikkien sarjojen kaikki kaudet seuroittain.
 *
 * Seuran historia voi ulottua sarjasta toiseen, joten molemmat luetaan.
 * Sarja suodatetaan muistissa ja vanhentuneet jaavat pois lueKausi:n
 * kautta, kuten muuallakin.
 */
export async function lueKaikkiSarjat(
  db: firestore.Firestore,
): Promise<{
  kausittainSarjoittain: Map<string, Map<number, Seurakausi[]>>;
  kaudet: number[];
}> {
  const kaudetSnap = await db.collection('kaudet').get();
  const kausiRivit = kaudetSnap.docs
    .map((d) => d.data())
    .filter((k) => k.vanhentunut !== true);

  const kausittainSarjoittain = new Map<string, Map<number, Seurakausi[]>>();
  const kaikkiKaudet = new Set<number>();

  for (const sarja of TUETUT_SARJAT) {
    const kaudet = Array.from(
      new Set(
        kausiRivit
          .filter((k) => ((k.sarja as string) || OLETUSSARJA) === sarja)
          .map((k) => (k.vuosi as number) ?? parseInt(String(k.kausi), 10))
          .filter((v) => !isNaN(v)),
      ),
    ).sort((a, b) => a - b);

    const kausittain = new Map<number, Seurakausi[]>();
    for (const kausi of kaudet) {
      const { suoritukset, nimittajat } = await lueKausi(db, kausi, sarja);
      kausittain.set(kausi, laskeSeurakausi(kausi, sarja, suoritukset, nimittajat));
      kaikkiKaudet.add(kausi);
    }
    kausittainSarjoittain.set(sarja, kausittain);
  }

  return {
    kausittainSarjoittain,
    kaudet: Array.from(kaikkiKaudet).sort((a, b) => a - b),
  };
}

/**
 * Seuran nimi ja akatemiatieto tunnisteen perusteella, tai null jos
 * tunnistetta ei tunneta. Reitti tekee nullista 404:n.
 *
 * Nimi otetaan viimeisimmalta kaudelta, jolla seura esiintyy.
 */
export function etsiSeura(
  tunniste: string,
  kausittainSarjoittain: Map<string, Map<number, Seurakausi[]>>,
): { nimi: string; akatemia: boolean } | null {
  let loydetty: { nimi: string; akatemia: boolean; kausi: number } | null = null;
  for (const kausittain of kausittainSarjoittain.values()) {
    for (const [kausi, rivit] of kausittain) {
      const osuma = rivit.find((s) => s.tunniste === tunniste);
      if (osuma && (loydetty === null || kausi > loydetty.kausi)) {
        loydetty = { nimi: osuma.nimi, akatemia: osuma.akatemia, kausi };
      }
    }
  }
  return loydetty === null
    ? null
    : { nimi: loydetty.nimi, akatemia: loydetty.akatemia };
}

/** Seuran sivun koko sisalto. null = tuntematon tunniste (404). */
export async function kokoaSeuranSivu(
  db: firestore.Firestore,
  season: number,
  tunniste: string,
): Promise<SeuranSivu | null> {
  const { kausittainSarjoittain, kaudet } = await lueKaikkiSarjat(db);

  const seura = etsiSeura(tunniste, kausittainSarjoittain);
  if (seura === null) return null;

  const aikasarja = laskeSeuranAikasarja(tunniste, kaudet, kausittainSarjoittain);
  if (aikasarja.paallekkaisetKaudet.length > 0) {
    // Ei pitaisi olla mahdollista: sama seura kahdessa sarjassa samalla
    // kaudella. Ei summata vaan kerrotaan lokiin.
    console.error(
      '[seuranSivu] ' + tunniste + ' loytyy kahdesta sarjasta kausilta ' +
        aikasarja.paallekkaisetKaudet.join(', '),
    );
  }

  const piste = aikasarja.pisteet.find((p) => p.kausi === season) ?? null;
  const sarja = piste?.sarja ?? null;
  const seurakausi =
    sarja === null
      ? null
      : (kausittainSarjoittain.get(sarja)?.get(season) || []).find(
          (s) => s.tunniste === tunniste,
        ) ?? null;

  // Pelaajat ja kontekstirivit SAMASTA moottorista kuin pelaajasivulla.
  // Vertailujoukko on koko sarjan ikaryhma, ei seuran oma joukko —
  // muuten "ikaryhman mediaani" tarkoittaisi eri asiaa eri sivuilla.
  let pelaajat: SeuranSivu['pelaajat'] = [];
  if (sarja !== null && seurakausi !== null) {
    const { suoritukset, nimittajat } = await lueKausi(db, season, sarja);
    const pelipaikat = new Map<string, string | null>();
    if (sarja === OLETUSSARJA) {
      const kansSnap = await db
        .collection('seasons')
        .doc(String(season))
        .collection('kansalaisuudet')
        .get();
      for (const doc of kansSnap.docs) {
        const arvo = doc.data()?.pelipaikka;
        pelipaikat.set(doc.id, typeof arvo === 'string' && arvo ? arvo : null);
      }
    }
    pelaajat = laskeKaudenKontekstit({
      kausi: season,
      sarja,
      suoritukset,
      nimittajat,
      pelipaikat,
    })
      .filter((k) => k.joukkue === seurakausi.nimi)
      .sort((a, b) => b.faktat.minuutit - a.faktat.minuutit)
      .map((k) => {
        const { ohitetut: _ohitetut, ...rest } = k;
        return {
          ...rest,
          siirto: haeSiirto(season, k.etunimi, k.sukunimi, [
            ...k.seurat,
            k.joukkue,
          ]),
        };
      });
  }

  const sarjatMukana = Array.from(
    new Set(
      aikasarja.pisteet
        .map((p) => p.sarja)
        .filter((x): x is string => x !== null),
    ),
  );

  return {
    tunniste,
    nimi: seura.nimi,
    akatemia: seura.akatemia,
    kausi: season,
    sarja,
    seurakausi,
    pelaajat,
    aikasarja: {
      kaudet: aikasarja.kaudet,
      pisteet: aikasarja.pisteet,
      liukuva: aikasarja.liukuva,
      useitaSarjoja: aikasarja.useitaSarjoja,
    },
    sarjatMukana,
    ylaraja: laskeSeuranYlaraja(new Set(sarjatMukana), kausittainSarjoittain),
    liukuvaIkkuna: LIUKUVA_IKKUNA,
  };
}
