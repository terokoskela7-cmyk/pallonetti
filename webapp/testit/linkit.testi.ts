// ============================================
// TESTI — sisäiset linkit eivät pudota valintaa
//
// Kaksi eri testiä samasta asiasta:
//
// 1. Sääntö: sailytaValinta lisää sarjan ja kauden polkuun.
// 2. Käyttö: yksikään komponentti ei tuo Linkiä tai NavLinkiä suoraan
//    react-router-domista. Tämä on lähdekoodin skannaus, koska juuri
//    siinä vika oli: sääntö voi olla oikein, mutta yksi ohi mennyt
//    linkki riittää pudottamaan valinnan.
//
//   cd webapp
//   npx esbuild testit/linkit.testi.ts --bundle --platform=node \
//     --format=cjs --outfile=/tmp/linkit.cjs --alias:@=./src && node /tmp/linkit.cjs
// ============================================
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sailytaValinta, SAILYVAT_PARAMETRIT } from '../src/utils/linkit';

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

const params = (s: string) => new URLSearchParams(s);

console.log('SÄÄNTÖ');
vertaa(
  'sarja kulkee mukana',
  sailytaValinta('/nuoret', params('sarja=ykkosliiga')),
  '/nuoret?sarja=ykkosliiga',
);
vertaa(
  'kausi kulkee mukana',
  sailytaValinta('/seurat', params('kausi=2024')),
  '/seurat?kausi=2024',
);
vertaa(
  'molemmat kulkevat',
  sailytaValinta('/pelaaja/otto-ruoppi', params('sarja=ykkosliiga&kausi=2025')),
  '/pelaaja/otto-ruoppi?sarja=ykkosliiga&kausi=2025',
);
vertaa('ei valintaa -> polku ennallaan', sailytaValinta('/about', params('')), '/about');
vertaa(
  'tyhjä arvo ei tartu',
  sailytaValinta('/about', params('sarja=')),
  '/about',
);
vertaa(
  'kohteen oma parametri voittaa',
  sailytaValinta('/seurat?kausi=2020', params('kausi=2026&sarja=ykkosliiga')),
  '/seurat?kausi=2020&sarja=ykkosliiga',
);
vertaa(
  'ulkoista osoitetta ei kosketa',
  sailytaValinta('https://example.com/x', params('sarja=ykkosliiga')),
  'https://example.com/x',
);
vertaa(
  'ankkuria ei kosketa',
  sailytaValinta('#kohta', params('sarja=ykkosliiga')),
  '#kohta',
);
vertaa('säilyvät parametrit', [...SAILYVAT_PARAMETRIT], ['sarja', 'kausi']);

console.log('');
console.log('KÄYTTÖ — yksikään linkki ei ohita sääntöä');
{
  // Reititys ja parametrien luku saavat tuoda react-router-domista mitä
  // tahansa: ne eivät ole linkkejä.
  const SALLITUT = [
    'components/SisainenLinkki.tsx',
    'App.tsx',
    'main.tsx',
    'hooks/useKausi.tsx',
  ];

  const tiedostot: string[] = [];
  const kayLapi = (hakemisto: string) => {
    for (const nimi of readdirSync(hakemisto)) {
      const polku = join(hakemisto, nimi);
      if (statSync(polku).isDirectory()) kayLapi(polku);
      else if (/\.tsx?$/.test(nimi)) tiedostot.push(polku);
    }
  };
  kayLapi('src');

  const rikkovat: string[] = [];
  for (const polku of tiedostot) {
    const suhteellinen = polku.replace(/^src\//, '');
    if (SALLITUT.includes(suhteellinen)) continue;
    const sisalto = readFileSync(polku, 'utf-8');
    const tuonti = /import \{([^}]*)\} from 'react-router-dom'/.exec(sisalto);
    if (!tuonti) continue;
    const nimet = tuonti[1].split(',').map((x) => x.trim());
    if (nimet.includes('Link') || nimet.includes('NavLink')) {
      rikkovat.push(suhteellinen);
    }
  }

  vertaa('tiedostoja skannattu', tiedostot.length > 10, true);
  vertaa('suoria Link-tuonteja', rikkovat, []);
}

console.log('');
console.log(virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.');
process.exit(virheita === 0 ? 0 : 1);
