// ============================================
// NOSTOKORTIT — /peliaika
//
// Kortit kertovat kolme asiaa VALITUSTA SARJASTA. Jokainen luku tulee
// rajapinnasta: joukkuerivit valitun sarjan youth-stats-vastauksesta ja
// kausivertailu trendipisteistä. Selaimessa ei lasketa lukuja, eikä
// mitään vertailukohtaa kovakoodata.
//
// Aiemmin tässä oli vakio PREV_SEASON_AVG = 18.0 ja teksti "Veikkausliiga
// antaa nuorille enemmän peliaikaa kuin koskaan". Ykkösliigan näkymässä
// se väitti väärää sarjaa, väärää suuntaa (39,5 % → 37,1 % on lasku) ja
// esitti lähteettömän superlatiivin. Vertailuluku tulee nyt edellisen
// kauden trendipisteestä, ja teksti kertoo vain mitä luvuissa on.
//
// Sanat pidetään kuvaavina: kortti kertoo mikä joukkue ja mikä luku, ei
// sitä onko luku hyvä.
// ============================================
import { TrendingUp, TrendingDown, Minus, Users, Star, type LucideIcon } from 'lucide-react';
import type { YouthStats, TrendiKausi } from '@/services/api';
import { pros, luku, desimaali } from '@/utils/luvut';
import { onAkatemia, AKATEMIA_SELITE } from '@/constants/akatemiat';

interface InsightBarProps {
  teams: YouthStats[];
  /** Valittu sarja — näkyy korteissa, jottei lukija oleta Veikkausliigaa. */
  sarja: string;
  kausi: number;
  /** Valitun sarjan trendipisteet; kausivertailu tulee näistä. */
  trendit: TrendiKausi[] | null;
}

interface Insight {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
}

function rakennaKortit(
  teams: YouthStats[],
  sarja: string,
  kausi: number,
  trendit: TrendiKausi[] | null,
): Insight[] {
  if (teams.length === 0) return [];

  const kortit: Insight[] = [];

  // 1) Eniten peliaikaa nuorille — valitun sarjan joukkueista.
  const topNuoret = [...teams].sort((a, b) => b.osuusNuoret - a.osuusNuoret)[0];
  kortit.push({
    icon: Star,
    label: 'Eniten peliaikaa nuorille',
    title: topNuoret.teamName + (onAkatemia(topNuoret.teamName) ? ' *' : ''),
    body:
      pros(topNuoret.osuusNuoret) +
      ' joukkueen peliminuuteista meni 17–21-vuotiaille ' +
      sarja +
      'ssa kaudella ' +
      kausi +
      '.' +
      (onAkatemia(topNuoret.teamName) ? ' * ' + AKATEMIA_SELITE : ''),
  });

  // 2) Kausivertailu — vain jos edellinen kausi on samasta sarjasta.
  const omat = (trendit ?? [])
    .filter((t) => t.sarja === sarja)
    .sort((a, b) => a.kausi - b.kausi);
  const nyt = omat.find((t) => t.kausi === kausi) ?? null;
  const edellinen = omat.filter((t) => t.kausi < kausi).pop() ?? null;

  if (nyt !== null && nyt.osuus1721 !== null) {
    if (edellinen !== null && edellinen.osuus1721 !== null) {
      const ero = Math.round((nyt.osuus1721 - edellinen.osuus1721) * 10) / 10;
      const suunta = ero > 0 ? 'enemmän' : ero < 0 ? 'vähemmän' : 'saman verran';
      kortit.push({
        icon: ero > 0 ? TrendingUp : ero < 0 ? TrendingDown : Minus,
        label: 'Muutos edelliseen kauteen',
        title: pros(nyt.osuus1721) + ' (' + kausi + ')',
        body:
          'Kaudella ' +
          edellinen.kausi +
          ' osuus oli ' +
          pros(edellinen.osuus1721) +
          ', eli ' +
          desimaali(Math.abs(ero)) +
          ' prosenttiyksikköä ' +
          suunta +
          '.' +
          (nyt.kesken ? ' Kausi ' + kausi + ' on kesken.' : ''),
      });
    } else {
      // Ensimmäinen kausi sarjassa: vertailukohtaa ei ole, ja se
      // sanotaan auki sen sijaan että kortti jätettäisiin pois.
      kortit.push({
        icon: Minus,
        label: 'Muutos edelliseen kauteen',
        title: pros(nyt.osuus1721) + ' (' + kausi + ')',
        body:
          'Edellistä kautta ei ole tässä aineistossa, joten muutosta ei ' +
          'voi laskea.',
      });
    }
  }

  // 3) Eniten alle 21-vuotiaita pelaajia.
  const mostU21 = [...teams].sort((a, b) => b.pelaajatAlle21 - a.pelaajatAlle21)[0];
  kortit.push({
    icon: Users,
    label: 'Eniten alle 21-vuotiaita',
    title: mostU21.teamName + (onAkatemia(mostU21.teamName) ? ' *' : ''),
    body:
      luku(mostU21.pelaajatAlle21) +
      ' alle 21-vuotiasta pelaajaa on saanut peliaikaa kaudella ' +
      kausi +
      '.',
  });

  return kortit;
}

export function InsightBar({ teams, sarja, kausi, trendit }: InsightBarProps) {
  const kortit = rakennaKortit(teams, sarja, kausi, trendit);
  if (kortit.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {kortit.map((ins) => {
        const Icon = ins.icon;
        return (
          <div
            key={ins.label}
            className="bg-navy-700 border border-navy-600 border-l-2 border-l-ice rounded-r-md p-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 mb-2">
              <Icon className="w-3.5 h-3.5 text-ice" />
              {ins.label}
            </div>
            <div className="font-medium text-white/90 mb-2">{ins.title}</div>
            <div className="text-sm text-white/60 leading-relaxed">
              {ins.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}
