// ============================================
// VALOKEILA — yksi generoitu lause, ja kolme korttia
//
// Kumpikin nakyma lukee saman API-valinnan: pelaajat, joiden luku
// poikkeaa eniten oman ikaryhmansa mediaanista. Valinta tehdaan
// rajapinnassa, ei selaimessa, ja se vaihtuu kun data paivittyy.
// Tassa ei lasketa eika sanoiteta mitaan.
//
// Markkina-arvoa EI nayteta: ainoa lahde oli Transfermarkt, jonka
// kaytto on lopetettu koko sivustolla. Tyhja kohta on parempi kuin
// vanhentunut arvo.
// ============================================
import { Link } from 'react-router-dom';
import type { Nosto } from '@/services/api';
import { naytaKokoNimi } from '@/utils/nimet';

/** "Yllson Lika (21 v, KäPa)" — nimi näyttöasussa, ei lähteen kirjoitusasussa. */
function tunniste(n: Nosto): string {
  return naytaKokoNimi(n.etunimi, n.sukunimi) + ' (' + n.ika + ' v, ' + n.joukkue + ')';
}

/**
 * Tilannerivi. Kierrosnumeroa ei ole kausiviennissa, joten tilanne
 * kerrotaan otteluina — sama tieto ilman keksittya kierroslukua.
 */
export function Tilannerivi({
  otteluita,
}: {
  otteluita: { min: number; max: number } | null;
}) {
  const tilanne =
    otteluita === null
      ? null
      : otteluita.min === otteluita.max
        ? 'tilanne ' + otteluita.max + ' ottelun jälkeen'
        : 'tilanne ' + otteluita.min + '–' + otteluita.max + ' ottelun jälkeen';
  return (
    <p className="text-xs text-white/40">
      Lähde: sarjan viralliset tilastot (kausivienti)
      {tilanne === null ? '' : ' · ' + tilanne}
    </p>
  );
}

/** Etusivun yksi lause. Ei nostoa = ei osiota, ei placeholderia. */
export function EtusivunLause({
  nosto,
  otteluita,
}: {
  nosto: Nosto | null;
  otteluita: { min: number; max: number } | null;
}) {
  if (!nosto) return null;
  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-xl p-6 md:p-8 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ice font-medium">
        Kauden poikkeama
      </div>
      <p className="text-lg md:text-2xl font-light leading-snug text-white/90">
        <Link
          to={`/pelaaja/${nosto.slug}`}
          className="text-ice hover:text-white transition-colors"
        >
          {tunniste(nosto)}
        </Link>
        <span className="text-white/60"> — </span>
        <span className="tabular">{nosto.rivi.teksti}</span>
      </p>
      <p className="text-[11px] text-white/40 leading-relaxed max-w-2xl">
        Valinta: suurin poikkeama oman ikäryhmän mediaanista. Vertailujoukko:{' '}
        {nosto.rivi.vertailujoukko ?? 'oma ikäryhmä'}.
      </p>
      <Tilannerivi otteluita={otteluita} />
    </section>
  );
}

/** Kolme korttia: valokeilassa olevat pelaajat. */
export function ValokeilaKortit({ nostot }: { nostot: Nosto[] }) {
  if (nostot.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {nostot.map((n) => (
        <Link
          key={n.slug}
          to={`/pelaaja/${n.slug}`}
          className="bg-navy-700/40 border border-navy-600 rounded-xl p-5 space-y-2 hover:border-ice/40 transition-colors"
        >
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            {n.ika} v · {n.joukkue}
          </div>
          <div className="text-lg font-light text-white/95 leading-tight">
            {naytaKokoNimi(n.etunimi, n.sukunimi)}
          </div>
          <p className="text-sm text-white/80 tabular leading-snug">
            {n.rivi.teksti}
          </p>
          {n.rivi.mediaani !== null && (
            <p className="text-[11px] text-white/40">
              ikäryhmän mediaani {n.rivi.mediaani} {n.rivi.yksikko}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
