import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Tutkimuskortti — iso tilastoluku + selite + lähde.
 *
 * Lähde on pakollinen: luku ilman lähdettä on väite, jota lukija ei voi
 * tarkistaa. Jos luku on sivuston omasta datasta, `to` vie siihen
 * näkymään, josta luku on laskettu.
 */
export interface ResearchCardProps {
  icon: LucideIcon;
  stat: string;
  title: string;
  source: string;
  /** Sisäinen polku lähteeseen, esim. oma osio toisella sivulla. */
  to?: string;
}

export function ResearchCard({ icon: Icon, stat, title, source, to }: ResearchCardProps) {
  return (
    <div className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-5 flex flex-col">
      <Icon className="w-5 h-5 text-ice mb-3" />
      <div className="text-3xl font-bold font-mono tabular text-aurora leading-none mb-2">
        {stat}
      </div>
      <div className="text-sm text-white/90 leading-snug mb-2">{title}</div>
      <div className="text-xs text-white/45 mt-auto">
        {to ? (
          <Link to={to} className="hover:text-ice transition-colors">
            {source}
          </Link>
        ) : (
          source
        )}
      </div>
    </div>
  );
}
