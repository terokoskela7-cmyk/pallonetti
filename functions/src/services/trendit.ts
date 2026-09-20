// ============================================
// KAUSITRENDIT — yksi piste per kausi
//
// Trendipisteen on oltava SAMA luku kuin kauden omassa nakymassa. Siksi
// laskenta kaytetaan tasta yhdesta paikasta: sama `lueKausi`, sama
// nimittaja (liigan minuuttikapasiteetti) ja sama kolmijako kuin
// /api/kansalaisuudet-reitilla. Jos nama eriytyisivat, sivusto nayttaisi
// kaksi eri totuutta samasta asiasta.
//
// Kolmijako kertoo, kenelle ALLE 21 -minuutit menivat:
//   Suomen kansalaiset = rekisterin koodi FIN ja seura vahvistettu
//   muu maakoodi       = muu koodi ja seura vahvistettu
//   ei tietoa          = seura vahvistamatta, koodi puuttuu, tai
//                        pelaajalla ei ole lainkaan kansalaisuusdokumenttia
//
// Kolme osaa summautuvat ikaryhman kokonaisosuudeksi, koska kaikki ovat
// osuuksia samasta nimittajasta.
// ============================================
import { firestore } from 'firebase-admin';
import { lueKausi, type SuoritusDoc } from './kausiData';
import { ALLE_21_MAX, NUORET_MAX } from './ikarajat';

export interface Kolmijako {
  /** % liigan minuuttikapasiteetista. */
  fin: number;
  muu: number;
  eiTietoa: number;
}

export interface TrendiKausi {
  kausi: number;
  /** Paamittari: 17–21-vuotiaiden osuus kapasiteetista. */
  osuus1721: number | null;
  /** Kansainvalisen vertailun luku: enintaan 20-vuotiaat. */
  osuusAlle21: number | null;
  /** Alle 21 -osuuden kolmijako, tai null jos kansalaisuusdataa ei ole. */
  alle21Jako: Kolmijako | null;
  /** Kesken oleva kausi merkitaan erikseen; lukua ei piiloteta. */
  kesken: boolean;
  /** Seurojen suurin pelattu ottelumaara, kesken olevan kauden merkintaan. */
  otteluitaPelattu: number | null;
  /** Pelaajia, joilla on peliaikaa. */
  pelaajia: number | null;
}

/** Yksi desimaali, kuten muuallakin sivustolla. */
function osuus(osa: number, kapasiteetti: number): number | null {
  if (kapasiteetti <= 0) return null;
  return Math.round((osa / kapasiteetti) * 1000) / 10;
}

function minuutit(
  suoritukset: SuoritusDoc[],
  ikaRaja: number,
  joukko: Set<string> | null,
): number {
  return suoritukset
    .filter((s) => s.ika <= ikaRaja && (joukko === null || joukko.has(s.slug)))
    .reduce((a, s) => a + s.minuutit, 0);
}

export interface KansalaisuusLuokat {
  fin: Set<string>;
  muu: Set<string>;
  /** Tyhja tarkoittaa, ettei kaudelta ole kansalaisuusdataa lainkaan. */
  saatavilla: boolean;
}

/**
 * Luokittelee kauden pelaajat rekisterin koodin ja seuran vahvistuksen
 * mukaan. "Ei tietoa" ei ole oma joukkonsa vaan jaannos: kaikki mita ei
 * voitu varmentaa. Nain yksikaan pelaaja ei voi pudota jaosta pois.
 */
export function luokitteleKansalaisuudet(
  docs: Array<{ id: string; data: () => firestore.DocumentData }>,
): KansalaisuusLuokat {
  const fin = new Set<string>();
  const muu = new Set<string>();
  for (const d of docs) {
    const x = d.data();
    if (x.seura_vahvistettu !== true) continue;
    const koodi = typeof x.vlKansalaisuus === 'string' ? x.vlKansalaisuus : '';
    if (!koodi) continue;
    if (koodi === 'FIN') fin.add(d.id);
    else muu.add(d.id);
  }
  return { fin, muu, saatavilla: docs.length > 0 };
}

/**
 * Suurimman jaannoksen pyoristys yhteen desimaaliin.
 *
 * Varamenetelma: kaytetaan vain, jos FIN ja muu pyoristyvat yhdessa yli
 * kokonaisosuuden, jolloin jaannos menisi negatiiviseksi. Silloin osia on
 * pakko siirtaa, ja suurin jaannos on rehellisin tapa valita mita.
 *
 * Osat kasitellaan kymmenesosina kokonaislukuina, jolloin liukuluvun
 * epatarkkuus ei paase vertailuun.
 */
export function pyoristaOsatSummaan(
  osat: number[],
  summa: number,
): number[] {
  const tavoite = Math.round(summa * 10);
  const kymmenesosat = osat.map((x) => x * 10);
  const alarajat = kymmenesosat.map((x) => Math.floor(x));
  const jaannokset = kymmenesosat.map((x, i) => ({ i, j: x - alarajat[i] }));
  let jaljella = tavoite - alarajat.reduce((a, b) => a + b, 0);

  const jarjestys = jaannokset
    .slice()
    .sort((a, b) => (jaljella > 0 ? b.j - a.j : a.j - b.j));
  const tulos = alarajat.slice();
  let k = 0;
  while (jaljella !== 0 && jarjestys.length > 0) {
    const kohde = jarjestys[k % jarjestys.length].i;
    if (jaljella > 0) {
      tulos[kohde] += 1;
      jaljella -= 1;
    } else if (tulos[kohde] > 0) {
      tulos[kohde] -= 1;
      jaljella += 1;
    }
    k++;
    if (k > jarjestys.length * 2 && jaljella < 0) break;
  }
  return tulos.map((x) => x / 10);
}

/**
 * Kolmijaon pyoristys: FIN ja muu pyoristetaan normaalisti, ja jaannos
 * menee "ei tietoa" -sarakkeeseen.
 *
 * Suomen kansalaisten osuus on sivuston tarkein vertailuluku, eika sita
 * siirreta muiden pyoristyksen takia: kaudella 2025 luku on 7,6 % (tarkka
 * 7,552 %) eika 7,5 %. "Ei tietoa" on jo minuuttitasolla jaannos, joten
 * pyoristyksen jaannos kuuluu juuri sinne.
 *
 * Jos FIN ja muu pyoristyvat yhdessa yli kokonaisosuuden, jaannos jaisi
 * negatiiviseksi. Negatiivista osuutta ei nayteta, joten silloin palataan
 * suurimman jaannoksen menetelmaan ja tapaus lokitetaan.
 */
export function pyoristaKolmijako(
  finTarkka: number,
  muuTarkka: number,
  eiTietoaTarkka: number,
  kokonaisuus: number,
): Kolmijako {
  const pyorista = (x: number): number => Math.round(x * 10) / 10;
  const fin = pyorista(finTarkka);
  const muu = pyorista(muuTarkka);
  const eiTietoa = Math.round((kokonaisuus - fin - muu) * 10) / 10;

  if (eiTietoa < 0) {
    console.warn(
      '[trendit] jaannos negatiivinen (' + eiTietoa + ') — ' +
        'FIN ' + finTarkka.toFixed(3) + ', muu ' + muuTarkka.toFixed(3) +
        ', ei tietoa ' + eiTietoaTarkka.toFixed(3) +
        ', kokonaisuus ' + kokonaisuus +
        '. Kaytetaan suurimman jaannoksen pyoristysta.',
    );
    const [a, b, c] = pyoristaOsatSummaan(
      [finTarkka, muuTarkka, eiTietoaTarkka],
      kokonaisuus,
    );
    return { fin: a, muu: b, eiTietoa: c };
  }
  return { fin, muu, eiTietoa };
}

/**
 * Kolmijako prosentteina kapasiteetista. `eiTietoa` lasketaan jaannoksena
 * kokonaisosuudesta, jolloin osat kattavat myos pelaajat joilla ei ole
 * kansalaisuusdokumenttia lainkaan.
 *
 * Naytettavat osat pyoristetaan niin, etta ne summautuvat
 * kokonaisosuuteen myos ruudulla — ks. pyoristaKolmijako.
 */
export function laskeKolmijako(
  suoritukset: SuoritusDoc[],
  kapasiteetti: number,
  luokat: KansalaisuusLuokat,
  ikaRaja: number,
): Kolmijako | null {
  if (!luokat.saatavilla || kapasiteetti <= 0) return null;
  const yht = minuutit(suoritukset, ikaRaja, null);
  const fin = minuutit(suoritukset, ikaRaja, luokat.fin);
  const muu = minuutit(suoritukset, ikaRaja, luokat.muu);
  const eiTietoa = Math.max(0, yht - fin - muu);

  const pr = (x: number): number => (x / kapasiteetti) * 100;
  return pyoristaKolmijako(
    pr(fin),
    pr(muu),
    pr(eiTietoa),
    osuus(yht, kapasiteetti) ?? 0,
  );
}

/**
 * Onko kausi kesken?
 *
 * Kausidokumentin `valmis`-kentta ratkaisee, jos se on asetettu. Muuten
 * paatellaan kalenterista: Veikkausliigan kausi on kalenterivuosi, joten
 * kuluva vuosi on kesken eika sen luku ole lopullinen. Menneen vuoden
 * luku ei enaa muutu.
 */
export function onKesken(
  kausi: number,
  kausiDoc: firestore.DocumentData | undefined,
  nytVuosi: number,
): boolean {
  if (kausiDoc && typeof kausiDoc.valmis === 'boolean') return !kausiDoc.valmis;
  return kausi >= nytVuosi;
}

/**
 * Seurojen suurin pelattu ottelumaara. Ensisijaisesti kausidokumentista
 * (tuonti laskee sen), mutta vanhoissa dokumenteissa kenttaa ei ole,
 * jolloin sama luku lasketaan nimittajista — samasta lahteesta kuin
 * tuonti sen laskisi.
 */
export function otteluitaPelattu(
  kausiDoc: firestore.DocumentData | undefined,
  nimittajat: Array<{ joukkue: string; ottelut: number }>,
): number | null {
  if (kausiDoc && typeof kausiDoc.ottelut_max === 'number') {
    return kausiDoc.ottelut_max;
  }
  const seuroittain = new Map<string, number>();
  for (const n of nimittajat) {
    seuroittain.set(n.joukkue, (seuroittain.get(n.joukkue) || 0) + n.ottelut);
  }
  if (seuroittain.size === 0) return null;
  return Math.max(...seuroittain.values());
}

/** Yhden kauden trendipiste. */
export async function laskeKaudenTrendi(
  db: firestore.Firestore,
  kausi: number,
  kausiDoc: firestore.DocumentData | undefined,
  nytVuosi: number,
): Promise<TrendiKausi> {
  const [{ suoritukset, nimittajat }, kansSnap] = await Promise.all([
    lueKausi(db, kausi),
    db
      .collection('seasons')
      .doc(String(kausi))
      .collection('kansalaisuudet')
      .get(),
  ]);
  const kapasiteetti = nimittajat.reduce((a, n) => a + n.kapasiteetti_min, 0);
  const luokat = luokitteleKansalaisuudet(kansSnap.docs);

  return {
    kausi,
    osuus1721: osuus(minuutit(suoritukset, NUORET_MAX, null), kapasiteetti),
    osuusAlle21: osuus(minuutit(suoritukset, ALLE_21_MAX, null), kapasiteetti),
    alle21Jako: laskeKolmijako(suoritukset, kapasiteetti, luokat, ALLE_21_MAX),
    kesken: onKesken(kausi, kausiDoc, nytVuosi),
    otteluitaPelattu: otteluitaPelattu(kausiDoc, nimittajat),
    pelaajia:
      suoritukset.length === 0
        ? null
        : new Set(suoritukset.filter((s) => s.minuutit > 0).map((s) => s.slug))
            .size,
  };
}

/**
 * Kaikkien tuotujen kausien trendi, vanhin ensin. Kaudet luetaan
 * kaudet-kokoelmasta, jotta uusi kausi ilmestyy kaavioon tuonnin jalkeen
 * ilman koodimuutosta.
 */
export async function laskeTrendit(
  db: firestore.Firestore,
  nytVuosi: number = new Date().getFullYear(),
): Promise<TrendiKausi[]> {
  const kaudetSnap = await db.collection('kaudet').get();
  const kaudet = kaudetSnap.docs
    .map((d) => ({ kausi: parseInt(d.id, 10), doc: d.data() }))
    .filter((k) => !isNaN(k.kausi))
    .sort((a, b) => a.kausi - b.kausi);

  return Promise.all(
    kaudet.map((k) => laskeKaudenTrendi(db, k.kausi, k.doc, nytVuosi)),
  );
}
