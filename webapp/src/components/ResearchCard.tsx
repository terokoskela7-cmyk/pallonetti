import type { LucideIcon } from 'lucide-react';

/** Tutkimuskortti — iso tilastoluku + selite + lähde. Käytetään etusivun
 *  tutkimusosiossa ja PelaikaPagen editorial-osiossa (sama tyyli). */
export interface ResearchCardProps {
  icon: LucideIcon;
  stat: string;
  title: string;
  source: string;
}

export function ResearchCard({ icon: Icon, stat, title, source }: ResearchCardProps) {
  return (
    <div className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-5 flex flex-col">
      <Icon className="w-5 h-5 text-ice mb-3" />
      <div className="text-3xl font-bold font-mono tabular text-aurora leading-none mb-2">
        {stat}
      </div>
      <div className="text-sm text-white/90 leading-snug mb-2">{title}</div>
      <div className="text-xs text-white/45 mt-auto">{source}</div>
    </div>
  );
}
