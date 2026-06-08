import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navLinks: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'etusivu', end: true },
  { to: '/peliaika', label: 'analyysi' },
  { to: '/nuoret', label: 'U21-pelaajat' },
  { to: '/pelaajat', label: 'kaikki pelaajat' },
  { to: '/about', label: 'tietoa' },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `px-3 py-2 rounded-t-md transition-colors ${
    isActive
      ? 'bg-ice/10 text-ice border-b-2 border-ice'
      : 'text-white/70 hover:text-white hover:bg-navy-700/40 border-b-2 border-transparent'
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-navy-700 relative z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo + tagline */}
          <Link
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
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={desktopLinkClass}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Oikea kulma: kausi-indikaattori + mobiili-toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden md:inline-flex items-center gap-1 text-sm text-amber-400 px-3 py-1.5 border border-amber-400/40 rounded-md hover:border-amber-400/70 hover:bg-amber-400/5 transition-colors tabular"
              aria-label="Vaihda kausi (tulossa)"
            >
              2026 ▾
            </button>
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
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={closeMobile}
              className={mobileLinkClass}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 mt-2 border-t border-navy-700">
          <div className="text-amber-400 text-sm tabular">Kausi 2026 ▾</div>
        </div>
      </aside>

      <main className="flex-1 max-w-6xl mx-auto w-full">{children}</main>

      <footer className="border-t border-navy-700 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-white/50">
          pallonetti.fi — by TalentMasterID
        </div>
      </footer>
    </div>
  );
}
