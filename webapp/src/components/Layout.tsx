import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { SisainenLinkki, SisainenNavLinkki } from '@/components/SisainenLinkki';
import { Menu, X } from 'lucide-react';
import { useKausi } from '@/hooks/useKausi';
import { sarjanLyhytNimi } from '@/constants/sarjat';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Kauden valitsin. Vaihto kirjoittaa ?kausi=YYYY nykyiseen osoitteeseen,
 * joten sivu ja muut hakuparametrit säilyvät.
 */
function KausiValitsin({ mobiili = false }: { mobiili?: boolean }) {
  const { kausi, kaudet, setKausi, loading } = useKausi();

  if (loading || kaudet.length === 0) {
    return (
      <span
        className={`text-sm text-white/40 tabular ${mobiili ? '' : 'hidden md:inline-flex px-3 py-1.5'}`}
      >
        {loading ? 'Kausi …' : 'ei kausia'}
      </span>
    );
  }

  return (
    <label className={mobiili ? 'block' : 'hidden md:inline-flex items-center'}>
      <span className="sr-only">Valitse kausi</span>
      <select
        value={kausi ?? ''}
        onChange={(e) => setKausi(Number.parseInt(e.target.value, 10))}
        className="bg-transparent text-sm text-white px-3 py-1.5 border border-navy-600 rounded-md hover:border-white/40 focus:border-ice focus:outline-none transition-colors tabular cursor-pointer"
      >
        {kaudet.map((k) => (
          <option key={k.kausi} value={k.kausi} className="bg-navy-800">
            Kausi {k.kausi}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Sarjavalitsin napeilla. Kolmella sarjalla pudotusvalikko piilotti
 * valinnan: napit näyttävät kaikki vaihtoehdot ja valitun yhdellä
 * silmäyksellä. Lista tulee kausidatasta, joten uusi sarja ilmestyy tähän
 * tuonnin jälkeen ilman koodimuutosta. Yhden sarjan tilanteessa
 * valitsinta ei näytetä lainkaan.
 *
 * Semantiikka: painikeryhmä, jossa valittu on aria-pressed. Radioryhmä
 * vaatisi nuolinäppäinnavigoinnin; tavalliset painikkeet toimivat
 * Tabilla ilman lisäkoodia.
 */
function SarjaValitsin({ mobiili = false }: { mobiili?: boolean }) {
  const { sarja, sarjat, setSarja, loading } = useKausi();

  if (loading || sarjat.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Sarja"
      className={
        mobiili
          ? 'flex flex-wrap gap-2 mb-3'
          : 'hidden md:inline-flex rounded-md border border-navy-600 overflow-hidden'
      }
    >
      {sarjat.map((x) => {
        const valittu = x === sarja;
        return (
          <button
            key={x}
            type="button"
            aria-pressed={valittu}
            title={x}
            onClick={() => setSarja(x)}
            className={
              (mobiili
                ? 'px-3 py-2 rounded-full border text-sm '
                : 'px-3 py-1.5 text-sm ') +
              (valittu
                ? 'bg-ice text-navy-900 border-ice font-medium'
                : 'text-white/70 border-navy-600 hover:text-white hover:bg-navy-700/50')
            }
          >
            {mobiili ? x : sarjanLyhytNimi(x)}
          </button>
        );
      })}
    </div>
  );
}

// "Analyysi" (/peliaika) poistuu valikosta, kun sen sisältö on siirretty
// etusivulle ja Seurat-sivulle (sivu-uudistus, vaihe 3–4). Siihen asti se
// pysyy, jotta joukkuekaavio ja kausitrendi eivät katoa.
const navLinks: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Etusivu', end: true },
  { to: '/peliaika', label: 'Analyysi' },
  { to: '/nuoret', label: 'Nuoret' },
  { to: '/seurat', label: 'Seurat' },
  { to: '/pelaajat', label: 'Pelaajat' },
  { to: '/nousijat', label: 'Nousijat' },
  { to: '/about', label: 'Tietoa' },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `px-3 py-2 rounded-md transition-colors ${
    isActive
      ? 'bg-navy-700 text-white'
      : 'text-white/70 hover:text-white hover:bg-navy-700/40'
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `px-4 py-3 rounded-md text-base transition-colors ${
    isActive
      ? 'bg-ice/10 text-ice border-l-2 border-ice'
      : 'text-white/70 hover:bg-navy-700/40 hover:text-white border-l-2 border-transparent'
  }`;

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  // Admin-linkki näkyy vain kun URL sisältää ?admin=true (tallennetaan
  // localStorageen jotta se säilyy navigoinnin yli). Ei näy normaalikäyttäjille.
  const [showAdmin, setShowAdmin] = useState(false);
  useEffect(() => {
    const fromQuery =
      new URLSearchParams(window.location.search).get('admin') === 'true';
    if (fromQuery) localStorage.setItem('pn_admin', 'true');
    setShowAdmin(fromQuery || localStorage.getItem('pn_admin') === 'true');
  }, []);

  const links = showAdmin
    ? [...navLinks, { to: '/admin', label: 'admin' }]
    : navLinks;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-navy-700 relative z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo + tagline */}
          <SisainenLinkki
            to="/"
            onClick={closeMobile}
            className="block hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl font-medium tracking-tight leading-none">
              pallo<span className="text-aurora">.</span>netti
            </div>
            <div className="text-[11px] text-white/40 mt-1 tracking-wide">
              Suomen jalkapallo analytiikalla
            </div>
          </SisainenLinkki>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {links.map((link) => (
              <SisainenNavLinkki
                key={link.to}
                to={link.to}
                end={link.end}
                className={desktopLinkClass}
              >
                {link.label}
              </SisainenNavLinkki>
            ))}
          </nav>

          {/* Oikea kulma: kausi-indikaattori + mobiili-toggle */}
          <div className="flex items-center gap-3">
            <SarjaValitsin />
            <KausiValitsin />
            <button
              type="button"
              className="md:hidden p-2 text-white/80 hover:text-white"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Sulje valikko' : 'Avaa valikko'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobiili-valikko — slide-in oikealta */}
      {/* Overlay tausta */}
      <div
        className={`md:hidden fixed inset-0 bg-navy-900/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMobile}
        aria-hidden="true"
      />
      {/* Slide-in paneeli */}
      <aside
        className={`md:hidden fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-navy-800 border-l border-navy-700 z-50 transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700">
          <span className="text-sm uppercase tracking-wider text-white/50 font-medium">
            Valikko
          </span>
          <button
            type="button"
            onClick={closeMobile}
            className="p-1 text-white/70 hover:text-white"
            aria-label="Sulje valikko"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex flex-col p-3 gap-1">
          {links.map((link) => (
            <SisainenNavLinkki
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={closeMobile}
              className={mobileLinkClass}
            >
              {link.label}
            </SisainenNavLinkki>
          ))}
        </nav>
        <div className="px-5 py-4 mt-2 border-t border-navy-700">
          <SarjaValitsin mobiili />
          <KausiValitsin mobiili />
        </div>
      </aside>

      <main className="flex-1 max-w-6xl mx-auto w-full">{children}</main>

      <footer className="border-t border-navy-700 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-white/50">
          pallonetti.fi
        </div>
      </footer>
    </div>
  );
}
