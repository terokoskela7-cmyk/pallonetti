// ============================================
// VERTAILURIVI — alle 21 -osuus, Suomen kansalaiset ja Tanska
//
// Sanamuodot tulevat yhdesta paikasta (utils/vertailu.ts), jotta rivi on
// sama kaikkialla eika kahta eri muotoilua paase syntymaan. Selite on
// aina nakyvissa: rivin kolme lukua eivat kerro itsestaan, mita ne
// mittaavat ja mita ne eivat kerro.
// ============================================
import type { Kolmijako } from '@/services/api';
import { vertailurivinTeksti, VERTAILURIVIN_SELITE } from '@/utils/vertailu';

interface Props {
  osuusAlle21: number | null;
  jako: Kolmijako | null;
}

export function VertailuRivi({ osuusAlle21, jako }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-white/80 tabular">
        {vertailurivinTeksti(osuusAlle21, jako)}
      </p>
      <p className="text-[11px] text-white/40 leading-relaxed max-w-3xl">
        {VERTAILURIVIN_SELITE}
      </p>
    </div>
  );
}
