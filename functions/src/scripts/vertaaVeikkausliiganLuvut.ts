// ============================================
// VERTAILU — Veikkausliigan lukujen on pysyttava ennallaan
//
// Ykkosliigan lisaaminen koskee avaimia, hakuja ja nimittajia. Jos jokin
// niista vuotaa sarjojen valilla, Veikkausliigan luku muuttuu — ja juuri
// sita ei saa tapahtua yhdellakaan kaudella.
//
// Tama skripti ottaa kaikista kausista tilannevedoksen ja vertaa sita
// aiempaan. Vertailu on konekielinen eika perustu silmailuun: jokainen
// luku on joko sama tai ero raportoidaan.
//
// LUKEE VAIN. Ei kirjoita Firestoreen missaan tilanteessa.
//
// Kaytto:
//   node lib/scripts/vertaaVeikkausliiganLuvut.js --tallenna ennen.json
//   (muutokset)
//   node lib/scripts/vertaaVeikkausliiganLuvut.js --vertaa ennen.json
// ============================================
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { lueKausi } from '../services/kausiData';
import { laskeTrendit } from '../services/trendit';

/** Yhden kauden vedos. Mukana kaikki, mihin sarjan lisays voi vaikuttaa. */
interface KaudenVedos {
  kausi: number;
  /** Trendipisteen luvut. */
  osuus1721: number | null;
  osuusAlle21: number | null;
  fin: number | null;
  muu: number | null;
  eiTietoa: number | null;
  /** Nimittaja ja sen osat: sarjan vuoto nakyy tassa ensimmaisena. */
  kapasiteettiMin: number;
  nimittajaRiveja: number;
  joukkueita: number;
  /** Suoritukset: rivimaara, pelaajat ja minuuttisumma. */
  suorituksia: number;
  pelaajia: number;
  minuutitYhteensa: number;
  /** Joukkueet nimilta: uusi sarja toisi tahan vieraita nimia. */
  joukkueet: string[];
  /** Vaiheet: Ykkosliigalla on omansa. */
  vaiheet: string[];
}

function argumentti(nimi: string): string | null {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function otaVedos(db: admin.firestore.Firestore): Promise<KaudenVedos[]> {
  const trendit = await laskeTrendit(db);
  const vedokset: KaudenVedos[] = [];

  for (const t of trendit) {
    const { suoritukset, nimittajat } = await lueKausi(db, t.kausi);
    vedokset.push({
      kausi: t.kausi,
      osuus1721: t.osuus1721,
      osuusAlle21: t.osuusAlle21,
      fin: t.alle21Jako ? t.alle21Jako.fin : null,
      muu: t.alle21Jako ? t.alle21Jako.muu : null,
      eiTietoa: t.alle21Jako ? t.alle21Jako.eiTietoa : null,
      kapasiteettiMin: nimittajat.reduce((a, n) => a + n.kapasiteetti_min, 0),
      nimittajaRiveja: nimittajat.length,
      joukkueita: new Set(nimittajat.map((n) => n.joukkue)).size,
      suorituksia: suoritukset.length,
      pelaajia: new Set(suoritukset.map((s) => s.slug)).size,
      minuutitYhteensa: suoritukset.reduce((a, s) => a + s.minuutit, 0),
      joukkueet: Array.from(new Set(nimittajat.map((n) => n.joukkue))).sort(),
      vaiheet: Array.from(new Set(nimittajat.map((n) => n.vaihe))).sort(),
    });
  }
  return vedokset;
}

function tulostaVedos(vedokset: KaudenVedos[]): void {
  console.log(
    'kausi  17–21   alle21  FIN     muu     eiTiet  kapasit.  suorit.  pelaaj.  jkl',
  );
  for (const v of vedokset) {
    const p = (x: number | null): string =>
      x === null ? '  -   ' : (x.toFixed(1) + ' %').padStart(6);
    console.log(
      String(v.kausi).padEnd(7) +
        p(v.osuus1721) + '  ' + p(v.osuusAlle21) + '  ' +
        p(v.fin) + '  ' + p(v.muu) + '  ' + p(v.eiTietoa) + '  ' +
        String(v.kapasiteettiMin).padStart(8) + '  ' +
        String(v.suorituksia).padStart(7) + '  ' +
        String(v.pelaajia).padStart(7) + '  ' +
        String(v.joukkueita).padStart(3),
    );
  }
}

/** Kenttakohtainen vertailu: taulukot vertaillaan sisallon mukaan. */
function vertaaKaudet(a: KaudenVedos, b: KaudenVedos): string[] {
  const erot: string[] = [];
  const avaimet = Object.keys(a) as Array<keyof KaudenVedos>;
  for (const k of avaimet) {
    const va = JSON.stringify(a[k]);
    const vb = JSON.stringify(b[k]);
    if (va !== vb) erot.push('  ' + String(k) + ': ennen ' + va + ' → nyt ' + vb);
  }
  return erot;
}

async function main(): Promise<void> {
  const tallenna = argumentti('tallenna');
  const vertaa = argumentti('vertaa');

  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();
  const nyt = await otaVedos(db);

  console.log('='.repeat(78));
  console.log('VEIKKAUSLIIGAN LUVUT — ' + (vertaa ? 'VERTAILU' : 'VEDOS'));
  console.log('='.repeat(78));
  console.log('');
  tulostaVedos(nyt);

  if (tallenna) {
    fs.writeFileSync(tallenna, JSON.stringify(nyt, null, 2));
    console.log('');
    console.log('Vedos tallennettu: ' + tallenna);
    return;
  }

  if (!vertaa) {
    console.log('');
    console.log('Anna --tallenna <tiedosto> tai --vertaa <tiedosto>.');
    return;
  }

  // Sama (sarja, kausi) kahdesti tarkoittaa, etta vanha kausidokumentti
  // jai elamaan uuden rinnalle. Kaavio piirtaisi kauden kahdesti.
  const parit = nyt.map((v) => v.kausi);
  const kaksoiskappaleet = parit.filter((k, i) => parit.indexOf(k) !== i);
  if (kaksoiskappaleet.length > 0) {
    console.log('');
    console.log(
      '  ✗ sama kausi esiintyy kahdesti: ' +
        Array.from(new Set(kaksoiskappaleet)).join(', '),
    );
  }

  const ennen: KaudenVedos[] = JSON.parse(fs.readFileSync(vertaa, 'utf-8'));
  const ennenKausittain = new Map(ennen.map((v) => [v.kausi, v]));

  console.log('');
  console.log('VERTAILU VEDOKSEEN ' + vertaa);
  let eroja = kaksoiskappaleet.length;

  for (const v of nyt) {
    const e = ennenKausittain.get(v.kausi);
    if (!e) {
      // Uusi kausi ei ole virhe: Veikkausliigan vanhat luvut ovat
      // vertailun kohde, ei kausien maara.
      console.log('  ' + v.kausi + ': UUSI kausi vedoksessa ei ollut');
      continue;
    }
    const erot = vertaaKaudet(e, v);
    if (erot.length === 0) {
      console.log('  ' + v.kausi + ': sama');
    } else {
      eroja += erot.length;
      console.log('  ' + v.kausi + ': ' + erot.length + ' eroa');
      for (const rivi of erot) console.log(rivi);
    }
  }
  for (const e of ennen) {
    if (!nyt.some((v) => v.kausi === e.kausi)) {
      eroja++;
      console.log('  ' + e.kausi + ': KAUSI KADONNUT');
    }
  }

  console.log('');
  console.log(
    eroja === 0
      ? 'Veikkausliigan luvut eivat muuttuneet.'
      : eroja + ' eroa — Veikkausliigan luvut MUUTTUIVAT.',
  );
  process.exit(eroja === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Ajo epaonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
