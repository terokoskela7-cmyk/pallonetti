export type LeagueId = 'veikkausliiga' | 'ykkosliiga' | 'ykkonen';

interface LeagueTabBarProps {
  active: LeagueId;
  onChange: (id: LeagueId) => void;
  hasData: Record<LeagueId, boolean>;
}

const tabs: { id: LeagueId; label: string }[] = [
  { id: 'veikkausliiga', label: 'Veikkausliiga' },
  { id: 'ykkosliiga', label: 'Ykkösliiga' },
  { id: 'ykkonen', label: 'Ykkönen' },
];

export function LeagueTabBar({ active, onChange, hasData }: LeagueTabBarProps) {
  return (
    <nav className="border-b border-navy-600">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const hasContent = hasData[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-3 text-sm md:text-base font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-ice' : 'text-white/60 hover:text-white/90'
              }`}
            >
              <span>{tab.label}</span>
              {!hasContent && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-white/30">
                  tulossa
                </span>
              )}
              {isActive && (
                <span className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-ice" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
