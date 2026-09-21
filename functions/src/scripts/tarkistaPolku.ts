// ============================================
// TARKISTUS — polkumittarin luvut hyvaksyttya taulukkoa vasten
//
// LUKEE VAIN. Ei kirjoita mitaan.
//
// Luvut on hyvaksytty 21.9.2026, ja ne on laskettu kahdella eri tavalla:
// kerran erillisella ajolla ja kerran tuotantokoodilla. Jos nama eroavat,
// jompikumpi on vaarin eika kumpaakaan saa nayttaa.
//
// Ajo:  node lib/scripts/tarkistaPolku.js
// ============================================
import * as admin from 'firebase-admin';
import { laskePolku, type PolkuTulos } from '../services/polku';

/** Hyvaksytyt luvut. Nama ovat testin odotusarvot, eivat laskennan lahde. */
const ODOTETUT: Array<Partial<PolkuTulos> & { kausiN1: number }> = [
  {
    kausiN1: 2025,
    nousseet: 12,
    debytoi: 7,
    seuraNousi: 3,
    vaihtoiSeuraa: 4,
    akatemiastaEmoseuraan: 0,
    akatemiastaMuualle: 2,
    vainKokoonpanossa: 6,
    toiseenSuuntaan: 15,
    mediaaniYlMinuutit: 1245,
    nousseetSeurat: ['FF Jaro', 'KTP'],
  },
  {
    kausiN1: 2026,
    nousseet: 25,
    debytoi: 13,
    seuraNousi: 2,
    vaihtoiSeuraa: 11,
    akatemiastaEmoseuraan: 4,
    akatemiastaMuualle: 4,
    vainKokoonpanossa: 11,
    toiseenSuuntaan: 15,
    mediaaniYlMinuutit: 958,
    nousseetSeurat: ['FC Lahti', 'TPS'],
  },
];

let virheita = 0;

function vertaa(nimi: string, saatu: unknown, odotettu: unknown): void {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) console.log('    ✓ ' + nimi + ' = ' + a);
  else {
    virheita++;
    console.log('    ✗ ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

async function main(): Promise<void> {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'pallonetti-fi',
  });
  const db = admin.firestore();

  console.log('='.repeat(66));
  console.log('POLKUMITTARI — luvut hyvaksyttya taulukkoa vasten');
  console.log('='.repeat(66));

  for (const odotettu of ODOTETUT) {
    const tulos = await laskePolku(db, odotettu.kausiN1);
    console.log('');
    console.log('  siirtyma ' + tulos.kausiN + ' → ' + tulos.kausiN1);
    for (const avain of Object.keys(odotettu) as Array<keyof PolkuTulos>) {
      if (avain === 'kausiN1') continue;
      vertaa(String(avain), tulos[avain], odotettu[avain]);
    }

    // Rakenteen on pidettava riippumatta luvuista: kaksi ylinta
    // summautuvat debytoineisiin, ja akatemiarivit ovat osa
    // "vaihtoi seuraa" -lukua.
    vertaa(
      'seuraNousi + vaihtoiSeuraa = debytoi',
      tulos.seuraNousi + tulos.vaihtoiSeuraa,
      tulos.debytoi,
    );
    vertaa(
      'akatemiarivit mahtuvat vaihtoiSeuraa-lukuun',
      tulos.akatemiastaEmoseuraan + tulos.akatemiastaMuualle <=
        tulos.vaihtoiSeuraa,
      true,
    );
    vertaa('debytoineita enintaan nousseita', tulos.debytoi <= tulos.nousseet, true);
    vertaa('pelaajalistan pituus = nousseet', tulos.pelaajat.length, tulos.nousseet);
    vertaa(
      'jokaisella minuutteja molemmissa',
      tulos.pelaajat.every((p) => p.ylMinuutit > 0 && p.vlMinuutit > 0),
      true,
    );
    vertaa(
      'alle 17-vuotiaita ei ole',
      tulos.pelaajat.filter((p) => p.ika > 0 && p.ika < 17).length,
      0,
    );
  }

  // Siirtyma, jota ei ole: Ykkosliigan data alkaa kaudesta 2024.
  const eiSiirtymaa = await laskePolku(db, 2024);
  console.log('');
  console.log('  siirtyma 2023 → 2024 (ei Ykkosliigan dataa)');
  vertaa('saatavilla', eiSiirtymaa.saatavilla, false);
  vertaa('ei lukuja', eiSiirtymaa.nousseet, 0);

  console.log('');
  console.log(
    virheita === 0
      ? 'Kaikki luvut tasmaavat hyvaksyttyyn taulukkoon.'
      : virheita + ' poikkeamaa — lukuja ei saa nayttaa.',
  );
  process.exit(virheita === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Tarkistus epaonnistui:', err instanceof Error ? err.message : err);
  process.exit(1);
});
