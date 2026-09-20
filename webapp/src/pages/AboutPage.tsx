import { Link } from 'react-router-dom';
import { ExternalLink, Mail, Database, Users } from 'lucide-react';
import { useValittuKausi } from '@/hooks/useKausi';
import { useApi } from '@/hooks/useApi';
import { getKansalaisuudet } from '@/services/api';
import { pros } from '@/utils/luvut';
import { ALLE_21_MAX, CIES_TANSKA_PCT, NUORET_MIN, NUORET_MAX } from '@/constants/ika';

// ============================================
// CIES Football Observatory -vertailuluvut.
//
// Nama ovat julkaistuja lukuja, eivat oman ajon tulosta, joten ne ovat
// vakioita ja vuosi sanotaan auki. Suomen luvut haetaan aina ajosta.
// ============================================
/** CIES 2025: alle 21-vuotiaiden osuus peliajasta, karkisarjat. */
const CIES_2025 = [
  { sarja: 'Australian A-League Men', pct: 17.7 },
  { sarja: 'Serbian Super Liga', pct: 15.8 },
  { sarja: 'Tanskan Superliga', pct: CIES_TANSKA_PCT },
];
/** Sama mittari, vertailun toinen paa. */
const CIES_2025_HANNAT = [
  { sarja: 'Englannin Valioliiga', pct: 2.4 },
  { sarja: 'Italian Serie A', pct: 1.9 },
];
/** CIES syyskuu 2026: FC Nordsjaelland, seurataso. */
const NORDSJAELLAND_2026 = 48.1;
const NORDSJAELLAND_5V = 44.7;

/** Kaudet, joiden luvut nimetaan tekstissa. */
const VERTAILUKAUSI = 2025;
const ALKUKAUSI = 2020;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-white/90">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

/**
 * Lahdekortti. `url` on valinnainen: osalla lahteista ei ole yhta osoitetta,
 * vaan lahde on rivikohtainen (siirrot). Silloin nimi nayttaa linkilta
 * nayttamatta olematonta osoitetta.
 */
function SourceItem({
  name,
  url,
  description,
}: {
  name: string;
  url?: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-navy-700/40 border border-navy-600 rounded-lg p-4">
      <Database className="w-4 h-4 text-ice shrink-0 mt-0.5" />
      <div className="min-w-0">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/90 font-medium hover:text-ice transition-colors inline-flex items-center gap-1"
          >
            {name}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-white/90 font-medium">{name}</span>
        )}
        <p className="text-xs text-white/50 mt-1">{description}</p>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const kausi = useValittuKausi();

  // Suomen luvut tulevat ajosta, eivat tekstista. Jos haku ei onnistu,
  // kappale kertoo sen eika nayta vanhaa lukua uutena.
  const { data: suomi } = useApi(
    () =>
      Promise.all([
        getKansalaisuudet(VERTAILUKAUSI),
        getKansalaisuudet(ALKUKAUSI),
      ]).then(([nyt, ennen]) => ({
        // CIES mittaa maajoukkuekelpoisia, joten vertailtava luku on
        // Suomen kansalaisten osuus. Kaikkien alle 21-vuotiaiden osuus
        // naytetaan erikseen omalla nimellaan, ei CIES-vertailussa.
        nytFin: nyt.saatavilla ? nyt.osuusAlle21Suomalaiset : null,
        nytKaikki: nyt.saatavilla ? nyt.osuusAlle21 : null,
        ennenFin: ennen.saatavilla ? ennen.osuusAlle21Suomalaiset : null,
        ennenKaikki: ennen.saatavilla ? ennen.osuusAlle21 : null,
      })),
    [],
  );

  return (
    <div className="px-6 py-10 md:py-16 max-w-3xl mx-auto space-y-10">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-ice font-medium">
          Tietoa palvelusta
        </div>
        <h1 className="text-3xl md:text-4xl font-light tracking-tight">
          pallo<span className="text-aurora">.</span>netti
        </h1>
        <p className="text-base text-white/60 max-w-xl leading-relaxed">
          Suomalaisen jalkapallon nuorten pelaajien peliajan visualisointi.
          Mallina ruotsalainen bolldata.se — pelkkä data selkeästi esitettynä.
        </p>
      </header>

      <Section title="Miksi tämä on olemassa?">
        <p>
          Nuorten peliaika on mitattava asia, ja sitä mitataan muualla. CIES
          Football Observatory seuraa 50 sarjaa ja julkaisee, kuinka suuri osa
          peliajasta menee alle 21-vuotiaille. Suomen Veikkausliigasta vastaavaa
          julkista lukua ei ole ollut. Tämä sivusto laskee sen.
        </p>
        <p>
          <strong className="text-white/80">Mitä muualla mitataan.</strong>{' '}
          CIES:n vuoden 2025 vertailussa mitataan, kuinka suuri osa sarjan
          peliajasta meni alle 21-vuotiaille pelaajille, jotka ovat kelpoisia
          maansa maajoukkueeseen. Kärjessä{' '}
          {CIES_2025.map((x, i) => (
            <span key={x.sarja}>
              {i > 0 ? (i === CIES_2025.length - 1 ? ' ja ' : ', ') : ''}
              {x.sarja} <span className="tabular">{pros(x.pct)}</span>
            </span>
          ))}
          .{' '}
          {' '}Toisessa päässä{' '}
          {CIES_2025_HANNAT.map((x, i) => (
            <span key={x.sarja}>
              {i > 0 ? ' ja ' : ''}
              {x.sarja} <span className="tabular">{pros(x.pct)}</span>
            </span>
          ))}
          .
        </p>
        <p>
          <strong className="text-white/80">Missä Suomi on.</strong>{' '}
          {suomi && suomi.nytFin !== null ? (
            <>
              CIES:n mittari koskee maajoukkuekelpoisia pelaajia, joten
              Veikkausliigasta vertailukelpoinen luku on Suomen kansalaisille
              mennyt peliaika: kaudella {VERTAILUKAUSI} se oli{' '}
              <span className="tabular">{pros(suomi.nytFin)}</span>{' '}
              Veikkausliigan rekisterin mukaan.
              {suomi.ennenFin !== null && (
                <>
                  {' '}
                  Vuonna {ALKUKAUSI} vastaava luku oli{' '}
                  <span className="tabular">{pros(suomi.ennenFin)}</span>.
                </>
              )}
            </>
          ) : (
            <>
              Veikkausliigan luku lasketaan tämän sivuston omasta aineistosta.
              Se ei juuri nyt latautunut, joten sitä ei näytetä tässä — luvut
              näkyvät etusivulla ja Peliaika-sivulla.
            </>
          )}
        </p>
        <p>
          <strong className="text-white/80">Mitä luku ei kerro.</strong>{' '}
          Rekisteri kertoo yhden koodin pelaajaa kohden eikä tunne
          kaksoiskansalaisuutta, joten Suomen kansalaisten osuus on alaraja:
          osa muun maakoodin pelaajista voi olla myös Suomen kansalaisia.
          Rekisteri kertoo lisäksi pelaajan nykyisen merkinnän, ei sitä mikä se
          oli kauden aikana. Maajoukkuekelpoisuus ei myöskään seuraa suoraan
          kansalaisuudesta, joten luku on CIES:n mittarin likiarvo eikä sama
          asia.
        </p>
        {suomi && suomi.nytKaikki !== null && (
          <p>
            <strong className="text-white/80">
              Kaikkien alle 21-vuotiaiden osuus.
            </strong>{' '}
            Kansalaisuudesta riippumatta alle 21-vuotiaat saivat kaudella{' '}
            {VERTAILUKAUSI} <span className="tabular">{pros(suomi.nytKaikki)}</span>{' '}
            peliajasta
            {suomi.ennenKaikki !== null && (
              <>
                {' '}
                ja vuonna {ALKUKAUSI}{' '}
                <span className="tabular">{pros(suomi.ennenKaikki)}</span>
              </>
            )}
            . Tämä on sivuston oma luku, eikä sitä verrata yllä oleviin
            CIES-lukuihin: mittari on eri.
          </p>
        )}
        <p>
          <strong className="text-white/80">
            Seuratason kärki on Tanskassa.
          </strong>{' '}
          FC Nordsjælland on CIES:n syyskuun 2026 tutkimuksessa maailman
          kärjessä:{' '}
          <span className="tabular">{pros(NORDSJAELLAND_2026)}</span> kauden
          2026 peliajasta alle 21-vuotiaille. Viiden vuoden tarkastelussa luku
          on <span className="tabular">{pros(NORDSJAELLAND_5V)}</span>.
        </p>
        <p>
          <strong className="text-white/80">Mitä tämä sivusto mittaa.</strong>{' '}
          Seuraamme Veikkausliigan {NUORET_MIN}–{NUORET_MAX}-vuotiaiden
          peliaikaa: kuka pelaa, kuinka paljon ja missä seurassa. Ikähaarukka on
          laajempi kuin CIES:n, joten kansainvälisissä vertailuissa näytämme
          erikseen alle 21-vuotiaiden osuuden.
        </p>
      </Section>

      <Section title="Miten ikähaarukka määritellään?">
        <p>
          <strong className="text-white/80">
            Nuoret ({NUORET_MIN}–{NUORET_MAX} v)
          </strong>{' '}
          = sivuston päämittari. Kaudella {kausi} mukana ovat vuosina{' '}
          <span className="tabular">{kausi - NUORET_MAX}</span>–
          <span className="tabular">{kausi - NUORET_MIN}</span> syntyneet.
        </p>
        <p>
          <strong className="text-white/80">Alle 21-vuotiaat</strong> = enintään{' '}
          {ALLE_21_MAX}-vuotiaat, eli kaudella {kausi} vuonna{' '}
          <span className="tabular">{kausi - ALLE_21_MAX}</span> tai myöhemmin
          syntyneet. Tätä lukua käytetään vain kansainvälisessä CIES-vertailussa,
          ja se on päämittaria pienempi. Luvut eivät ole saman asian kaksi
          esitystapaa, vaan eri joukot.
        </p>

        <p>
          Ikä lasketaan syntymävuodesta (ei kalenteri-ikä), jolloin määritelmä
          on yhdenmukainen kansainvälisten jalkapallotilastojen kanssa.
          Pelaajat joilla ei ole luotettavaa ikätietoa jätetään tilastojen ulkopuolelle.
        </p>
      </Section>

      <Section title="Datalähteet">
        <div className="grid grid-cols-1 gap-3">
          <SourceItem
            name="Veikkausliiga.com — viralliset tilastot"
            url="https://www.veikkausliiga.com/"
            description="Minuutit, ottelut, aloitukset ja maalit. Kauden tilastovienti on sivuston päälähde, ja kaikki peliaikaluvut lasketaan siitä."
          />
          <SourceItem
            name="Veikkausliiga.com — pelaajarekisteri"
            url="https://www.veikkausliiga.com/"
            description="Kansalaisuus ja pelipaikka pelaajan omalta profiilisivulta. Rekisteri kertoo yhden koodin pelaajaa kohden."
          />
          <SourceItem
            name="Seurojen ja median tiedotteet"
            description="Kesken kauden tapahtuneet siirrot ja lainat. Lähde on rivikohtainen ja näkyy linkkinä pelaajan omalla sivulla, eikä merkintää tehdä ilman lähdettä."
          />
        </div>
        <p>
          Transfermarktista on aiemmin haettu pelaajakuvia ja pelipaikkoja, ja
          ne näkyvät välimuistista. Uusia hakuja ei tehdä, eikä markkina-arvoja
          näytetä.
        </p>
      </Section>

      <Section title="Metodologia">
        <p>
          Peliaika-% lasketaan jakamalla ikäryhmän peliminuutit liigan tai
          joukkueen koko minuuttikapasiteetilla, eli pelattujen otteluiden
          minuuteilla. Näin osuudet ovat samassa yksikössä ja summautuvat: eri
          nimittäjiä ei sekoiteta keskenään.
        </p>
        <p>
          Kansalaisuus esitetään kolmijakona: Suomen kansalaisuus rekisterissä,
          muu maakoodi, ja ei tietoa. Rekisteri kertoo yhden koodin pelaajaa
          kohden eikä tunne kaksoiskansalaisuutta, joten Suomen kansalaisten
          osuus on alaraja eikä sitä esitetä tarkkana lukuna.
        </p>
        <p>
          Pelaajan sivun luvut tulevat virallisista tilastoista sellaisenaan.
          Lukuja ei yhdistellä useasta lähteestä, jottei pelaajalle synny
          numeroita, joita mikään yksittäinen lähde ei kerro.
        </p>
      </Section>

      <Section title="Tekijä">
        <div className="flex items-start gap-3">
          <Users className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <div>
            <p>
              <strong className="text-white/80">Tero Koskela</strong> —
              Palloliiton HHL-palvelupäällikkö,{' '}
              <a
                href="https://talentmaster.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ice hover:text-white transition-colors"
              >
                TalentMaster
              </a>
              -perustaja.
            </p>
            <p className="mt-2">
              <a
                href="mailto:tero@talentmaster.fi"
                className="text-ice hover:text-white transition-colors inline-flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                tero@talentmaster.fi
              </a>
            </p>
          </div>
        </div>
      </Section>

      <Section title="Rajoitukset">
        <ul className="list-disc list-inside space-y-1">
          <li>Naisten Kansallinen Liiga ei vielä mukana</li>
          <li>Veikkausliiga on ainoa pääsarja (Ykkösliiga ja Ykkönen tulossa)</li>
          <li>Pelaajat ilman ikätietoa eivät näy ikäryhmätilastoissa</li>
          <li>
            Kansalaisuus on yhden rekisterin tieto: kaksoiskansalaisuus ei näy,
            eikä maajoukkuekelpoisuutta voi päätellä siitä
          </li>
          <li>
            Siirtomerkinnät kattavat vain ne pelaajat, joille on löytynyt
            julkinen lähde
          </li>
        </ul>
      </Section>

      <div className="border-t border-navy-700 pt-6 text-xs text-white/40">
        <p>
          © {new Date().getFullYear()} pallonetti.fi ·{' '}
          <Link to="/" className="text-ice hover:text-white transition-colors">
            Etusivu
          </Link>
        </p>
      </div>
    </div>
  );
}
