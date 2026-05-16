import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const navLinks = [
  { to: '/peliaika', label: 'peliaika' },
  { to: '/joukkueet', label: 'joukkueet' },
  { to: '/pelaajat', label: 'pelaajat' },
  { to: '/about', label: 'about' },
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-navy-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="text-2xl font-medium tracking-tight hover:opacity-90 transition-opacity"
          >
            pallo<span className="text-aurora">.</span>netti
          </Link>
          <nav className="flex gap-6 text-sm">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `transition-colors ${
                    isActive ? 'text-ice' : 'text-white/70 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full">{children}</main>

      <footer className="border-t border-navy-700 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-white/50">
          pallonetti.fi — by TalentMasterID
        </div>
      </footer>
    </div>
  );
}
