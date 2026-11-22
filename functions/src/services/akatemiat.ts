// ============================================
// AKATEMIAJOUKKUEET
//
// Akatemiajoukkue on seuran oma kasvattajajoukkue, jonka koko idea on
// peluuttaa nuoria: HJK Klubi 04:n peliajasta noin 99 % ja SJK Akatemian
// 80–93 % menee alle 21-vuotiaille. Muissa seuroissa haarukka on 3–59 %.
// KuPS Akatemia I lisättiin 22.11.2026, kun Miesten Ykkönen 2024 tuotiin
// (17–21-vuotiaiden osuus 75,2 %).
//
// Jos liigaluku laskettaisiin vain yhtena lukuna, nama kaksi seuraa
// nostaisivat sen tasolle, joka ei kerro muiden seurojen kaytannosta.
// Siksi luku naytetaan kahtena: kaikki joukkueet ja ilman akatemioita.
//
// Lista on TAHALLAAN nimetty vakio eika nimesta paateltava saanto.
// "Akatemia"-sanan etsiminen nimesta olisi arvaus, joka muuttuisi
// aanettomasti jos joukkue vaihtaa nimea tai uusi seura nimeaa itsensa
// samoin. Lista nakyy Tietoa-sivulla, jotta lukija voi tarkistaa sen.
// ============================================

/** Joukkueet, jotka rajataan pois "ilman akatemioita" -luvusta. */
export const AKATEMIAJOUKKUEET = ['HJK Klubi 04', 'SJK Akatemia', 'KuPS Akatemia I'] as const;

/** Vertailu kestaa kirjainkoon ja ylimaaraiset valilyonnit. */
function avain(nimi: string): string {
  return String(nimi || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const AKATEMIA_AVAIMET = new Set(AKATEMIAJOUKKUEET.map(avain));

export function onAkatemia(joukkue: string): boolean {
  return AKATEMIA_AVAIMET.has(avain(joukkue));
}
