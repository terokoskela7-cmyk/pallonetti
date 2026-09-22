import { SisainenLinkki } from '@/components/SisainenLinkki';
import { ExternalLink, Database } from 'lucide-react';
import { useValittuKausi, useValittuSarja } from '@/hooks/useKausi';
import { useApi } from '@/hooks/useApi';
import { getKansalaisuudet, getTrendit } from '@/services/api';
import { luku, pros } from '@/utils/luvut';
import { ALLE_21_MAX, CIES_TANSKA_PCT, NUORET_MIN, NUORET_MAX } from '@/constants/ika';
import { AKATEMIAJOUKKUEET } from '@/constants/akatemiat';
import { lahdeMaininta } from '@/constants/lahde';

// ============================================
// CIES Football Observatory -vertailuluvut.
//
// Nama ovat julkaistuja lukuja, eivat oman ajon tulosta, joten ne ovat
// vakioita ja vuosi sanotaan auki. Suomen luvut haetaan aina ajosta.
// ============================================
/**
 * CIES:n julkaisut, joista luvut ovat perasin. Linkit nakyvat sivulla,
 * jotta lukija paasee alkulahteelle.
 */
const CIES_SARJAT_URL =
  'https://football-observatory.com/Best-development-leagues-for-young-domestic-3602';
const CIES_SEURAT_URL = 'https://football-observatory.com/WeeklyPost541';

/**
 * CIES:n seuravertailu (weekly post 541, julkaistu 8.4.2026).
 *
 * Mittari on ERI kuin sivuston omat luvut: osuus seuran sarjaminuuteista
 * VIIDEN VUODEN ajalta 1.1.2021 alkaen, ei yhdelta kaudelta. Siksi naita
 * ei rinnasteta sivuston kausikohtaisiin osuuksiin missaan.
 *
 * Luvut on luettu postauksesta kasin; sen sisalto ei aukea koneellisesti.
 */
const CIES_SEURAT_ALKAEN = '1.1.2021';
const NORDSJAELLAND = { pct: 44.7, pelaajia: 63 };
const CIES_SEURAT_SUOMI = [
  { seura: 'AC Oulu', pct: 16.6, pelaajia: 36 },
  { seura: 'FC Lahti', pct: 15.6, pelaajia: 18 },
];

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
// Kausia ei kovakoodata: vertailukausi on uusin PAATTYNYT kausi ja
// alkukausi vanhin kausi, jolta dataa on. Kesken oleva kausi ei kelpaa
// vertailukohdaksi, koska sen luku muuttuu vielä.

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
  const sarja = useValittuSarja();

  // Kaikki sivun luvut tulevat ajosta, eivat tekstista. Jos haku ei
  // onnistu, kappale kertoo sen eika nayta vanhaa lukua uutena.
  const { data: luvut } = useApi(async () => {
    const trendit = await getTrendit('kaikki');

    const vl = trendit
      .filter((t) => t.sarja === 'Veikkausliiga')
      .sort((a, b) => a.kausi - b.kausi);
    if (vl.length === 0) return null;
    const alkukausi = vl[0].kausi;
    const paattyneet = vl.filter((t) => !t.kesken);
    const vertailukausi = (paattyneet[paattyneet.length - 1] ?? vl[vl.length - 1])
      .kausi;

    // Ykkosliigan akatemialuvut: uusin kausi, jolta dataa on.
    const yl = trendit
      .filter((t) => t.sarja === 'Ykkösliiga')
      .sort((a, b) => a.kausi - b.kausi);
    const ylUusin = yl.length > 0 ? yl[yl.length - 1] : null;

    const [nyt, ennen] = await Promise.all([
      getKansalaisuudet(vertailukausi),
      getKansalaisuudet(alkukausi),
    ]);
    return {
      vertailukausi,
      alkukausi,
      // CIES mittaa maajoukkuekelpoisia, joten vertailtava luku on
      // Suomen kansalaisten osuus. Kaikkien alle 21-vuotiaiden osuus
      // naytetaan erikseen omalla nimellaan, ei CIES-vertailussa.
      nytFin: nyt.saatavilla ? nyt.osuusAlle21Suomalaiset ?? null : null,
      nytKaikki: nyt.saatavilla ? nyt.osuusAlle21 ?? null : null,
      ennenFin: ennen.saatavilla ? ennen.osuusAlle21Suomalaiset ?? null : null,
      ennenKaikki: ennen.saatavilla ? ennen.osuusAlle21 ?? null : null,
      ykkosliiga: ylUusin
        ? {
            kausi: ylUusin.kausi,
            kesken: ylUusin.kesken,
            osuus: ylUusin.osuus1721,
            ilmanAkatemioita: ylUusin.osuus1721IlmanAkatemioita,
          }
        : null,
    };
  }, []);

  const suomi = luvut;

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
          <a
            href={CIES_SARJAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ice hover:text-white transition-colors"
          >
            CIES:n vuoden 2025 vertailussa
          </a>{' '}
          mitataan, kuinka suuri osa sarjan
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
              mennyt peliaika: kaudella {suomi.vertailukausi} se oli{' '}
              <span className="tabular">{pros(suomi.nytFin)}</span>{' '}
              Veikkausliigan rekisterin mukaan.
              {suomi.ennenFin !== null && (
                <>
                  {' '}
                  Vuonna {suomi.alkukausi} vastaava luku oli{' '}
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
          Luvut on laskettu olemassa olevasta datasta, ja niissä voi olla pieniä
          heittoja. Kansalaisuus on rekisterin nykyinen merkintä eikä kauden
          aikainen, eikä rekisteri tunne kaksoiskansalaisuutta. Luku voi siksi
          poiketa todellisesta kumpaankin suuntaan. Maajoukkuekelpoisuus ei
          myöskään seuraa suoraan kansalaisuudesta, joten luku on CIES:n
          mittarin likiarvo eikä sama asia.
        </p>
        {suomi && suomi.nytKaikki !== null && (
          <p>
            <strong className="text-white/80">
              Kaikkien alle 21-vuotiaiden osuus.
            </strong>{' '}
            Kansalaisuudesta riippumatta alle 21-vuotiaat saivat kaudella{' '}
            {suomi.vertailukausi} <span className="tabular">{pros(suomi.nytKaikki)}</span>{' '}
            peliajasta
            {suomi.ennenKaikki !== null && (
              <>
                {' '}
                ja vuonna {suomi.alkukausi}{' '}
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
          <a
            href={CIES_SEURAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ice hover:text-white transition-colors"
          >
            CIES:n seuravertailussa
          </a>{' '}
          FC Nordsjælland on maailman kärjessä:{' '}
          <span className="tabular">{pros(NORDSJAELLAND.pct)}</span> seuran
          sarjaminuuteista viiden vuoden aikana ({CIES_SEURAT_ALKAEN} alkaen) on
          mennyt alle 21-vuotiaille. Seura on myös peluuttanut eniten eri alle
          21-vuotiaita pelaajia,{' '}
          <span className="tabular">{luku(NORDSJAELLAND.pelaajia)}</span>.
          Samassa vertailussa ovat mukana{' '}
          {CIES_SEURAT_SUOMI.map((x, i) => (
            <span key={x.seura}>
              {i > 0 ? ' ja ' : ''}
              {x.seura} (<span className="tabular">{pros(x.pct)}</span>,{' '}
              <span className="tabular">{luku(x.pelaajia)}</span>
              {i === 0 ? ' eri pelaajaa' : ' pelaajaa'})
            </span>
          ))}
          .
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

      <Section title="Kaksi sarjaa">
        <p>
          Sivusto kattaa <strong className="text-white/80">Veikkausliigan</strong>{' '}
          kaudesta 2020 ja <strong className="text-white/80">Ykkösliigan</strong>{' '}
          kaudesta 2024. Sarja valitaan yläpalkista, ja se näkyy osoitteessa
          (<span className="font-mono text-[11px]">?sarja=ykkosliiga</span>),
          joten linkki on jaettavissa.
        </p>
        <p>
          Sarjojen luvut lasketaan erikseen: nimittäjä on sarjan oma
          minuuttikapasiteetti. Sarjoja ei lasketa yhteen, koska yhdistetty
          luku ei vastaisi kumpaakaan sarjaa.
        </p>
        <p>
          <strong className="text-white/80">Akatemiajoukkueet.</strong>{' '}
          Ykkösliigassa pelaa kaksi seuran omaa kasvattajajoukkuetta:
        </p>
        <ul className="list-disc list-inside space-y-1">
          {AKATEMIAJOUKKUEET.map((x) => (
            <li key={x}>
              <strong className="text-white/80">{x}</strong>
            </li>
          ))}
        </ul>
        <p>
          Niiden koko tehtävä on peluuttaa nuoria, joten lähes kaikki niiden
          peliaika menee 17–21-vuotiaille. Kaksi joukkuetta riittää nostamaan
          koko sarjan lukua
          {luvut?.ykkosliiga &&
          luvut.ykkosliiga.osuus !== null &&
          luvut.ykkosliiga.ilmanAkatemioita !== null ? (
            <>
              : kaudella {luvut.ykkosliiga.kausi}
              {luvut.ykkosliiga.kesken ? ' (kesken)' : ''} Ykkösliigan osuus on{' '}
              <span className="tabular">{pros(luvut.ykkosliiga.osuus)}</span>{' '}
              kaikkien joukkueiden kanssa ja{' '}
              <span className="tabular">
                {pros(luvut.ykkosliiga.ilmanAkatemioita)}
              </span>{' '}
              ilman akatemiajoukkueita
            </>
          ) : (
            ''
          )}
          . Kumpikin luku on tosi, mutta ne vastaavat eri kysymykseen — siksi
          molemmat näytetään.
        </p>
        <p>
          Lista on nimetty eikä pääteltävä: joukkuetta ei tulkita akatemiaksi
          sen nimen perusteella, koska nimestä päättely muuttuisi äänettömästi
          jos joukkue vaihtaa nimeä tai uusi seura nimeää itsensä samoin.
        </p>
        <p>
          Kansalaisuuden kolmijako on toistaiseksi haettu vain Veikkausliigan
          pelaajille. Ykkösliigan kohdalla sitä ei näytetä tyhjänä — puuttuva
          tieto ei ole sama asia kuin nolla.
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
            name="Ykkösliiga — kauden tilastovienti"
            description="Sama muoto ja samat kentät kuin Veikkausliigan viennissä: minuutit, ottelut, aloitukset ja maalit kaudesta 2024 alkaen. Luvut lasketaan sarjan omasta minuuttikapasiteetista."
          />
          <SourceItem
            name="Veikkausliiga.com — pelaajarekisteri"
            url="https://www.veikkausliiga.com/"
            description="Kansalaisuus ja pelipaikka pelaajan omalta profiilisivulta. Rekisteri kertoo yhden koodin pelaajaa kohden. Haettu toistaiseksi vain Veikkausliigan pelaajille."
          />
          <SourceItem
            name="Seurojen ja median tiedotteet"
            description="Kesken kauden tapahtuneet siirrot ja lainat. Lähde on rivikohtainen ja näkyy linkkinä pelaajan omalla sivulla, eikä merkintää tehdä ilman lähdettä."
          />
        </div>
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
          muu maakoodi, ja ei tietoa. Luvut on laskettu olemassa olevasta
          datasta, ja niissä voi olla pieniä heittoja. Kansalaisuus on
          rekisterin nykyinen merkintä eikä kauden aikainen, eikä rekisteri
          tunne kaksoiskansalaisuutta. Luku voi siksi poiketa todellisesta
          kumpaankin suuntaan.
        </p>
        <p>
          Suomen kansalaisten ja muun maakoodin osuudet pyöristetään
          tavallisesti, ja pyöristyksen jäännös näkyy ei tietoa -sarakkeessa,
          joten se voi poiketa omasta tarkasta arvostaan kymmenesosalla.
        </p>
        <p>
          Pelaajan sivun luvut tulevat {lahdeMaininta(sarja)} sellaisenaan.
          Lukuja ei yhdistellä useasta lähteestä, jottei pelaajalle synny
          numeroita, joita mikään yksittäinen lähde ei kerro. Sama
          lähdemaininta näkyy jokaisella luvut esittävällä sivulla, ja se
          muodostetaan yhdestä paikasta — sarjan nimi ei siis voi eriytyä
          sivulta toiselle.
        </p>
      </Section>

      <Section title="Rajoitukset">
        <ul className="list-disc list-inside space-y-1">
          <li>
            Veikkausliiga ja Ykkösliiga. Ykkösliigan data alkaa kaudesta 2024,
            eikä siitä ole kansalaisuustietoa.
          </li>
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
          <SisainenLinkki to="/" className="text-ice hover:text-white transition-colors">
            Etusivu
          </SisainenLinkki>
        </p>
      </div>
    </div>
  );
}
