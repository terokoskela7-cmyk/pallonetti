import { Link } from 'react-router-dom';
import { ExternalLink, Mail, Database, Users } from 'lucide-react';
import { useValittuKausi } from '@/hooks/useKausi';

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
  const kausi = useValittuKausi();
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
          CIES Football Observatoryn tutkimus 50 eurooppalaisesta liigasta osoittaa:
          maat joissa nuoret saavat eniten peliaikaa, tuottavat eniten huippupelaajia.
          Tanskan Superliga johtaa Euroopassa alle 21-vuotiaiden peliajalla (11,7 %).
        </p>
        <p>
          Suomessa ei ole ollut julkisesti saatavilla työkalua, jolla seurata
          nuorten pelaajien peliaikaa Veikkausliigassa. pallonetti.fi täyttää
          tämän aukon.
        </p>
      </Section>

      <Section title="Pohjoinen malli — Tanska edelläkävijänä">
        <p>
          Pohjoismaissa Tanska on ottanut selvän johtoroolin nuorten pelaajien
          kehittämisessä. CIES:n data: Tanskan Superliga on maailman kolmanneksi
          paras alle 21-vuotiaiden peliajan suhteen ({' '}
          <span className="tabular">11,7 %</span>).
        </p>
        <p>
          <strong className="text-white/80">FC Nordsjælland</strong> on Euroopan #1
          kehitysseura <span className="tabular">44,7 %</span> alle 21-vuotiaiden minuuteilla.
          Heidän Right to Dream -mallinsa on Pohjoismaiden vastaus Red Bullille:
          kehitä nuoria, anna peliaikaa, myy voitolla. Mohammed Kudus ja Mikkel
          Damsgaard ovat tämän mallin tähtituotteita.
        </p>
        <p>
          <strong className="text-white/80">Norjan Eliteserien</strong> ({' '}
          <span className="tabular">20,2 %</span> alle 21-vuotiaiden minuutit) ja{' '}
          <strong className="text-white/80">Ruotsin Allsvenskan</strong> ({' '}
          <span className="tabular">22,4 %</span>) ovat myös edelläkävijöitä
          nuorten panostuksessa. Molemmat maat ovat tuottaneet merkittävästi
          ulkomaille myytyjä pelaajia.
        </p>
        <p>
          Suomen Veikkausliigassa tilanne on ollut pitkään epäselvä — tarkkaa
          dataa ei ole ollut julkisesti saatavilla. pallonetti.fi muuttaa tämän.
          Seuraamalla 17–21-vuotiaiden peliaikaa teemme kehityksen mitattavaksi ja
          vertailukelpoiseksi.
        </p>
      </Section>

      <Section title="Miten ikähaarukka määritellään?">
        <p>
          <strong className="text-white/80">Nuoret (17–21 v)</strong> = sivuston
          päämittari. Kaudella {kausi} mukana ovat vuosina {kausi - 21}–{kausi - 17}
          syntyneet.
        </p>
        <p>
          <strong className="text-white/80">Alle 21-vuotiaat</strong> = syntynyt{' '}
          <span className="tabular">{kausi - 21}</span> tai myöhemmin.
          {kausi - 20} tai myöhemmin. Tätä lukua käytetään vain
          kansainvälisessä CIES-vertailussa, ja se on päämittaria pienempi.
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
            description="Viralliset tilastot: minuutit, maalit, syötöt, ottelut ja vaiheet. Kausivienti on sivuston päälähde."
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
