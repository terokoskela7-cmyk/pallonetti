import { Link } from 'react-router-dom';
import { ExternalLink, Database, Users } from 'lucide-react';

const SEASON = 2026;

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

function SourceItem({
  name,
  url,
  description,
}: {
  name: string;
  url: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-navy-700/40 border border-navy-600 rounded-lg p-4">
      <Database className="w-4 h-4 text-ice shrink-0 mt-0.5" />
      <div className="min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/90 font-medium hover:text-ice transition-colors inline-flex items-center gap-1"
        >
          {name}
          <ExternalLink className="w-3 h-3" />
        </a>
        <p className="text-xs text-white/50 mt-1">{description}</p>
      </div>
    </div>
  );
}

export default function AboutPage() {
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
          Pohjoismaiset jalkapalloliigat kilpailevat samoista pelaajista,
          scout-huomiosta ja siirtomarkkinoista. Kun Tanska, Norja ja Ruotsi
          investoivat nuoriin pelaajiin ja antavat heille peliaikaa,
          Suomen on pystyttävä samaan — tai jäämme jälkeen.
        </p>
        <p>
          CIES Football Observatoryn data: Ruotsin Allsvenskan antaa
          U21-pelaajille <span className="tabular">22,4 %</span> peliajasta,
          Norjan Eliteserien <span className="tabular">20,2 %</span> ja
          Tanskan Superliga <span className="tabular">11,7 %</span>.
          Suomella ei ole ollut vastaavaa julkista dataa.
          pallonetti.fi muuttaa tämän.
        </p>
      </Section>

      <Section title="Pohjoismainen kilpailu — me vastaan muut">
        <p>
          Suomi ei kilpaile pelkästään Tanskaa vastaan — me kilpailemme
          <strong className="text-white/80"> kaikkia Pohjoismaita vastaan</strong>.
          Kun ruotsalainen scout etsii U21-pelaajaa, hän vertaa Ruotsin Allsvenskania
          (<span className="tabular">22,4 %</span> U21-peliaikaa),
          Norjan Eliteserieniä (<span className="tabular">20,2 %</span>)
          ja Tanskan Superligaa (<span className="tabular">11,7 %</span>).
          Suomen täytyy olla tuossa vertailussa mukana.
        </p>
        <p>
          <strong className="text-white/80">Ruotsi</strong> johtaa pohjoismaista
          U21-peliaikaa Allsvenskanin <span className="tabular">22,4 %</span>:lla.
          Malmö FF, Djurgården ja AIK ovat systemaattisesti tuottaneet huippupelaajia
          myyntiin Eurooppaan. <strong className="text-white/80">Norja</strong> seuraa
          perässä Eliteserienin <span className="tabular">20,2 %</span>:lla,
          Bodø/Glimtin ja Molde FK:n akatemiat ovat tunnettuja kehitysseuroja.
        </p>
        <p>
          <strong className="text-white/80">Tanska</strong> ja erityisesti{' '}
          <strong className="text-white/80">FC Nordsjælland</strong>{' '}
          (<span className="tabular">44,7 %</span> U21-minuuteilla) ovat
          Euroopan #1 kehitysseura. Heidän Right to Dream -mallinsa on
          Pohjoismaiden vastaus Red Bullille: kehitä nuoria, anna peliaikaa,
          myy voitolla. Mohammed Kudus ja Mikkel Damsgaard ovat tämän mallin
          tähtituotteita.
        </p>
        <p>
          Suomen Veikkausliigassa tilanne on ollut pitkään epäselvä — tarkkaa
          dataa ei ole ollut julkisesti saatavilla. pallonetti.fi muuttaa tämän.
          Seuraamalla U21-pelaajien peliaikaa ja vertaamalla sitä suoraan
          Pohjoismaihin teemme kehityksen mitattavaksi ja kilpailukykyiseksi.
        </p>
      </Section>

      <Section title="Miten U21 ja U23 määritellään?">
        <p>
          <strong className="text-white/80">U21</strong> = syntynyt{' '}
          <span className="tabular">{SEASON - 21}</span> tai myöhemmin.
          Esimerkiksi kaudella {SEASON} U21-pelaaja on syntynyt vuonna{' '}
          {SEASON - 21} tai sen jälkeen.
        </p>
        <p>
          <strong className="text-white/80">U23</strong> = syntynyt{' '}
          <span className="tabular">{SEASON - 23}</span> tai myöhemmin.
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
            name="API-Football (RapidAPI)"
            url="https://www.api-football.com/"
            description="Pelaajatiedot, ikä, joukkueet, ottelut, kokoonpanot. Päätietolähde peliaika- ja ikälaskelmiin."
          />
          <SourceItem
            name="Veikkausliiga.com"
            url="https://www.veikkausliiga.com/"
            description="Viralliset tilastot: minuutit, maalit, syötöt. Rikastaa API-Footballin dataa tarkemmilla luvuilla."
          />
          <SourceItem
            name="Transfermarkt"
            url="https://www.transfermarkt.com/"
            description="Markkina-arvot, sopimustiedot, pelipaikat. Näytetään vain kun sukunimi-matchi on luotettava (≤ 5M€)."
          />
        </div>
      </Section>

      <Section title="Metodologia">
        <p>
          Peliaika-% lasketaan jakamalla nuorten pelaajien peliminuutit
          kaikilla peliminuuteilla kyseisessä joukkueessa tai liigassa.
          Joukkueet joilla on alle 1 000 minuuttia dataa suljetaan pois
          (datavaje-suodatus).
        </p>
        <p>
          Yksittäisen pelaajan sivulla näkyvät minuutit/maalit/syötöt
          yhdistelevät API-Footballin ja Veikkausliiga.comin tietoja.
          Viralliset tilastot voittavat ristiriitatilanteissa.
        </p>
      </Section>

      <Section title="Tekijä">
        <div className="flex items-start gap-3">
          <Users className="w-4 h-4 text-ice shrink-0 mt-0.5" />
          <div>
            <p>
              <strong className="text-white/80">TalentMasterID</strong> —
              Pallonetti on{' '}
              <a
                href="https://talentmaster.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ice hover:text-white transition-colors"
              >
                TalentMasterin
              </a>{' '}
              kehittämä työkalu suomalaisen jalkapallon nuorisoanalytiikkaan.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Rajoitukset">
        <ul className="list-disc list-inside space-y-1">
          <li>Naisten Kansallinen Liiga ei vielä mukana</li>
          <li>Veikkausliiga on ainoa pääsarja (Ykkösliiga ja Ykkönen tulossa)</li>
          <li>Transfermarkt-data riippuu sukunimi-matchin luotettavuudesta</li>
          <li>Pelaajat ilman ikätietoa API-Footballissa eivät näy U21/U23-tilastoissa</li>
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
