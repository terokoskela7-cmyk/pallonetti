// ============================================
// SEASON SELECTOR COMPONENT
// Allows switching between seasons
// ============================================
import { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { getSeasons, type SeasonInfo } from '@/services/api';

interface SeasonSelectorProps {
  selectedSeason: number;
  onSeasonChange: (season: number) => void;
}

export function SeasonSelector({ selectedSeason, onSeasonChange }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSeasons()
      .then(setSeasons)
      .catch(() => {
        // Fallback if API not available
        setSeasons([
          { year: 2026, startDate: '2026-04-04', endDate: '2026-10-25', currentMatchday: 1, numberOfMatchdays: 27, numberOfTeams: 12, status: 'upcoming' },
          { year: 2025, startDate: '2025-04-05', endDate: '2025-10-26', currentMatchday: 27, numberOfMatchdays: 27, numberOfTeams: 12, status: 'finished' },
          { year: 2024, startDate: '2024-04-06', endDate: '2024-10-19', currentMatchday: 27, numberOfMatchdays: 27, numberOfTeams: 12, status: 'finished' },
        ]);
      });
  }, []);

  const selected = seasons.find((s) => s.year === selectedSeason);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ongoing': return 'Käynnissä';
      case 'finished': return 'Päättynyt';
      case 'upcoming': return 'Tulossa';
      default: return status;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-navy-800 border border-navy-600 
                   rounded-lg text-text-primary hover:border-ice-blue/50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-ice-blue" />
        <span className="font-medium">Kausi {selectedSeason}</span>
        {selected && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700 text-text-secondary">
            {getStatusLabel(selected.status)}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 w-56 bg-navy-800 border border-navy-600 
                          rounded-lg shadow-xl z-50 overflow-hidden">
            {seasons.map((season) => (
              <button
                key={season.year}
                onClick={() => {
                  onSeasonChange(season.year);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left
                           hover:bg-navy-700 transition-colors
                           ${season.year === selectedSeason ? 'bg-navy-700/50 border-l-2 border-ice-blue' : ''}`}
              >
                <div>
                  <div className="font-medium text-text-primary">
                    Kausi {season.year}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {season.startDate} - {season.endDate}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  season.status === 'ongoing'
                    ? 'bg-green-500/20 text-green-400'
                    : season.status === 'finished'
                    ? 'bg-navy-700 text-text-secondary'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {getStatusLabel(season.status)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
