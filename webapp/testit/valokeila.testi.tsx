// ============================================
// TESTI — valokeilan merkinnät
//
// Etusivun lause ja valokeilan kortti kertovat kaksi asiaa, jotka
// muuttavat luvun tulkintaa: onko pelaaja akatemiajoukkueesta ja onko
// hän siirtynyt kesken kauden. Kumpikin merkintä on helppo pudottaa
// vahingossa pois, eikä kääntäjä huomaisi sitä.
//
// Komponentti renderöidään oikeasti (renderToStaticMarkup), ei
// tarkisteta lähdekoodia merkkijonona: vain renderöinti todistaa, että
// merkintä päätyy sivulle.
//
//   cd webapp
//   npx esbuild testit/valokeila.testi.tsx --bundle --platform=node \
//     --format=cjs --outfile=/tmp/valokeila.cjs --alias:@=./src \
//     && node /tmp/valokeila.cjs
// ============================================
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { EtusivunLause, ValokeilaKortit } from '../src/components/Valokeila';
import type { Nosto } from '../src/services/api';

// react-router kutsuu useLayoutEffectia, joka varoittaa palvelimella
// renderöitäessä. Varoitus ei kerro testistä mitään, joten se
// vaimennetaan nimeltä — muut virheilmoitukset menevät läpi.
const alkuperainenVirhe = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].indexOf('useLayoutEffect') >= 0) {
    return;
  }
  alkuperainenVirhe(...args);
};

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

function nosto(muutokset: Partial<Nosto> = {}): Nosto {
  return {
    slug: 'nicklas-kroupkin',
    etunimi: 'NICKLAS',
    sukunimi: 'Kroupkin',
    ika: 17,
    joukkue: 'HJK Klubi 04',
    seurat: ['HJK Klubi 04'],
    akatemia: true,
    siirto: null,
    rivi: {
      id: 'osuus',
      teksti: '86 % HJK Klubi 04:n otteluiden minuuteista',
      nuoli: 'yli',
      mittari: 'osuus joukkueen minuuteista',
      arvo: 86,
      yksikko: '%',
      mediaani: 8,
      hajonta: 7.45,
      vertailujoukko: '17-vuotiaat Ykkösliigassa 2026, 12 peliaikaa saanutta',
    },
    poikkeama: 10.46,
    ...muutokset,
  };
}

function piirra(elementti: React.ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{elementti}</MemoryRouter>);
}

console.log('ETUSIVUN LAUSE');
{
  const akatemia = piirra(
    <EtusivunLause nosto={nosto()} tuotuPvm="2026-09-20T09:00:00.000Z" />,
  );
  vertaa(
    'akatemiamerkintä näkyy lauseessa',
    akatemia.indexOf('akatemiajoukkue') >= 0,
    true,
  );
  // Nimi näyttöasussa, ei lähteen kirjoitusasussa.
  vertaa('nimi näyttöasussa', akatemia.indexOf('Nicklas Kroupkin') >= 0, true);
  vertaa('lähteen kirjoitusasu ei näy', akatemia.indexOf('NICKLAS') >= 0, false);
  vertaa('lause mukana', akatemia.indexOf('86 %') >= 0, true);
  // Tilanne tuontipäivänä, ei otteluiden määränä.
  vertaa('tuontipäivä suomalaisittain', akatemia.indexOf('20.9.2026') >= 0, true);

  const muu = piirra(
    <EtusivunLause
      nosto={nosto({ akatemia: false, joukkue: 'KuPS', seurat: ['KuPS'] })}
      tuotuPvm={null}
    />,
  );
  vertaa(
    'muun seuran pelaajalla ei merkintää',
    muu.indexOf('akatemiajoukkue') >= 0,
    false,
  );
  // Puuttuva tuontipäivä: ei "tilanne null", vaan koko maininta pois.
  vertaa('puuttuva tuontipäivä jää pois', muu.indexOf('tilanne') >= 0, false);

  const siirtynyt = piirra(
    <EtusivunLause
      nosto={nosto({
        akatemia: true,
        siirto: {
          pelaaja: 'Nicklas Kroupkin',
          seura: 'HJK Klubi 04',
          uusi_seura: 'Leicester City',
          maa: 'Englanti',
          tyyppi: 'siirto',
          pvm: null,
          lahde_url: 'https://example.com/lahde',
        },
      })}
      tuotuPvm="2026-09-20T09:00:00.000Z"
    />,
  );
  vertaa(
    'akatemia ja siirto näkyvät yhdessä',
    siirtynyt.indexOf('akatemiajoukkue') >= 0 &&
      siirtynyt.indexOf('Leicester City') >= 0,
    true,
  );

  // Ei nostoa = ei osiota, ei placeholderia.
  vertaa(
    'ilman nostoa ei osiota',
    piirra(<EtusivunLause nosto={null} tuotuPvm={null} />),
    '',
  );
}

console.log('');
console.log('VALOKEILAN KORTIT');
{
  const kortit = piirra(
    <ValokeilaKortit
      nostot={[nosto(), nosto({ slug: 'muu', akatemia: false, joukkue: 'KuPS' })]}
    />,
  );
  // Yksi merkintä, ei kahta: vain akatemiapelaajalle.
  vertaa(
    'merkintä vain akatemiapelaajan kortissa',
    kortit.split('akatemiajoukkue').length - 1,
    1,
  );
  vertaa('tyhjä lista ei renderöi osiota', piirra(<ValokeilaKortit nostot={[]} />), '');
}

console.log('');
console.log(virheita === 0 ? 'Kaikki väitteet pitivät.' : virheita + ' väitettä petti.');
process.exit(virheita === 0 ? 0 : 1);
