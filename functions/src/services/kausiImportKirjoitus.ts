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
  /**
   * Tilannekuvan päivä, muodossa YYYY-MM-DD. Jokainen kumulatiivinen tuonti
   * tallennetaan päivätyksi tilannekuvaksi seasons/{kausi}/tilannekuvat/
   * {pvm}, jotta kehityskäyrä voidaan myöhemmin piirtää tilannekuvien
   * erotuksista päivämääräakselilla.
   *
   * Kierrosnumeroa ei käytetä: runkosarjan jälkeen liiga ei ole synkronissa
   * (seurat ovat pelanneet eri määrän otteluita), joten yksi liigatason
   * kierrosnumero olisi rakenteellisesti väärä.
   *
   * Oletus on ajopäivä. Arvo false ohittaa tilannekuvan kokonaan.
   */
  tilannekuvaPvm?: string | false;
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
  /** Kirjoitetut tilannekuvat: 'seasons/2026/tilannekuvat/2026-09-19'. */
  tilannekuvat: string[];
  /**
   * Tilannekuvat jotka jätettiin kirjoittamatta, koska sisältö oli sama kuin
   * edellisessä. Kaksi identtistä tilannekuvaa eri päivinä antaisi käyrälle
   * nollan pituisen välin ja vihjaisi että pelejä on pelattu, vaikkei ole.
   */
  tilannekuvatOhitettu: string[];
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
 * Tilannekuvan sisältö yhdelle kaudelle. Sama funktio palvelee sekä
 * esikatselua että kirjoitusta, jottei niistä voi tulla eri mieltä.
 */
export function rakennaTilannekuva(
  tulos: TuontiTulos,
  kausi: string,
): {
  seurat: Record<string, number>;
  pelaajat: Array<{
    slug: string;
    pelaajaAvain: string;
    ika: number;
    joukkue: string;
    seurat: Record<string, { min: number; ottelut: number }>;
    minTotal: number;
    ottelutTotal: number;
    aloituksetTotal: number;
    maaliTotal: number;
  }>;
} {
  const otteluita = new Map<string, number>();
  for (const n of tulos.nimittajat) {
    if (n.kausi !== kausi) continue;
    otteluita.set(n.joukkue, (otteluita.get(n.joukkue) || 0) + n.ottelut);
  }

  const perPelaaja = new Map<string, Map<string, { min: number; ottelut: number }>>();
  for (const x of tulos.suoritukset) {
    if (x.kausi !== kausi) continue;
    if (!perPelaaja.has(x.slug)) perPelaaja.set(x.slug, new Map());
    const perSeura = perPelaaja.get(x.slug)!;
    const e = perSeura.get(x.joukkue) || { min: 0, ottelut: 0 };
    e.min += x.minuutit;
    e.ottelut += x.ottelut;
    perSeura.set(x.joukkue, e);
  }

  return {
    seurat: Object.fromEntries(otteluita),
    pelaajat: tulos.projektiot
      .filter((p) => p.kausi === kausi)
      .map((p) => ({
        slug: p.slug,
        pelaajaAvain: p.pelaajaAvain,
        ika: p.ika,
        joukkue: p.joukkue,
        seurat: Object.fromEntries(
          perPelaaja.get(p.slug) ?? new Map<string, { min: number; ottelut: number }>(),
        ),
        minTotal: p.minTotal,
        ottelutTotal: p.ottelutTotal,
        aloituksetTotal: p.aloituksetTotal,
        maaliTotal: p.maaliTotal,
      })),
  };
}

/** Pelaajarivi tilannekuvassa — vertailua ja kirjoitusta varten. */
interface TilannekuvaPelaaja {
  slug: string;
  minTotal: number;
  ottelutTotal: number;
  seurat: Record<string, { min: number; ottelut: number }>;
}

/**
 * Tiivistää tilannekuvan sisällön vertailukelpoiseksi merkkijonoksi.
 * Mukana on vain se mikä kertoo pelitilanteesta: seurojen ottelumäärät ja
 * pelaajien minuutit seuroittain. Tuonti-id, lähdetiedosto ja aikaleima
 * jätetään pois — ne muuttuvat joka ajossa vaikkei data muuttuisi.
 */
function tilannekuvanTiiviste(
  seurat: Record<string, number>,
  pelaajat: TilannekuvaPelaaja[],
): string {
  const seuraOsa = Object.keys(seurat)
    .sort()
    .map((k) => k + ':' + seurat[k])
    .join(',');
  const pelaajaOsa = pelaajat
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((p) => {
      const perSeura = Object.keys(p.seurat)
        .sort()
        .map((s) => s + '=' + p.seurat[s].min + '/' + p.seurat[s].ottelut)
        .join(';');
      return p.slug + ':' + p.minTotal + '/' + p.ottelutTotal + '[' + perSeura + ']';
    })
    .join(',');
  return seuraOsa + '||' + pelaajaOsa;
}

/**
 * Onko uusi tilannekuva sisällöltään sama kuin viimeisin olemassa oleva?
 * Päivämäärä-ID:t järjestyvät leksikograafisesti, joten viimeisin saadaan
 * laskevalla järjestyksellä. Saman päivän tilannekuva ohitetaan vertailusta
 * vain jos sen sisältö on sama — muuten se korvataan.
 */
async function onkoSamaKuinEdellinen(
  tilannekuvat: firestore.CollectionReference,
  pvm: string,
  seurat: Record<string, number>,
  pelaajat: TilannekuvaPelaaja[],
): Promise<boolean> {
  const edelliset = await tilannekuvat.orderBy('pvm', 'desc').limit(1).get();
  if (edelliset.empty) return false;

  const edellinen = edelliset.docs[0];
  const edellisenSeurat = (edellinen.data().seurat ?? {}) as Record<string, number>;
  const pelaajaSnap = await edellinen.ref.collection('pelaajat').get();
  const edellisenPelaajat = pelaajaSnap.docs.map((d) => {
    const x = d.data();
    return {
      slug: (x.slug as string) ?? d.id,
      minTotal: (x.minTotal as number) ?? 0,
      ottelutTotal: (x.ottelutTotal as number) ?? 0,
      seurat: (x.seurat ?? {}) as Record<string, { min: number; ottelut: number }>,
    };
  });

  // Jos edellinen on eri päivältä mutta sama sisältö, uutta ei kirjoiteta.
  // Jos edellinen on tältä päivältä ja sisältö eroaa, se korvataan.
  const sama =
    tilannekuvanTiiviste(edellisenSeurat, edellisenPelaajat) ===
    tilannekuvanTiiviste(seurat, pelaajat);
  if (sama && edellinen.id !== pvm) return true;
  return sama;
}

/** Esikatselun tulos — kaikki mita admin-sivu nayttaa ennen vahvistusta. */
export interface Esikatselu {
  rivit: {
    luettu: number;
    kayttokelpoiset: number;
    ohitetut: Array<{ rivi: number; syy: string }>;
  };
  kaudet: Array<{
    kausi: string;
    pelaajat: number;
    rivit: number;
    /** 17–21-vuotiaiden osuus. */
    osuusKokoKausi: number;
    osuusRunkosarja: number;
    /** Alle 21 (ikä ≤ 20) — kansainvälisen vertailun luku. */
    osuusAlle21: number;
    vaiheet: string[];
    seurat: Array<{ joukkue: string; ottelut: number }>;
  }>;
  muutokset: MuutosArvio;
  /** Pelaajat joiden minuutit PIENENIVÄT — näytetään korostetusti. */
  pienentyneet: Array<{ slug: string; ennen: number; jalkeen: number }>;
  /** Pelaajat jotka katosivat lähteestä. */
  kadonneet: Array<{ slug: string; minuutit: number }>;
  tilannekuvat: Array<{ kausi: string; pvm: string; muuttuu: boolean }>;
  varoitukset: string[];
}

/**
 * Laskee kaiken mita esikatselu nayttaa. EI kirjoita mitaan.
 *
 * Kayttaa samaa rakennaTilannekuva-funktiota kuin kirjoitus, joten
 * esikatselu ei voi olla eri mielta kuin tallennus.
 */
export async function esikatseleKausituonti(
  db: firestore.Firestore,
  tulos: TuontiTulos,
  asetukset: KirjoitusAsetukset,
): Promise<Esikatselu> {
  const muutokset = await arvioiMuutokset(db, tulos, asetukset);

  const pvm =
    typeof asetukset.tilannekuvaPvm === 'string'
      ? asetukset.tilannekuvaPvm
      : new Date().toISOString().slice(0, 10);

  const kaudet: Esikatselu['kaudet'] = [];
  const tilannekuvat: Esikatselu['tilannekuvat'] = [];
  const pienentyneet: Esikatselu['pienentyneet'] = [];
  const kadonneet: Esikatselu['kadonneet'] = [];

  for (const k of tulos.kaudet) {
    const { seurat, pelaajat } = rakennaTilannekuva(tulos, k.kausi);

    // Alle 21 -osuus lasketaan samasta lahteesta kuin paamittari.
    const kap = tulos.nimittajat
      .filter((n) => n.kausi === k.kausi)
      .reduce((a, n) => a + n.kapasiteetti_min, 0);
    const minAlle21 = tulos.suoritukset
      .filter((x) => x.kausi === k.kausi && x.ika <= 20)
      .reduce((a, x) => a + x.minuutit, 0);

    kaudet.push({
      kausi: k.kausi,
      pelaajat: k.pelaajat,
      rivit: k.rivit,
      osuusKokoKausi: k.osuus_koko_kausi,
      osuusRunkosarja: k.osuus_runkosarja,
      osuusAlle21: kap > 0 ? minAlle21 / kap : 0,
      vaiheet: Array.from(
        new Set(
          tulos.nimittajat.filter((n) => n.kausi === k.kausi).map((n) => n.vaihe),
        ),
      ).sort(),
      seurat: Object.keys(seurat)
        .sort()
        .map((joukkue) => ({ joukkue, ottelut: seurat[joukkue] })),
    });

    // Tilannekuva: syntyyko uusi vai onko sisalto sama kuin edellisessa.
    const tilannekuvaKokoelma = db
      .collection((asetukset.kokoelmaEtuliite || '') + 'seasons')
      .doc(k.kausi)
      .collection('tilannekuvat');
    const sama = await onkoSamaKuinEdellinen(
      tilannekuvaKokoelma,
      pvm,
      seurat,
      pelaajat,
    );
    tilannekuvat.push({ kausi: k.kausi, pvm, muuttuu: !sama });

    // Pienentyneet ja kadonneet: verrataan nykyiseen projektioon.
    // Nama ovat esikatselun tarkein osa - kasvu on odotettua, lasku ei.
    const nykyiset = await db
      .collection((asetukset.kokoelmaEtuliite || '') + 'seasons')
      .doc(k.kausi)
      .collection('players')
      .get();
    const uudet = new Map(pelaajat.map((p) => [p.slug, p.minTotal]));
    for (const doc of nykyiset.docs) {
      if (doc.data().vanhentunut === true) continue;
      const ennen = (doc.data().minTotal as number) ?? 0;
      const jalkeen = uudet.get(doc.id);
      if (jalkeen === undefined) {
        kadonneet.push({ slug: doc.id, minuutit: ennen });
      } else if (jalkeen < ennen) {
        pienentyneet.push({ slug: doc.id, ennen, jalkeen });
      }
    }
  }

  return {
    rivit: {
      luettu: tulos.rivitLuettu,
      kayttokelpoiset: tulos.suoritukset.length,
      ohitetut: tulos.ohitetut,
    },
    kaudet,
    muutokset,
    pienentyneet,
    kadonneet,
    tilannekuvat,
    varoitukset: tulos.varoitukset?.map((v) =>
      typeof v === 'string' ? v : JSON.stringify(v),
    ) ?? [],
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
    tilannekuvat: [],
    tilannekuvatOhitettu: [],
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

  // ---------- Päivätty tilannekuva ----------
  // Kumulatiivinen tuonti on kausitilannekuva, ei kierros. Tallennetaan se
  // päivämäärällä, jolloin peräkkäisten tilannekuvien erotus antaa välillä
  // pelatut minuutit ilman että liigan pitäisi olla synkronissa.
  if (asetukset.tilannekuvaPvm !== false) {
    const pvm =
      asetukset.tilannekuvaPvm ?? tuotuPvm.toISOString().slice(0, 10);

    // Seuran ottelumäärä kauden kaikista vaiheista yhteensä.
    const otteluitaPerKausiJaJoukkue = new Map<string, Map<string, number>>();
    for (const n of tulos.nimittajat) {
      if (!otteluitaPerKausiJaJoukkue.has(n.kausi)) {
        otteluitaPerKausiJaJoukkue.set(n.kausi, new Map());
      }
      const perJoukkue = otteluitaPerKausiJaJoukkue.get(n.kausi)!;
      perJoukkue.set(n.joukkue, (perJoukkue.get(n.joukkue) || 0) + n.ottelut);
    }

    for (const kausi of tulos.kaudet.map((k) => k.kausi)) {
      const { seurat, pelaajat: pelaajaDokumentit } = rakennaTilannekuva(
        tulos,
        kausi,
      );
      const projektiot = pelaajaDokumentit;

      const tilannekuvat = db
        .collection((asetukset.kokoelmaEtuliite || '') + 'seasons')
        .doc(kausi)
        .collection('tilannekuvat');

      // Sama sisältö kahtena eri päivänä antaisi käyrälle välin, jolla ei
      // ole pelattu mitään — se vihjaisi tapahtumasta jota ei tapahtunut.
      const muuttumaton = await onkoSamaKuinEdellinen(
        tilannekuvat,
        pvm,
        seurat,
        pelaajaDokumentit,
      );
      if (muuttumaton) {
        yhteenveto.tilannekuvatOhitettu.push(
          'seasons/' + kausi + '/tilannekuvat/' + pvm,
        );
        continue;
      }

      const tilannekuvaRef = tilannekuvat.doc(pvm);
      await tilannekuvaRef.set({
        pvm,
        kausi,
        pelaajia: projektiot.length,
        seurat,
        tuonti_id: asetukset.tuontiId,
        lahde_tiedosto: asetukset.lahdeTiedosto,
        luotu: tuotuPvm,
      });

      await kirjoitaErissa(
        db,
        pelaajaDokumentit,
        yhteenveto,
        (batch, p: (typeof pelaajaDokumentit)[number]) => {
          batch.set(tilannekuvaRef.collection('pelaajat').doc(p.slug), p);
        },
      );

      yhteenveto.tilannekuvat.push(
        'seasons/' + kausi + '/tilannekuvat/' + pvm,
      );
    }
  }

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
