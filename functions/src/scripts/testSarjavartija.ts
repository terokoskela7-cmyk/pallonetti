// ============================================
// REGRESSIOTESTI — sarja tiedostosta, yksi sarja kerrallaan
//
// Sarja on osa jokaista avainta, koska nimittaja (joukkueen ottelut) on
// sarjakohtainen. Tuonti lukee sarjan tiedostosta, eika sita valita
// lomakkeelta. Tuntematon sarja ja kahden sarjan sekatiedosto hylataan:
// kummassakin tapauksessa luvut menisivat sekaisin nayttamatta rikki.
//
// Ajo:  node lib/scripts/testSarjavartija.js
// ============================================
import * as XLSX from 'xlsx';
import {
  parsiKausiExcel,
  VIESTI_TUNTEMATON_SARJA,
  VIESTI_MONTA_SARJAA,
  sarjaAvain,
  suoritusId,
  nimittajaId,
  kausiId,
  projektioId,
} from '../services/kausiImport';

let virheita = 0;

function vertaa(nimi: string, saatu: unknown, odotettu: unknown): void {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) {
    console.log('  ✓ ' + nimi + ' = ' + a);
  } else {
    virheita++;
    console.log('  ✗ ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

const OTSIKOT = [
  'Etunimi',
  'Sukunimi',
  'Kausi',
  'Sarja',
  'Sarjan vaihe',
  'Joukkue',
  'Pelaajan ikä kaudella',
  'Pelatut minuutit (min)',
  'Pelatut ottelut',
  'Ottelut aloituksessa',
  'Ottelut kokoonpanossa',
  'Maalit',
  'Joukkueen ottelut sarjassa',
];

/** Yksi datarivi annetulla sarjalla. */
function rivi(etu: string, suku: string, sarja: string, joukkue: string): unknown[] {
  return [etu, suku, '2026', sarja, 'Runkosarja', joukkue, 20, 900, 10, 10, 10, 1, 27];
}

function tiedosto(rivit: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([OTSIKOT, ...rivit]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

console.log('SARJA TIEDOSTOSTA');
{
  // 1. Pelkkaa Veikkausliigaa: menee lapi.
  const vl = parsiKausiExcel(
    tiedosto([
      rivi('Otto', 'Ruoppi', 'Veikkausliiga', 'KuPS'),
      rivi('Roni', 'Hudd', 'Veikkausliiga', 'KuPS'),
    ]),
  );
  vertaa('Veikkausliiga: ei virheitä', vl.virheet, []);
  vertaa('Veikkausliiga: 2 suoritusta', vl.suoritukset.length, 2);
  vertaa('sarja tallentuu riville', vl.suoritukset[0].sarja, 'Veikkausliiga');

  // 2. Pelkkaa Ykkosliigaa: menee lapi samalla tavalla.
  const yl = parsiKausiExcel(
    tiedosto([
      rivi('Joku', 'Pelaaja', 'Ykkösliiga', 'JäPS'),
      rivi('Toinen', 'Pelaaja', 'Ykkösliiga', 'KTP'),
    ]),
  );
  vertaa('Ykkösliiga: ei virheitä', yl.virheet, []);
  vertaa('Ykkösliiga: 2 suoritusta', yl.suoritukset.length, 2);
  vertaa('sarja tallentuu riville', yl.suoritukset[0].sarja, 'Ykkösliiga');
  // Nimittäjä ja kausikooste ovat sarjakohtaisia.
  vertaa('nimittäjällä sarja', yl.nimittajat[0].sarja, 'Ykkösliiga');
  vertaa('kausikoosteella sarja', yl.kaudet[0].sarja, 'Ykkösliiga');
  vertaa('projektiolla sarja', yl.projektiot[0].sarja, 'Ykkösliiga');

  // 3. Kaksi sarjaa samassa tiedostossa hylataan: vanhentuneiden
  //    merkinta kohdistuu aina yhteen sarjaan ja kauteen.
  const seka = parsiKausiExcel(
    tiedosto([
      rivi('Otto', 'Ruoppi', 'Veikkausliiga', 'KuPS'),
      rivi('Joku', 'Pelaaja', 'Ykkösliiga', 'JäPS'),
    ]),
  );
  vertaa('sekatiedosto hylätään', seka.virheet[0], VIESTI_MONTA_SARJAA);
  vertaa('erittely kertoo sarjat', seka.virheet[1], 'Tiedostossa: Veikkausliiga, Ykkösliiga');

  // 4. Tuntematon sarja hylkaa tiedoston.
  const tuntematon = parsiKausiExcel(
    tiedosto([rivi('A', 'Yksi', 'Kakkonen', 'JäPS')]),
  );
  vertaa('tuntematon sarja hylätään', tuntematon.virheet[0], VIESTI_TUNTEMATON_SARJA);
  vertaa(
    'viesti kertoo tuetut sarjat',
    VIESTI_TUNTEMATON_SARJA,
    'Tiedostossa on sarja, jota ei tueta. Tuetut sarjat: Veikkausliiga, Ykkösliiga.',
  );
  vertaa('tuntematon rivi ei päädy dataan', tuntematon.suoritukset.length, 0);

  // 5. Tyhja Sarja-arvo tarkoittaa Veikkausliigaa: vanhat viennit.
  const tyhja = parsiKausiExcel(tiedosto([rivi('Otto', 'Ruoppi', '', 'KuPS')]));
  vertaa('tyhjä sarja kelpaa', tyhja.virheet, []);
  vertaa('tyhjä sarja -> Veikkausliiga', tyhja.suoritukset[0].sarja, 'Veikkausliiga');

  // 6. Kirjainkoko ei ratkaise: lahde ei ole johdonmukainen.
  const pienella = parsiKausiExcel(
    tiedosto([rivi('Otto', 'Ruoppi', 'veikkausliiga', 'KuPS')]),
  );
  vertaa('pienellä kirjoitettu kelpaa', pienella.virheet, []);
  vertaa('normalisoituu nimeksi', pienella.suoritukset[0].sarja, 'Veikkausliiga');
}

console.log('');
console.log('AVAIMET');
{
  vertaa('sarjaAvain: Veikkausliiga', sarjaAvain('Veikkausliiga'), 'veikkausliiga');
  vertaa('sarjaAvain: skandit', sarjaAvain('Ykkösliiga'), 'ykkosliiga');
  vertaa('sarjaAvain: tyhjä -> oletus', sarjaAvain(''), 'veikkausliiga');

  const vlRivi = { sarja: 'Veikkausliiga', kausi: '2026', vaihe: 'Runkosarja', joukkue: 'KuPS', pelaajaAvain: 'otto ruoppi', slug: 'otto-ruoppi' };
  const ylRivi = { sarja: 'Ykkösliiga', kausi: '2026', vaihe: 'Ykkösliiga', joukkue: 'JäPS', pelaajaAvain: 'otto ruoppi', slug: 'otto-ruoppi' };

  vertaa('suoritusId sisältää sarjan', suoritusId(vlRivi), 'veikkausliiga_2026_Runkosarja_KuPS_otto ruoppi');
  vertaa('nimittäjäId sisältää sarjan', nimittajaId(ylRivi), 'ykkosliiga_2026_Ykkösliiga_JäPS');
  vertaa('kausiId sisältää sarjan', kausiId({ sarja: 'Ykkösliiga', kausi: '2026' }), 'ykkosliiga_2026');
  vertaa('projektioId sisältää sarjan', projektioId(ylRivi), 'ykkosliiga_otto-ruoppi');

  // Sama pelaaja samalla kaudella molemmissa sarjoissa EI saa osua
  // samaan dokumenttiin. Ilman sarjaa nain kavisi.
  vertaa(
    'sama pelaaja eri sarjoissa -> eri avain',
    suoritusId(vlRivi) !== suoritusId(ylRivi),
    true,
  );
  vertaa(
    'sama pelaaja eri sarjoissa -> eri projektio',
    projektioId(vlRivi) !== projektioId(ylRivi),
    true,
  );
  // Oletussarja: ilman sarjaa avain on sama kuin Veikkausliigalla.
  vertaa(
    'puuttuva sarja = Veikkausliiga',
    suoritusId({ kausi: '2026', vaihe: 'Runkosarja', joukkue: 'KuPS', pelaajaAvain: 'otto ruoppi' }),
    suoritusId(vlRivi),
  );
}

console.log('');
console.log(
  virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.',
);
process.exit(virheita === 0 ? 0 : 1);
