// ============================================
// TRANSFERMARKT-HAKU KAUDEN PELAAJILLE
//
// Hakee seasons/{kausi}/players -pelaajille Transfermarkt-profiilin
// (kansalaisuus, pelipaikka, markkina-arvo) ja tallentaa sen
// transfermarkt_players-kokoelmaan.
//
// Kaksi pyyntöä per pelaaja: schnellsuche-haku + profiilisivu. Siksi
// pyyntöjen välissä on viive, eikä ajoa saa tehdä ilman --vahvista.
//
// TÄRKEÄÄ — väärä osuma on pahempi kuin puuttuva. Haku palauttaa aina
// ensimmäisen osuman, joka voi olla eri pelaaja samalla sukunimellä.
// Siksi osuma hyväksytään vain jos nimi täsmää: sukunimi tarkalleen ja
// vähintään yksi etunimi. Epävarmat raportoidaan, ei tallenneta.
//
// Käyttö:
//   node lib/scripts/haeTransfermarkt.js --kausi 2026            (kuivaharjoitus, 5 kpl)
//   node lib/scripts/haeTransfermarkt.js --kausi 2026 --raja 5 --vahvista
//   node lib/scripts/haeTransfermarkt.js --kausi 2026 --vahvista
// ============================================
import * as admin from 'firebase-admin';
import {
  searchTransfermarkt,
  scrapePlayerProfile,
  savePlayerProfile,
  saveIndexEntry,
} from '../scrapers/transfermarkt';

function argumentti(nimi: string): string | undefined {
  const i = process.argv.indexOf('--' + nimi);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lippu(nimi: string): boolean {
  return process.argv.indexOf('--' + nimi) >= 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pieni kirjainkoko, ilman diakriittejä — nimivertailua varten. */
function normi(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Osuma {
  hyvaksytty: boolean;
  syy: string;
}

/**
 * Hyväksyy osuman vain jos sukunimi täsmää tarkalleen ja vähintään yksi
 * etunimi löytyy. Tämä on tahallisen tiukka: kansalaisuustieto on
 * käyttökelvoton jos se voi kuulua toiselle pelaajalle.
 */
function arvioiOsuma(meidanNimi: string, tmNimi: string): Osuma {
  const a = normi(meidanNimi).split(' ').filter(Boolean);
  const b = normi(tmNimi).split(' ').filter(Boolean);
  if (a.length === 0 || b.length === 0) {
    return { hyvaksytty: false, syy: 'tyhjä nimi' };
  }
  const meidanSuku = a[a.length - 1];
  const tmSuku = b[b.length - 1];
  if (meidanSuku !== tmSuku) {
    return {
      hyvaksytty: false,
      syy: 'sukunimi eri: "' + meidanSuku + '" vs "' + tmSuku + '"',
    };
  }
  const meidanEtunimet = a.slice(0, -1);
  const tmEtunimet = b.slice(0, -1);
  if (meidanEtunimet.length === 0 || tmEtunimet.length === 0) {
    return { hyvaksytty: false, syy: 'etunimi puuttuu toiselta' };
  }
  const yhteinen = meidanEtunimet.some((e) => tmEtunimet.includes(e));
  if (!yhteinen) {
    return {
      hyvaksytty: false,
      syy:
        'etunimi ei täsmää: "' +
        meidanEtunimet.join(' ') +
        '" vs "' +
        tmEtunimet.join(' ') +
        '"',
    };
  }
  return { hyvaksytty: true, syy: 'nimi täsmää' };
}

async function main(): Promise<void> {
  const kausi = argumentti('kausi') || '2026';
  const vahvista = lippu('vahvista');
  const rajaRaaka = argumentti('raja');
  // Ilman --vahvista ajetaan oletuksena vain 5 pelaajaa, jotta skraperin
  // toimivuuden voi todeta kuormittamatta lähdettä.
  const raja = rajaRaaka ? parseInt(rajaRaaka, 10) : vahvista ? Infinity : 5;
  const viiveMs = parseInt(argumentti('viive') || '2000', 10);

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi' });
  const db = admin.firestore();

  const snap = await db
    .collection('seasons')
    .doc(kausi)
    .collection('players')
    .get();
  const pelaajat = snap.docs
    .filter((d) => d.data().vanhentunut !== true)
    .map((d) => {
      const x = d.data();
      return {
        slug: d.id,
        nimi: ((x.etunimi as string) + ' ' + (x.sukunimi as string)).trim(),
        joukkue: (x.joukkue as string) || '',
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const kohteet = pelaajat.slice(0, raja === Infinity ? undefined : raja);

  console.log('='.repeat(66));
  console.log('TRANSFERMARKT-HAKU — ' + (vahvista ? 'KIRJOITUS' : 'KUIVAHARJOITUS'));
  console.log('Kausi:    ' + kausi);
  console.log('Pelaajia: ' + pelaajat.length + ', haetaan ' + kohteet.length);
  console.log('Viive:    ' + viiveMs + ' ms per pyyntö (2 pyyntöä/pelaaja)');
  console.log('='.repeat(66));
  console.log('');

  let osui = 0;
  let hylatty = 0;
  let eiLoytynyt = 0;
  let virhe = 0;
  const hylatytRivit: string[] = [];
  const kansalaisuudet = new Map<string, number>();

  for (let i = 0; i < kohteet.length; i++) {
    const p = kohteet[i];
    const etuliite = '[' + (i + 1) + '/' + kohteet.length + '] ' + p.nimi;
    try {
      const haku = await searchTransfermarkt(p.nimi);
      await sleep(viiveMs);
      if (!haku) {
        eiLoytynyt++;
        console.log(etuliite + ' — ei hakutulosta');
        continue;
      }

      const profiili = await scrapePlayerProfile(haku.tmId);
      await sleep(viiveMs);

      const arvio = arvioiOsuma(p.nimi, profiili.name);
      if (!arvio.hyvaksytty) {
        hylatty++;
        hylatytRivit.push(p.nimi + ' -> ' + profiili.name + '  (' + arvio.syy + ')');
        console.log(etuliite + ' — HYLÄTTY: ' + arvio.syy);
        continue;
      }

      osui++;
      for (const k of profiili.nationality || []) {
        kansalaisuudet.set(k, (kansalaisuudet.get(k) || 0) + 1);
      }
      console.log(
        etuliite +
          ' -> ' +
          profiili.name +
          ' [' +
          (profiili.nationality || []).join(', ') +
          ']' +
          (profiili.position ? ' · ' + profiili.position : ''),
      );

      if (vahvista) {
        await savePlayerProfile(profiili);
        await saveIndexEntry(parseInt(kausi, 10), p.nimi, {
          tmId: haku.tmId,
          marketValue: haku.marketValue,
        });
      }
    } catch (e) {
      virhe++;
      console.log(
        etuliite + ' — VIRHE: ' + (e instanceof Error ? e.message : String(e)),
      );
      // Virhe voi olla esto tai katkos. Pidetään tauko ennen seuraavaa.
      await sleep(viiveMs * 2);
    }
  }

  console.log('');
  console.log('='.repeat(66));
  console.log('YHTEENVETO');
  console.log('  osumia hyväksytty: ' + osui + ' / ' + kohteet.length);
  console.log('  hylätty nimivertailussa: ' + hylatty);
  console.log('  ei hakutulosta: ' + eiLoytynyt);
  console.log('  virheitä: ' + virhe);
  if (hylatytRivit.length > 0) {
    console.log('');
    console.log('HYLÄTYT (ei tallennettu):');
    for (const r of hylatytRivit) console.log('  · ' + r);
  }
  if (kansalaisuudet.size > 0) {
    console.log('');
    console.log('KANSALAISUUDET (hyväksytyistä osumista):');
    const lista = Array.from(kansalaisuudet.entries()).sort((a, b) => b[1] - a[1]);
    for (const [k, n] of lista) console.log('  ' + k + ': ' + n);
  }
  if (!vahvista) {
    console.log('');
    console.log('Kuivaharjoitus — mitään ei tallennettu. Kirjoitus vaatii --vahvista.');
  }
}

main().catch((err) => {
  console.error('Ajo epäonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
