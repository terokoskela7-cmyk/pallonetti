// ============================================
// TESTI — etusivun otsikkolause
//
// Ennätysväite on julkinen väite. Testi pitää huolen siitä, että se
// tehdään vain kun se pitää, ja vain edeltäviin kausiin verraten.
//
//   cd webapp
//   npx esbuild testit/otsikkolause.testi.ts --bundle --platform=node \
//     --format=cjs --outfile=/tmp/otsikko.cjs --alias:@=./src && node /tmp/otsikko.cjs
// ============================================
import { muodostaOtsikkolause } from '../src/utils/otsikkolause';
import type { TrendiKausi } from '../src/services/api';

let virheita = 0;
function vertaa(nimi: string, saatu: unknown, odotettu: unknown) {
  const a = JSON.stringify(saatu);
  const b = JSON.stringify(odotettu);
  if (a === b) console.log('  OK  ' + nimi + ' = ' + a);
  else {
    virheita++;
    console.log('  EI  ' + nimi + ': odotettu ' + b + ', saatu ' + a);
  }
}

function piste(sarja: string, kausi: number, osuus: number | null, kesken = false): TrendiKausi {
  return {
    sarja, kausi, osuus1721: osuus, osuusAlle21: null, alle21Jako: null,
    kesken, otteluitaPelattu: null, pelaajia: null,
    osuus1721IlmanAkatemioita: null, osuusAlle21IlmanAkatemioita: null,
    akatemiajoukkueet: [],
  };
}

// Veikkausliigan todelliset luvut 2020–2026.
const vl = [18.0, 18.6, 17.7, 17.1, 15.3, 15.9, 20.3].map((o, i) =>
  piste('Veikkausliiga', 2020 + i, o, i === 6),
);
const yl = [piste('Ykkösliiga', 2024, 30.7), piste('Ykkösliiga', 2025, 39.5)];
const kaikki = [...vl, ...yl];

console.log('ENNÄTYS');
{
  const o = muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2026)!;
  vertaa('2026 on korkein', o.jatko, 'enemmän kuin kertaakaan vuodesta 2020');
  vertaa('osuus', o.osuus, 20.3);
  vertaa('edellinen kausi', o.edellinen, { kausi: 2025, osuus: 15.9 });
  vertaa('kesken välittyy', o.kesken, true);

  const m = muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2024)!;
  vertaa('2024 on matalin', m.jatko, 'vähemmän kuin kertaakaan vuodesta 2020');
}

console.log('');
console.log('EI VÄÄRÄÄ ENNÄTYSTÄ');
{
  // 2025 ei ole ennätys kumpaankaan suuntaan.
  vertaa('välikausi', muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2025)!.jatko, null);
  // Myöhempi kausi ei vaikuta: 2021 oli korkein siihen asti, vaikka 2026 on korkeampi.
  vertaa(
    'vain edeltävät kaudet',
    muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2021)!.jatko,
    null, // vain yksi edeltävä kausi → ei väitettä
  );
  vertaa(
    'kaksi edeltävää riittää',
    muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2022)!.jatko,
    'vähemmän kuin kertaakaan vuodesta 2020', // 17,7 < 18,0 ja 18,6
  );
  // Ykkösliigassa vain yksi edeltävä kausi.
  vertaa('liian lyhyt historia', muodostaOtsikkolause(kaikki, 'Ykkösliiga', 2025)!.jatko, null);
  // Sarjat eivät sekoitu: Ykkösliigan 39,5 ei tee Veikkausliigasta matalaa.
  vertaa('sarjat erikseen', muodostaOtsikkolause(kaikki, 'Ykkösliiga', 2025)!.edellinen, { kausi: 2024, osuus: 30.7 });
}

console.log('');
console.log('PUUTTUVA DATA');
{
  vertaa('trendit puuttuu', muodostaOtsikkolause(null, 'Veikkausliiga', 2026), null);
  vertaa('kausi puuttuu', muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2019), null);
  vertaa(
    'null-osuus ohitetaan',
    muodostaOtsikkolause([...vl, piste('Veikkausliiga', 2027, null)], 'Veikkausliiga', 2027),
    null,
  );
  vertaa(
    'ensimmäinen kausi: ei edellistä',
    muodostaOtsikkolause(kaikki, 'Veikkausliiga', 2020)!.edellinen,
    null,
  );
}

console.log('');
console.log(virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.');
process.exit(virheita === 0 ? 0 : 1);
