// ============================================
// TARKISTUS — kontekstimoottori tuotannon dataa vasten
//
// LUKEE VAIN. Ei kirjoita mitaan.
//
// Yksikkotesti todistaa, etta moottori toimii oikein annetulla
// aineistolla. Tama skripti todistaa, etta aineisto on sellaista kuin
// moottori olettaa:
//
//   1. jokaiselle datan seuralle on genetiivi (muuten lause sanoo
//      "joukkueen" siella missa se voisi sanoa seuran nimen)
//   2. yksikaan osuus ei ylita 100 %:a
//   3. jokainen sijoituslause nimeaa vertailujoukon
//   4. yksikaan lause ei tulkitse pelaajan asemaa
//   5. hyvaksymistapaus: kauden 2026 20-vuotiaiden maalikarki
//
// Lisaksi tulostaa otoksen tuotettuja lauseita molemmista sarjoista,
// jotta ne voi lukea ennen julkaisua.
//
// Ajo:  node lib/scripts/tarkistaKonteksti.js [kausi]
// ============================================
import * as admin from 'firebase-admin';
import { lueKausi } from '../services/kausiData';
import {
  laskeKonteksti,
  valitseNostot,
  type Konteksti,
} from '../services/konteksti';
import { genetiivi } from '../services/taivutus';
import { TUETUT_SARJAT, OLETUSSARJA, kausiId } from '../services/kausiImport';
import { haeSiirto } from '../services/siirrot';

/** ISO-paiva suomalaisittain ilman Date-jasennysta: "2026-09-21" -> "21.9.2026". */
function suomalainenPvm(iso: string): string {
  const osat = iso.slice(0, 10).split('-');
  if (osat.length !== 3) return iso;
  return (
    parseInt(osat[2], 10) + '.' + parseInt(osat[1], 10) + '.' + osat[0]
  );
}

/**
 * Sanat ja lopukkeet, jotka arvioivat pelaajaa mittaamisen sijaan.
 * "Kärki" ja "jaettu 2." EIVAT ole arvottavia: ne ovat sijoituksia,
 * jotka voi todistaa vaaraksi yhdella kyselylla.
 */
const TULKITSEVAT = [
  'aloittaa lähes aina',
  'vakiintumassa kokoonpanoon',
  'hakee vielä paikkaansa',
  'pelaa lähes täydet pelit',
  'kovin',
  'paras',
  'parhaa',
  'parempi',
  'huippu',
  'loistav',
  'vakuuttav',
  'lupaav',
];

async function pelipaikatKaudelle(
  db: admin.firestore.Firestore,
  kausi: number,
  sarja: string,
): Promise<Map<string, string | null>> {
  const kartta = new Map<string, string | null>();
  // Pelipaikat on kerätty vain Veikkausliigan rekisterista, ja avain on
  // pelkka slug. Toiselle sarjalle niita ei lueta.
  if (sarja !== OLETUSSARJA) return kartta;
  const snap = await db
    .collection('seasons')
    .doc(String(kausi))
    .collection('kansalaisuudet')
    .get();
  for (const d of snap.docs) {
    const arvo = d.data()?.pelipaikka;
    kartta.set(d.id, typeof arvo === 'string' && arvo ? arvo : null);
  }
  return kartta;
}

async function main(): Promise<void> {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();
  const kausi = parseInt(process.argv[2] || '2026', 10);

  let virheita = 0;
  const moiti = (viesti: string): void => {
    virheita++;
    console.log('  ✗ ' + viesti);
  };

  console.log('='.repeat(78));
  console.log('KONTEKSTIMOOTTORI — kausi ' + kausi + ', luetaan vain');
  console.log('='.repeat(78));

  // --- 1. Genetiivikartta kattaa datan seurat (kaikki kaudet) ----------
  const nimSnap = await db.collection('nimittajat').get();
  const seurat = Array.from(
    new Set(
      nimSnap.docs
        .map((d) => d.data())
        .filter((n) => n.vanhentunut !== true)
        .map((n) => String(n.joukkue)),
    ),
  ).sort();
  console.log('');
  console.log('SEURAT DATASSA (' + seurat.length + ') — genetiivi');
  for (const seura of seurat) {
    const g = genetiivi(seura);
    if (g === null) moiti(seura + ': genetiivi puuttuu taivutuskartasta');
    else console.log('  ✓ ' + seura.padEnd(16) + ' → ' + g);
  }

  // --- 2.–4. Lauseet sarjoittain ---------------------------------------
  for (const sarja of TUETUT_SARJAT) {
    const { suoritukset, nimittajat } = await lueKausi(db, kausi, sarja);
    if (suoritukset.length === 0) {
      console.log('');
      console.log(sarja + ' ' + kausi + ': ei suorituksia — ohitetaan');
      continue;
    }
    const pelipaikat = await pelipaikatKaudelle(db, kausi, sarja);
    const slugit = Array.from(new Set(suoritukset.map((s) => s.slug)));

    const kaikki: Konteksti[] = [];
    for (const slug of slugit) {
      const k = laskeKonteksti({
        kausi,
        sarja,
        slug,
        suoritukset,
        nimittajat,
        pelipaikat,
      });
      if (k) kaikki.push(k);
    }

    console.log('');
    console.log('='.repeat(78));
    console.log(
      sarja + ' ' + kausi + ' — ' + kaikki.length + ' pelaajaa, ' +
        kaikki.reduce((a, k) => a + k.rivit.length, 0) + ' lausetta',
    );
    console.log('='.repeat(78));

    for (const k of kaikki) {
      const o = k.faktat.osuusMinuuteista;
      if (o !== null && (o < 0 || o > 100)) {
        moiti(k.slug + ': osuus ' + o + ' % on rajojen ulkopuolella');
      }
      if (o !== null && !Number.isInteger(o)) {
        moiti(k.slug + ': osuus ' + o + ' ei ole kokonaisluku');
      }
      for (const rivi of k.rivit) {
        if (rivi.vertailujoukko === null) {
          moiti(k.slug + ': rivilta ' + rivi.id + ' puuttuu vertailujoukko');
        }
        if (rivi.id.indexOf('sijoitus') === 0 && k.faktat.ottelut < 3) {
          moiti(k.slug + ': sijoituslause alle kolmella ottelulla');
        }
      }
      // Maalilause syntyy vain maalintekijalle. Nollalla ei sijoituta,
      // joten maalivahti ei saa lausetta olematta maalissa — vaikka han
      // on vertailujoukossa mukana.
      const maalirivi = k.rivit.find((r) => r.id === 'sijoitus-maalit');
      if (maalirivi && k.faktat.maalit < 1) {
        moiti(k.slug + ': maalisijoituslause ilman maalia');
      }
      // Sijoitusrivilla ei ole nuolta: sija ja mediaanivertailu ovat eri
      // vaitteita, ja yhdessa ne harhauttavat.
      for (const rivi of k.rivit) {
        if (rivi.id.indexOf('sijoitus') === 0 && rivi.nuoli !== null) {
          moiti(k.slug + ': sijoitusrivilla ' + rivi.id + ' on nuoli');
        }
      }
      // Lause kertoo, ei tulkitse.
      for (const rivi of k.rivit) {
        for (const kielletty of TULKITSEVAT) {
          if (rivi.teksti.indexOf(kielletty) >= 0) {
            moiti(k.slug + ': tulkitseva lopuke "' + kielletty + '"');
          }
        }
      }
    }

    // Valokeila ja etusivun lause: sama valinta jonka rajapinta palauttaa.
    const nostot = valitseNostot(kaikki, 3).map((n) => ({
      ...n,
      siirto: haeSiirto(kausi, n.etunimi, n.sukunimi, [...n.seurat, n.joukkue]),
    }));
    const kausiDoc = await db
      .collection('kaudet')
      .doc(kausiId({ sarja, kausi: String(kausi) }))
      .get();
    const tuotu = kausiDoc.exists ? kausiDoc.data()?.tuotu_pvm : null;
    const tuotuIso =
      tuotu && typeof tuotu.toDate === 'function'
        ? (tuotu.toDate() as Date).toISOString()
        : typeof tuotu === 'string'
          ? tuotu
          : null;
    console.log('');
    console.log(
      'VALOKEILASSA (' +
        (tuotuIso === null
          ? 'tuontipaivaa ei ole kausidokumentissa'
          : 'tilanne ' + suomalainenPvm(tuotuIso)) +
        ')',
    );
    if (nostot.length === 0) console.log('  (ei vertailukelpoista poikkeamaa)');
    for (const n of nostot) {
      console.log(
        '  ' + (n.etunimi + ' ' + n.sukunimi).trim() + ' (' + n.ika + ' v, ' +
          n.joukkue + ') — ' + n.rivi.teksti,
      );
      console.log(
        '     mittari ' + n.rivi.mittari + ' · arvo ' + n.rivi.arvo + ' ' +
          n.rivi.yksikko + ' · mediaani ' + n.rivi.mediaani + ' · hajonta ' +
          n.rivi.hajonta + ' · poikkeama ' + n.poikkeama + ' × hajonta',
      );
      if (n.siirto) {
        console.log(
          '     siirtomerkinta: ' + n.siirto.uusi_seura + ', ' + n.siirto.maa +
            ' (' + n.siirto.tyyppi + ')',
        );
      }
      // Etusivun lause kokonaisuudessaan, samoin osin kuin kayttoliittymassa.
      console.log(
        '     ETUSIVUN LAUSE: ' + (n.etunimi + ' ' + n.sukunimi).trim() +
          ' (' + n.ika + ' v, ' + n.joukkue + ') — ' + n.rivi.teksti,
      );
      if (nostot.indexOf(n) === 0 && n.siirto) {
        console.log(
          '                     + merkinta "' +
            (n.siirto.tyyppi === 'laina' ? 'Lainalla' : 'Siirtynyt kesken kauden') +
            ': ' + n.siirto.uusi_seura + ', ' + n.siirto.maa + '"',
        );
      }
    }

    // Lauseiden otos: eniten minuutteja pelanneet kymmenen.
    const otos = kaikki
      .slice()
      .sort((a, b) => b.faktat.minuutit - a.faktat.minuutit)
      .slice(0, 10);
    for (const k of otos) {
      console.log('');
      console.log(
        '  ' + (k.etunimi + ' ' + k.sukunimi).trim() + ' · ' + k.joukkue +
          ' · ' + k.ika + ' v' +
          (k.pelipaikka ? ' · ' + k.pelipaikka : ' · pelipaikka ei tiedossa'),
      );
      if (k.rivit.length === 0) console.log('     (ei lauseita)');
      for (const rivi of k.rivit) {
        const nuoli =
          rivi.nuoli === 'yli' ? '↑' : rivi.nuoli === 'alle' ? '↓' :
            rivi.nuoli === 'tasolla' ? '→' : ' ';
        console.log('     ' + nuoli + ' ' + rivi.teksti);
      }
      for (const syy of k.ohitetut) console.log('       · ohitettu: ' + syy);
    }

    // Hyvaksymistapaus: kauden 2026 20-vuotiaiden maalikarki
    // Veikkausliigassa. Nimea ei kovakoodata — luku luetaan datasta ja
    // karki tulostetaan luettavaksi.
    if (sarja === OLETUSSARJA) {
      const kaksikymppiset = kaikki
        .filter((k) => k.ika === 20 && k.faktat.maalit > 0 && k.faktat.sijaMaalit !== null)
        .sort((a, b) => (a.faktat.sijaMaalit ?? 99) - (b.faktat.sijaMaalit ?? 99));
      console.log('');
      console.log('20-VUOTIAIDEN MAALIKÄRKI (' + sarja + ' ' + kausi + ')');
      for (const k of kaksikymppiset.slice(0, 5)) {
        console.log(
          '  ' + k.faktat.sijaMaalit + '. ' +
            (k.etunimi + ' ' + k.sukunimi).trim() + ' (' + k.joukkue + ') — ' +
            k.faktat.maalit + ' maalia' +
            (k.faktat.jaettuMaalit ? ' · jaettu sija' : ''),
        );
      }
      if (kaksikymppiset.length === 0) {
        console.log('  (ei yhtaan 20-vuotiasta maalintekijaa)');
      }
    }
  }

  console.log('');
  console.log('='.repeat(78));
  console.log(
    virheita === 0
      ? 'Kaikki tarkistukset menivat lapi.'
      : virheita + ' tarkistusta petti.',
  );
  process.exit(virheita === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
