// ============================================
// SEUROJEN GENETIIVIT
//
// Seuran nimea EI taivuteta merkkijonolla. `${joukkue}:n` tuottaisi
// "Ilves:n", "AC Oulu:n" ja "FF Jaro:n" — seitseman seuraa
// kahdestatoista vaarin. Taivutus on kielioppia, ei merkkijonojen
// yhdistamista, joten se on nimetty kartta.
//
// Tuntematon seura EI saa taivutusarvausta: silloin kayttoon tulee muoto
// "joukkueen minuuteista", joka on oikein kaikille nimille. Uusi seura
// lisataan tahan karttaan, ja testi listaa datasta ne jotka puuttuvat.
// ============================================

/** Seura -> genetiivi. Kattaa kaikki kausien 2020–2026 seurat. */
export const SEURAN_GENETIIVI: Record<string, string> = {
  'AC Oulu': 'AC Oulun',
  EIF: 'EIF:n',
  'FC Haka': 'FC Hakan',
  'FC Honka': 'FC Hongan',
  'FC Inter': 'FC Interin',
  'FC Lahti': 'FC Lahden',
  'FF Jaro': 'FF Jaron',
  HIFK: 'HIFK:n',
  HJK: 'HJK:n',
  'HJK Klubi 04': 'HJK Klubi 04:n',
  'IF Gnistan': 'IF Gnistanin',
  'IFK Mariehamn': 'IFK Mariehamnin',
  Ilves: 'Ilveksen',
  JIPPO: 'JIPPOn',
  JäPS: 'JäPS:n',
  KTP: 'KTP:n',
  KuPS: 'KuPS:n',
  KäPa: 'KäPan',
  MP: 'MP:n',
  'PK-35': 'PK-35:n',
  RoPS: 'RoPS:n',
  SJK: 'SJK:n',
  'SJK Akatemia': 'SJK Akatemian',
  SalPa: 'SalPan',
  TPS: 'TPS:n',
  VPS: 'VPS:n',
};

function avain(nimi: string): string {
  return String(nimi || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const KARTTA = new Map(
  Object.entries(SEURAN_GENETIIVI).map(([k, v]) => [avain(k), v]),
);

/**
 * Seuran genetiivi, tai null jos seuraa ei tunneta. Null on tahallinen:
 * kutsuja kayttaa silloin muotoa "joukkueen", eika sivulle paady
 * arvattua taivutusta.
 */
export function genetiivi(joukkue: string): string | null {
  return KARTTA.get(avain(joukkue)) ?? null;
}

/** "KuPS:n kauden minuuteista" tai "joukkueen kauden minuuteista". */
export function genetiiviTaiJoukkueen(joukkue: string): string {
  return genetiivi(joukkue) ?? 'joukkueen';
}

// ============================================
// SARJOJEN INESSIIVI
//
// Sijoituslauseessa vertailujoukko sanotaan auki: "20-vuotiaiden karki
// Veikkausliigassa". Sarja taivutetaan samasta syysta kuin seura ei
// taivuteta merkkijonolla — taivutus on kielioppia. Sarjoja on kaksi,
// joten kartta on lyhyt ja tuntematon sarja saa muodon "sarjassa".
// ============================================
const SARJAN_INESSIIVI: Record<string, string> = {
  Veikkausliiga: 'Veikkausliigassa',
  Ykkösliiga: 'Ykkösliigassa',
};

/** "Veikkausliigassa", tai "sarjassa" jos sarjaa ei tunneta. */
export function sarjaInessiivi(sarja: string): string {
  return SARJAN_INESSIIVI[String(sarja || '').trim()] ?? 'sarjassa';
}
