// ============================================
// KAUSIDATA — lukumalli suoritukset- ja nimittajat-kokoelmille
//
// Korvaa API-Footballin endpointtien /api/youth-stats, /api/players ja
// /api/teams datalähteenä. Kaava on sama kuin tuonnin esikatselussa:
//
//   osuus = Σ nuorten minuutit / Σ (joukkueen ottelut vaiheessa × 90 × 11)
//
// Nimittäjä tulee nimittajat-kokoelmasta, ei pelaajarivien summasta. Siksi
// osuus ei vääristy vaikka joltain seuralta puuttuisi pelaajia: kapasiteetti
// on seuran ominaisuus, ei pelaajien summa.
//
// IKÄHAARUKKA: lähde (Veikkausliigan vienti) on suodatettu 17–21-vuotiaisiin,
// joten U23-lukua EI voi laskea tästä datasta — se ei ole sama kuin U21 eikä
// nolla. U23 palaa käyttöön sellaisenaan jos vienti tehdään haarukalla 17–23;
// tuonti tallentaa iän sellaisenaan eikä oleta haarukkaa. Siksi vastaus
// kertoo aina mitä ikiä data tosiasiassa sisältää.
//
// Projektin invariantit: päivämäärät Date.UTC(), ei sisäkkäisiä template
// literaaleja (käytetään +-ketjutusta).
// ============================================
import type { firestore } from 'firebase-admin';

export interface SuoritusDoc {
  kausi: string;
  vaihe: string;
  joukkue: string;
  pelaajaAvain: string;
  slug: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  minuutit: number;
  aloitukset: number;
  ottelut: number;
  maalit: number;
  vanhentunut?: boolean;
}

export interface NimittajaDoc {
  kausi: string;
  vaihe: string;
  joukkue: string;
  ottelut: number;
  kapasiteetti_min: number;
}

export interface Ikahaarukka {
  min: number;
  max: number;
  /** false = lähteessä ei ole 22–23-vuotiaita, joten U23-lukua ei ole. */
  u23Saatavilla: boolean;
}

export interface JoukkueenOsuus {
  season: number;
  teamId: string;
  teamName: string;
  /** Joukkueen koko minuuttikapasiteetti kaudella = Σ ottelut × 90 × 11. */
  totalMinutes: number;
  minuutitNuoret: number;
  minuutitAlle21: number;
  youthMinutesU19: number;
  youthMinutesU18: number;
  osuusNuoret: number;
  osuusAlle21: number;
  youthPercentageU19: number;
  youthPercentageU18: number;
  pelaajatNuoret: number;
  pelaajatAlle21: number;
  averageAge: number | null;
  ottelut: number;
  vaiheet: string[];
  updatedAt: string;
}

export interface KaudenPelaaja {
  slug: string;
  pelaajaAvain: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  joukkue: string;
  joukkueet: string[];
  minTotal: number;
  ottelutTotal: number;
  aloituksetTotal: number;
  maaliTotal: number;
}

export interface Joukkue {
  teamId: string;
  teamName: string;
  season: number;
  ottelut: number;
  vaiheet: string[];
  pelaajat: number;
}

/** Joukkueen nimestä vakaa tunniste: "IFK Mariehamn" → "ifk-mariehamn". */
export function joukkueTunniste(nimi: string): string {
  return String(nimi)
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Lukee kauden suoritukset ja nimittäjät. Vanhentuneiksi merkityt
 * suoritukset jätetään pois: ne ovat pelaajia jotka ovat poistuneet
 * lähdeaineistosta, eivätkä ne saa näkyä laskennassa.
 */
export async function lueKausi(
  db: firestore.Firestore,
  season: number,
): Promise<{ suoritukset: SuoritusDoc[]; nimittajat: NimittajaDoc[] }> {
  const kausi = String(season);
  const [sSnap, nSnap] = await Promise.all([
    db.collection('suoritukset').where('kausi', '==', kausi).get(),
    db.collection('nimittajat').where('kausi', '==', kausi).get(),
  ]);

  return {
    suoritukset: sSnap.docs
      .map((d) => d.data() as SuoritusDoc)
      .filter((s) => s.vanhentunut !== true),
    nimittajat: nSnap.docs.map((d) => d.data() as NimittajaDoc),
  };
}

export function paatteleIkahaarukka(suoritukset: SuoritusDoc[]): Ikahaarukka {
  const iat = suoritukset.map((s) => s.ika).filter((i) => i > 0);
  if (iat.length === 0) return { min: 0, max: 0, u23Saatavilla: false };
  const min = Math.min.apply(null, iat);
  const max = Math.max.apply(null, iat);
  return { min, max, u23Saatavilla: max >= 23 };
}

function osuus(osa: number, kokonaisuus: number): number {
  if (kokonaisuus <= 0) return 0;
  return Math.round((osa / kokonaisuus) * 1000) / 10;
}

/**
 * Joukkuekohtaiset osuudet. Nimittäjä on joukkueen kapasiteetti kauden
 * kaikissa vaiheissa — sama luku jonka tuonti laski ja tallensi.
 */
export function laskeJoukkueidenOsuudet(
  season: number,
  suoritukset: SuoritusDoc[],
  nimittajat: NimittajaDoc[],
  paivitetty: string,
): JoukkueenOsuus[] {
  const kapasiteetti = new Map<string, number>();
  const ottelut = new Map<string, number>();
  const vaiheet = new Map<string, Set<string>>();

  for (const n of nimittajat) {
    kapasiteetti.set(n.joukkue, (kapasiteetti.get(n.joukkue) || 0) + n.kapasiteetti_min);
    ottelut.set(n.joukkue, (ottelut.get(n.joukkue) || 0) + n.ottelut);
    if (!vaiheet.has(n.joukkue)) vaiheet.set(n.joukkue, new Set());
    vaiheet.get(n.joukkue)!.add(n.vaihe);
  }

  const joukkueet = Array.from(kapasiteetti.keys()).sort();

  return joukkueet.map((joukkue) => {
    const rivit = suoritukset.filter((s) => s.joukkue === joukkue);
    const kap = kapasiteetti.get(joukkue) || 0;

    const minIka = (raja: number): number =>
      rivit.filter((s) => s.ika <= raja).reduce((a, s) => a + s.minuutit, 0);
    const pelaajatIka = (raja: number): number =>
      new Set(rivit.filter((s) => s.ika <= raja).map((s) => s.pelaajaAvain)).size;

    // Keski-ikä painotetaan minuuteilla: pelaaja joka on pelannut 2000
    // minuuttia kertoo joukkueesta enemmän kuin yhden ottelun varamies.
    const minuutitYht = rivit.reduce((a, s) => a + s.minuutit, 0);
    const painotettuIka =
      minuutitYht > 0
        ? Math.round(
            (rivit.reduce((a, s) => a + s.ika * s.minuutit, 0) / minuutitYht) * 10,
          ) / 10
        : null;

    return {
      season,
      teamId: joukkueTunniste(joukkue),
      teamName: joukkue,
      totalMinutes: kap,
      minuutitNuoret: minIka(21),
      minuutitAlle21: minIka(20),
      youthMinutesU19: minIka(19),
      youthMinutesU18: minIka(18),
      osuusNuoret: osuus(minIka(21), kap),
      osuusAlle21: osuus(minIka(20), kap),
      youthPercentageU19: osuus(minIka(19), kap),
      youthPercentageU18: osuus(minIka(18), kap),
      pelaajatNuoret: pelaajatIka(21),
      pelaajatAlle21: pelaajatIka(20),
      averageAge: painotettuIka,
      ottelut: ottelut.get(joukkue) || 0,
      vaiheet: Array.from(vaiheet.get(joukkue) || []).sort(),
      updatedAt: paivitetty,
    };
  });
}

/** Liigatason yhteenveto samasta datasta. */
export function laskeLiigaYhteenveto(
  season: number,
  suoritukset: SuoritusDoc[],
  nimittajat: NimittajaDoc[],
): {
  season: number;
  kapasiteettiMinuutit: number;
  nuortenMinuutit: number;
  nuortenOsuus: number;
  nuortenOsuusRunkosarja: number;
  pelaajia: number;
  joukkueita: number;
  vaiheet: string[];
  ikahaarukka: Ikahaarukka;
} {
  const kap = nimittajat.reduce((a, n) => a + n.kapasiteetti_min, 0);
  const min = suoritukset.reduce((a, s) => a + s.minuutit, 0);
  const rsKap = nimittajat
    .filter((n) => n.vaihe === 'Runkosarja')
    .reduce((a, n) => a + n.kapasiteetti_min, 0);
  const rsMin = suoritukset
    .filter((s) => s.vaihe === 'Runkosarja')
    .reduce((a, s) => a + s.minuutit, 0);

  return {
    season,
    kapasiteettiMinuutit: kap,
    nuortenMinuutit: min,
    nuortenOsuus: osuus(min, kap),
    nuortenOsuusRunkosarja: osuus(rsMin, rsKap),
    pelaajia: new Set(suoritukset.map((s) => s.pelaajaAvain)).size,
    joukkueita: new Set(nimittajat.map((n) => n.joukkue)).size,
    vaiheet: Array.from(new Set(nimittajat.map((n) => n.vaihe))).sort(),
    ikahaarukka: paatteleIkahaarukka(suoritukset),
  };
}

/**
 * Pelaajan kausisumma yli vaiheiden JA seurojen. Sama laskenta kuin
 * tuonnin projektiossa — tämä on lukupolku, projektio on kirjoituspolku.
 */
export function laskeKaudenPelaajat(suoritukset: SuoritusDoc[]): KaudenPelaaja[] {
  const kartta = new Map<string, KaudenPelaaja & { minPerSeura: Map<string, number> }>();

  for (const s of suoritukset) {
    let p = kartta.get(s.slug);
    if (!p) {
      p = {
        slug: s.slug,
        pelaajaAvain: s.pelaajaAvain,
        etunimi: s.etunimi,
        sukunimi: s.sukunimi,
        ika: s.ika,
        joukkue: s.joukkue,
        joukkueet: [],
        minTotal: 0,
        ottelutTotal: 0,
        aloituksetTotal: 0,
        maaliTotal: 0,
        minPerSeura: new Map(),
      };
      kartta.set(s.slug, p);
    }
    p.minTotal += s.minuutit;
    p.ottelutTotal += s.ottelut;
    p.aloituksetTotal += s.aloitukset;
    p.maaliTotal += s.maalit;
    if (!p.ika && s.ika) p.ika = s.ika;
    p.minPerSeura.set(s.joukkue, (p.minPerSeura.get(s.joukkue) || 0) + s.minuutit);
  }

  return Array.from(kartta.values())
    .map((p) => {
      let paras = p.joukkue;
      let parasMin = -1;
      for (const [seura, m] of p.minPerSeura) {
        if (m > parasMin) {
          parasMin = m;
          paras = seura;
        }
      }
      const { minPerSeura, ...rest } = p;
      return { ...rest, joukkue: paras, joukkueet: Array.from(minPerSeura.keys()).sort() };
    })
    .sort((a, b) => b.minTotal - a.minTotal);
}

/**
 * Liigan eniten pelanneet nuoret PlayerStats-yhteensopivassa muodossa.
 * Etusivu odottaa tätä kenttää youth-aggregation-vastauksessa; se on
 * osa endpointin sopimusta eikä sitä saa pudottaa pois.
 */
export function laskeTopPelaajat(
  season: number,
  suoritukset: SuoritusDoc[],
  maara: number,
): Array<{
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  season: number;
  competition: string;
  appearances: number;
  minutesPlayed: number;
  starts: number;
  substitutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  shots: number;
  shotsOnTarget: number;
  age: number;
}> {
  return laskeKaudenPelaajat(suoritukset)
    .slice(0, maara)
    .map((p) => ({
      playerId: p.slug,
      playerName: (p.etunimi + ' ' + p.sukunimi).trim(),
      teamId: joukkueTunniste(p.joukkue),
      teamName: p.joukkue,
      season,
      competition: 'Veikkausliiga',
      appearances: p.ottelutTotal,
      minutesPlayed: p.minTotal,
      starts: p.aloituksetTotal,
      substitutes: Math.max(0, p.ottelutTotal - p.aloituksetTotal),
      goals: p.maaliTotal,
      // Lähde ei sisällä näitä kenttiä — 0 on tässä "ei mitattu", ei nolla
      // suoritus. Syötöt tulevat Veikkausliiga.com-scrapesta erikseen.
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      shots: 0,
      shotsOnTarget: 0,
      age: p.ika,
    }));
}

export function laskeJoukkueet(
  season: number,
  suoritukset: SuoritusDoc[],
  nimittajat: NimittajaDoc[],
): Joukkue[] {
  const ottelut = new Map<string, number>();
  const vaiheet = new Map<string, Set<string>>();
  for (const n of nimittajat) {
    ottelut.set(n.joukkue, (ottelut.get(n.joukkue) || 0) + n.ottelut);
    if (!vaiheet.has(n.joukkue)) vaiheet.set(n.joukkue, new Set());
    vaiheet.get(n.joukkue)!.add(n.vaihe);
  }

  return Array.from(ottelut.keys())
    .sort()
    .map((joukkue) => ({
      teamId: joukkueTunniste(joukkue),
      teamName: joukkue,
      season,
      ottelut: ottelut.get(joukkue) || 0,
      vaiheet: Array.from(vaiheet.get(joukkue) || []).sort(),
      pelaajat: new Set(
        suoritukset.filter((s) => s.joukkue === joukkue).map((s) => s.pelaajaAvain),
      ).size,
    }));
}
