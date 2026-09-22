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
import { ExternalLink } from 'lucide-react';
import type { Nosto, Siirto } from '@/services/api';
import { naytaKokoNimi } from '@/utils/nimet';
import { AKATEMIA_SELITE } from '@/constants/akatemiat';
import { lahdeRivi } from '@/constants/lahde';

/** "Yllson Lika (21 v, KäPa)" — nimi näyttöasussa, ei lähteen kirjoitusasussa. */
function tunniste(n: Nosto): string {
  return naytaKokoNimi(n.etunimi, n.sukunimi) + ' (' + n.ika + ' v, ' + n.joukkue + ')';
}

/**
 * ISO-paiva suomalaisittain ilman Date-jasennysta: "2026-09-21" →
 * "21.9.2026". Merkkijonosta poimiminen on tarkoituksellista: se ei voi
 * siirtaa paivaa aikavyohykkeen yli niin kuin new Date(string) voi.
 */
function suomalainenPvm(iso: string): string | null {
  const osat = iso.slice(0, 10).split('-');
  if (osat.length !== 3) return null;
  const [v, kk, pp] = osat.map((x) => parseInt(x, 10));
  if (!v || !kk || !pp) return null;
  return pp + '.' + kk + '.' + v;
}

/**
 * Tilannerivi. Tilanne kerrotaan tuontipaivana eika otteluiden
 * maarana: joukkueilla on eri maara otteluita pelattuna, joten yksi
 * ottelumaara olisi vaara ja vali ei kerro lukijalle mitaan.
 */
export function Tilannerivi({
  tuotuPvm,
  sarja,
}: {
  tuotuPvm: string | null;
  sarja: string;
}) {
  const pvm = tuotuPvm === null ? null : suomalainenPvm(tuotuPvm);
  return (
    <p className="text-xs text-white/40">
      {lahdeRivi(sarja)}
      {pvm === null ? '' : ' · tilanne ' + pvm}
    </p>
  );
}

/**
 * Akatemiamerkinta. Akatemiajoukkueen koko idea on peluuttaa nuoria,
 * joten sen pelaajan luvut eivat ole vertailukelpoisia muiden seurojen
 * kanssa ilman tata tietoa. Selite tulee samasta vakiosta kuin muualla
 * sivustolla, ja joukkuelista on nimetty vakio — ei nimesta paateltu.
 */
function AkatemiaMerkki() {
  return (
    <span
      className="inline-block rounded-md border border-navy-500 bg-navy-700/60 px-2 py-0.5 text-[11px] text-white/60"
      title={AKATEMIA_SELITE}
    >
      akatemiajoukkue
    </span>
  );
}

/**
 * Siirto- tai lainamerkinta valokeilassa. Siirtynyt pelaaja voi olla
 * valittuna, koska hanen minuuttinsa ovat taman kauden dataa —
 * merkinta kertoo, ettei han enaa pelaa samassa seurassa. Siirtosummia
 * ei nayteta, ja lahde nakyy linkkina.
 */
function SiirtoMerkki({ siirto, linkki }: { siirto: Siirto; linkki?: boolean }) {
  const otsikko =
    siirto.tyyppi === 'laina' ? 'Lainalla' : 'Siirtynyt kesken kauden';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-aurora/30 bg-aurora/5 px-2 py-0.5 text-[11px] text-white/80">
      <span>
        {otsikko}: {siirto.uusi_seura}, {siirto.maa}
      </span>
      {linkki && (
        <a
          href={siirto.lahde_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-ice hover:text-white transition-colors"
        >
          Lähde
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </span>
  );
}

/** Etusivun yksi lause. Ei nostoa = ei osiota, ei placeholderia. */
export function EtusivunLause({
  nosto,
  tuotuPvm,
  sarja,
}: {
  nosto: Nosto | null;
  tuotuPvm: string | null;
  sarja: string;
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
      {(nosto.akatemia || nosto.siirto) && (
        <div className="flex flex-wrap items-center gap-2">
          {nosto.akatemia && <AkatemiaMerkki />}
          {nosto.siirto && <SiirtoMerkki siirto={nosto.siirto} linkki />}
        </div>
      )}
      <p className="text-[11px] text-white/40 leading-relaxed max-w-2xl">
        Valinta: suurin poikkeama oman ikäryhmän mediaanista ylöspäin,
        mitattuna osuutena joukkueen minuuteista tai maalisijoituksena.
        Vertailujoukko: {nosto.rivi.vertailujoukko ?? 'oma ikäryhmä'}.
      </p>
      <Tilannerivi tuotuPvm={tuotuPvm} sarja={sarja} />
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
          {(n.akatemia || n.siirto) && (
            <span className="flex flex-wrap items-center gap-2">
              {n.akatemia && <AkatemiaMerkki />}
              {n.siirto && <SiirtoMerkki siirto={n.siirto} />}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
