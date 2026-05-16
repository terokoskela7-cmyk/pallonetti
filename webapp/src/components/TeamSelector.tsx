// ============================================
// TEAM SELECTOR COMPONENT
// Multi-select or single-select for teams
// ============================================
import { useState, useEffect } from 'react';
import { Shield, ChevronDown, X } from 'lucide-react';
import { getTeams, type Team } from '@/services/api';

interface TeamSelectorProps {
  season: number;
  selectedTeams: string[];
  onTeamsChange: (teamIds: string[]) => void;
  multiple?: boolean;
}

export function TeamSelector({
  season,
  selectedTeams,
  onTeamsChange,
  multiple = true,
}: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getTeams(season)
      .then(setTeams)
      .catch(() => {
        // Fallback teams for Veikkausliiga 2026
        setTeams([
          { id: 'hjk', name: 'HJK Helsinki', shortName: 'HJK', tla: 'HJK', venue: 'Bolt Arena', founded: 1907, clubColors: 'Blue, White', crestUrl: '', address: '' },
          { id: 'kups', name: 'KuPS', shortName: 'KuPS', tla: 'KPS', venue: 'Savon Sanomat Areena', founded: 1923, clubColors: 'Yellow, Black', crestUrl: '', address: '' },
          { id: 'ilves', name: 'Ilves', shortName: 'Ilves', tla: 'ILV', venue: 'Tammelan Stadion', founded: 1931, clubColors: 'Yellow, Green', crestUrl: '', address: '' },
          { id: 'inter', name: 'FC Inter', shortName: 'FC Inter', tla: 'INT', venue: 'Veritas Stadion', founded: 1990, clubColors: 'Blue, Black', crestUrl: '', address: '' },
          { id: 'sjk', name: 'SJK', shortName: 'SJK', tla: 'SJK', venue: 'OmaSP Stadion', founded: 2007, clubColors: 'Black, White', crestUrl: '', address: '' },
          { id: 'gnistan', name: 'IF Gnistan', shortName: 'Gnistan', tla: 'GNI', venue: 'Mustapekka Areena', founded: 1924, clubColors: 'Green, White', crestUrl: '', address: '' },
          { id: 'vps', name: 'VPS', shortName: 'VPS', tla: 'VPS', venue: 'Elisa Stadion', founded: 1924, clubColors: 'Black, White', crestUrl: '', address: '' },
          { id: 'jaro', name: 'FF Jaro', shortName: 'Jaro', tla: 'JAR', venue: 'Jakobstads Centralplan', founded: 1965, clubColors: 'Red, White', crestUrl: '', address: '' },
          { id: 'mariehamn', name: 'IFK Mariehamn', shortName: 'IFK Mhn', tla: 'IFK', venue: 'Wiklöf Holding Arena', founded: 1919, clubColors: 'Green, White', crestUrl: '', address: '' },
          { id: 'ac_oulu', name: 'AC Oulu', shortName: 'AC Oulu', tla: 'ACO', venue: 'Raatin Stadion', founded: 2002, clubColors: 'Blue, White', crestUrl: '', address: '' },
          { id: 'fc_lahti', name: 'FC Lahti', shortName: 'FC Lahti', tla: 'FCL', venue: 'Lahden Stadion', founded: 1996, clubColors: 'Black, White', crestUrl: '', address: '' },
          { id: 'tps', name: 'TPS', shortName: 'TPS', tla: 'TPS', venue: 'Veritas Stadion', founded: 1922, clubColors: 'Black, White', crestUrl: '', address: '' },
        ]);
      });
  }, [season]);

  const toggleTeam = (teamId: string) => {
    if (multiple) {
      if (selectedTeams.includes(teamId)) {
        onTeamsChange(selectedTeams.filter((id) => id !== teamId));
      } else {
        onTeamsChange([...selectedTeams, teamId]);
      }
    } else {
      onTeamsChange([teamId]);
      setOpen(false);
    }
  };

  const selectedTeamNames = teams
    .filter((t) => selectedTeams.includes(t.id))
    .map((t) => t.name);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-navy-800 border border-navy-600 
                   rounded-lg text-text-primary hover:border-ice-blue/50 transition-colors min-w-[200px]"
      >
        <Shield className="w-4 h-4 text-ice-blue" />
        <span className="font-medium truncate">
          {selectedTeams.length === 0
            ? 'Kaikki joukkueet'
            : selectedTeams.length === 1
            ? selectedTeamNames[0]
            : `${selectedTeams.length} joukkuetta`}
        </span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 w-64 bg-navy-800 border border-navy-600 
                          rounded-lg shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
            <div className="p-2 border-b border-navy-700">
              <button
                onClick={() => onTeamsChange([])}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary 
                         hover:bg-navy-700 rounded transition-colors"
              >
                Näytä kaikki
              </button>
            </div>
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => toggleTeam(team.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left
                           hover:bg-navy-700 transition-colors
                           ${selectedTeams.includes(team.id) ? 'bg-navy-700/50' : ''}`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  selectedTeams.includes(team.id)
                    ? 'bg-ice-blue border-ice-blue'
                    : 'border-navy-500'
                }`}>
                  {selectedTeams.includes(team.id) && (
                    <svg className="w-3 h-3 text-navy-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${
                  selectedTeams.includes(team.id) ? 'text-text-primary font-medium' : 'text-text-secondary'
                }`}>
                  {team.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Selected team tags */}
      {multiple && selectedTeams.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedTeamNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-ice-blue/10 
                       text-ice-blue text-xs rounded-full"
            >
              {name}
              <button
                onClick={() => onTeamsChange(selectedTeams.filter((id) => {
                  const t = teams.find((tm) => tm.id === id);
                  return t?.name !== name;
                }))}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
