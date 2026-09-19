// ============================================
// KAUSITUONTI — kirjoitus Firestoreen
//
// Erotettu kausiImport.ts:stä, jotta parsinnan ja laskennan voi ajaa
// ilman Firestorea (dry-run). Tämä moduuli ei laske mitään uudelleen:
// se kirjoittaa sen mitä parsiKausiExcel() on jo laskenut.
//
// Kokoelmat:
//   kaudet/{kausi}
//   suoritukset/{kausi}_{vaihe}_{joukkue}_{pelaajaAvain}
//   nimittajat/{kausi}_{vaihe}_{joukkue}
//   seasons/{kausi}/players/{slug}   ← projektio, ei itsenäinen lähde
//
// Idempotenssi: deterministinen dokumentti-ID + set(), ei add(). Saman
// tiedoston uudelleentuonti päivittää samat dokumentit eikä luo uusia.
//
// Projektin invariantit: päivämäärät Date.UTC(), ei sisäkkäisiä template
// literaaleja (käytetään +-ketjutusta).
// ============================================
import type { firestore } from 'firebase-admin';
import {
  TuontiTulos,
  KausiProjektio,
  Nimittaja,
  SuoritusRivi,
  nimittajaId,
  suoritusId,
} from './kausiImport';

/** Firestoressa on 500 operaation yläraja per batch. */
const BATCH_KOKO = 450;

export interface KirjoitusAsetukset {
  /**
   * Etuliite kokoelmien nimiin, esim. 'testi_' → testi_suoritukset.
   * Tyhjä = tuotantokokoelmat. Tällä ajetaan kirjoitus erilliseen
   * testikokoelmaan ilman että tuotantodataan kosketaan.
   */
  kokoelmaEtuliite?: string;
  /** Erottaa tämän tuontiajon aiemmista — vanhentuneet tunnistetaan tällä. */
  tuontiId: string;
  lahdeTiedosto: string;
  /**
   * Tila A: tilannemerkintä, mihin asti data ulottuu ("kierroksen 22
   * jälkeen"). EI tunniste. Tila B (historiallinen kausituonti) jättää
   * tämän pois — päättyneellä kaudella kaikki ottelut on pelattu.
   */
  kierros?: number | null;
}

export interface VanhentunutDokumentti {
  id: string;
  kausi: string;
  pelaajaAvain: string;
  joukkue: string;
  vaihe: string;
}

export interface KirjoitusYhteenveto {
  kirjoitettu: {
    suoritukset: number;
    nimittajat: number;
    kaudet: number;
    projektiot: number;
  };
  /**
   * Dokumentit joilla on vanha tuonti_id samalta kaudelta: lähdeaineistosta
   * poistuneita pelaajia. Merkitään vanhentuneiksi, EI poisteta — ihminen
   * päättää poistosta.
   */
  vanhentuneet: VanhentunutDokumentti[];
  /**
   * Sama projektiolle. Ilman tätä seasons/{kausi}/players jäisi näyttämään
   * pelaajaa joka on poistunut lähteestä — projektio on johdettu näkymä,
   * joten se ei saa elää lähdettään pidempään.
   */
  vanhentuneetProjektiot: string[];
  batchejaAjettu: number;
}

/** Esikatselun luvut: montako dokumenttia syntyy, päivittyy, vanhentuu. */
export interface MuutosArvio {
  luodaan: number;
  paivitetaan: number;
  vanhentuu: number;
}

function kokoelma(
  db: firestore.Firestore,
  nimi: string,
  asetukset: KirjoitusAsetukset,
): firestore.CollectionReference {
  return db.collection((asetukset.kokoelmaEtuliite || '') + nimi);
}

/**
 * Lukee Firestoresta mitkä tuonnin dokumenteista ovat jo olemassa.
 * Tätä tarvitaan esikatselussa: "luodaan X, päivitetään Y, vanhentuu Z".
 * Ei kirjoita mitään.
 */
export async function arvioiMuutokset(
  db: firestore.Firestore,
  tulos: TuontiTulos,
  asetukset: KirjoitusAsetukset,
): Promise<MuutosArvio> {
  const kaudet = tulos.kaudet.map((k) => k.kausi);
  const olemassa = new Set<string>();
  let vanhentuu = 0;

  for (const kausi of kaudet) {
    const snap = await kokoelma(db, 'suoritukset', asetukset)
      .where('kausi', '==', kausi)
      .get();
    for (const doc of snap.docs) {
      olemassa.add(doc.id);
    }
  }

  const tulevat = new Set(tulos.suoritusIdt);
  for (const id of olemassa) {
    if (!tulevat.has(id)) vanhentuu++;
  }

  let paivitetaan = 0;
  for (const id of tulevat) {
    if (olemassa.has(id)) paivitetaan++;
  }

  return {
    luodaan: tulevat.size - paivitetaan,
    paivitetaan,
    vanhentuu,
  };
}

/**
 * Kirjoittaa tuonnin Firestoreen eräkirjoituksina.
 *
 * Järjestys on tarkoituksellinen: nimittäjät ja suoritukset ensin, kausi-
 * dokumentti vasta kun kauden data on sisällä. Jos ajo katkeaa kesken,
 * kaudet/{kausi} ei väitä olevansa ajan tasalla.
 */
export async function kirjoitaKausituonti(
  db: firestore.Firestore,
  tulos: TuontiTulos,
  asetukset: KirjoitusAsetukset,
): Promise<KirjoitusYhteenveto> {
  if (tulos.virheet.length > 0) {
    throw new Error(
      'Tuonnissa on ' +
        tulos.virheet.length +
        ' virhettä — kirjoitusta ei aloiteta',
    );
  }

  const yhteenveto: KirjoitusYhteenveto = {
    kirjoitettu: { suoritukset: 0, nimittajat: 0, kaudet: 0, projektiot: 0 },
    vanhentuneet: [],
    vanhentuneetProjektiot: [],
    batchejaAjettu: 0,
  };

  // Aikaleima luodaan kerran, jotta koko ajolla on sama tuotu_pvm.
  const nyt = new Date();
  const tuotuPvm = new Date(
    Date.UTC(
      nyt.getUTCFullYear(),
      nyt.getUTCMonth(),
      nyt.getUTCDate(),
      nyt.getUTCHours(),
      nyt.getUTCMinutes(),
      nyt.getUTCSeconds(),
    ),
  );

  // ---------- Nimittäjät ----------
  await kirjoitaErissa(db, tulos.nimittajat, yhteenveto, (batch, n: Nimittaja) => {
    batch.set(kokoelma(db, 'nimittajat', asetukset).doc(nimittajaId(n)), {
      kausi: n.kausi,
      vaihe: n.vaihe,
      joukkue: n.joukkue,
      ottelut: n.ottelut,
      kapasiteetti_min: n.kapasiteetti_min,
      tuonti_id: asetukset.tuontiId,
      tuotu_pvm: tuotuPvm,
    });
  });
  yhteenveto.kirjoitettu.nimittajat = tulos.nimittajat.length;

  // ---------- Suoritukset ----------
  await kirjoitaErissa(db, tulos.suoritukset, yhteenveto, (batch, s: SuoritusRivi) => {
    batch.set(kokoelma(db, 'suoritukset', asetukset).doc(suoritusId(s)), {
      kausi: s.kausi,
      vaihe: s.vaihe,
      joukkue: s.joukkue,
      sarja: s.sarja,
      pelaajaAvain: s.pelaajaAvain,
      slug: s.slug,
      etunimi: s.etunimi,
      sukunimi: s.sukunimi,
      ika: s.ika,
      minuutit: s.minuutit,
      minuutit_pros: s.minuutit_pros,
      aloitukset: s.aloitukset,
      ottelut: s.ottelut,
      kokoonpanossa: s.kokoonpanossa,
      maalit: s.maalit,
      joukkueen_ottelut: s.joukkueen_ottelut,
      tuonti_id: asetukset.tuontiId,
      tuotu_pvm: tuotuPvm,
      vanhentunut: false,
    });
  });
  yhteenveto.kirjoitettu.suoritukset = tulos.suoritukset.length;

  // ---------- Projektio seasons/{kausi}/players/{slug} ----------
  // Johdetaan aina samasta ajosta kuin suoritukset — ei koskaan kirjoiteta
  // erikseen, jotta se ei voi eriytyä lähteestä.
  await kirjoitaErissa(db, tulos.projektiot, yhteenveto, (batch, p: KausiProjektio) => {
    const ref = db
      .collection((asetukset.kokoelmaEtuliite || '') + 'seasons')
      .doc(p.kausi)
      .collection('players')
      .doc(p.slug);
    batch.set(ref, {
      etunimi: p.etunimi,
      sukunimi: p.sukunimi,
      ika: p.ika,
      joukkue: p.joukkue,
      joukkueet: p.joukkueet,
      pelaajaAvain: p.pelaajaAvain,
      minTotal: p.minTotal,
      ottelutTotal: p.ottelutTotal,
      aloituksetTotal: p.aloituksetTotal,
      maaliTotal: p.maaliTotal,
      lastUpdatedRound: asetukset.kierros === undefined || asetukset.kierros === null
        ? 0
        : asetukset.kierros,
      tuonti_id: asetukset.tuontiId,
      updatedAt: tuotuPvm,
      vanhentunut: false,
    });
  });
  yhteenveto.kirjoitettu.projektiot = tulos.projektiot.length;

  // ---------- Vanhentuneiden merkintä ----------
  // Pelaaja joka on poistunut lähdeaineistosta jää muuten Firestoreen
  // elämään. Merkitään, ei poisteta.
  for (const kausi of tulos.kaudet.map((k) => k.kausi)) {
    const snap = await kokoelma(db, 'suoritukset', asetukset)
      .where('kausi', '==', kausi)
      .get();
    const vanhat = snap.docs.filter(
      (d) => (d.data() as { tuonti_id?: string }).tuonti_id !== asetukset.tuontiId,
    );
    await kirjoitaErissa(db, vanhat, yhteenveto, (batch, doc) => {
      batch.set(doc.ref, { vanhentunut: true }, { merge: true });
    });
    for (const doc of vanhat) {
      const d = doc.data() as {
        kausi?: string;
        pelaajaAvain?: string;
        joukkue?: string;
        vaihe?: string;
      };
      yhteenveto.vanhentuneet.push({
        id: doc.id,
        kausi: d.kausi || kausi,
        pelaajaAvain: d.pelaajaAvain || '',
        joukkue: d.joukkue || '',
        vaihe: d.vaihe || '',
      });
    }
  }

  // Sama projektiolle: seasons/{kausi}/players -dokumentti jonka tuonti_id
  // on vanha tarkoittaa pelaajaa joka on poistunut lähdeaineistosta.
  for (const kausi of tulos.kaudet.map((k) => k.kausi)) {
    const snap = await db
      .collection((asetukset.kokoelmaEtuliite || '') + 'seasons')
      .doc(kausi)
      .collection('players')
      .get();
    const vanhat = snap.docs.filter(
      (d) => (d.data() as { tuonti_id?: string }).tuonti_id !== asetukset.tuontiId,
    );
    await kirjoitaErissa(db, vanhat, yhteenveto, (batch, doc) => {
      batch.set(doc.ref, { vanhentunut: true }, { merge: true });
    });
    for (const doc of vanhat) {
      yhteenveto.vanhentuneetProjektiot.push(kausi + '/' + doc.id);
    }
  }

  // ---------- Kausidokumentit viimeisenä ----------
  await kirjoitaErissa(db, tulos.kaudet, yhteenveto, (batch, k) => {
    const data: Record<string, unknown> = {
      vuosi: parseInt(k.kausi, 10),
      sarja: paatteleSarja(tulos.suoritukset, k.kausi),
      vaiheet: k.vaiheet,
      tuotu_pvm: tuotuPvm,
      lahde_tiedosto: asetukset.lahdeTiedosto,
      tuonti_id: asetukset.tuontiId,
      osuus_koko_kausi: k.osuus_koko_kausi,
      osuus_runkosarja: k.osuus_runkosarja,
      joukkueet: k.joukkueet,
      pelaajat: k.pelaajat,
    };
    if (asetukset.kierros !== undefined && asetukset.kierros !== null) {
      data.kierros_tilanne = asetukset.kierros;
    }
    batch.set(kokoelma(db, 'kaudet', asetukset).doc(k.kausi), data, {
      merge: true,
    });
  });
  yhteenveto.kirjoitettu.kaudet = tulos.kaudet.length;

  return yhteenveto;
}

function paatteleSarja(suoritukset: SuoritusRivi[], kausi: string): string {
  const rivi = suoritukset.find((s) => s.kausi === kausi && s.sarja);
  return rivi ? rivi.sarja : 'Veikkausliiga';
}

/** Ajaa kirjoitukset enintään BATCH_KOKO operaation erissä. */
async function kirjoitaErissa<T>(
  db: firestore.Firestore,
  rivit: T[],
  yhteenveto: KirjoitusYhteenveto,
  lisaa: (batch: firestore.WriteBatch, rivi: T) => void,
): Promise<void> {
  for (let i = 0; i < rivit.length; i += BATCH_KOKO) {
    const batch = db.batch();
    for (const rivi of rivit.slice(i, i + BATCH_KOKO)) {
      lisaa(batch, rivi);
    }
    await batch.commit();
    yhteenveto.batchejaAjettu++;
  }
}
