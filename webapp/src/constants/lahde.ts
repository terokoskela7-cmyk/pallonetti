// ============================================
// LÄHDEMAININTA — yksi lähde koko sivustolle
//
// Jokainen sivu, joka näyttää peliaikalukuja, kertoo mistä ne tulevat.
// Teksti muodostetaan TÄÄLLÄ, ei komponenteissa: kovakoodattuna se
// eriytyisi sivu kerrallaan, ja lukija näkisi saman lähteen kahdella
// eri nimellä.
//
// Sarjan nimeä EI taivuteta merkkijonolla. `${sarja}n` sattuu toimimaan
// näillä kahdella sarjalla, mutta se on sama arvaus, joka tuottaa
// "Ilves:n" seurojen kohdalla — taivutus on kielioppia, ei merkkijonojen
// yhdistämistä. Uusi sarja lisätään tähän karttaan, ja testi tarkistaa,
// ettei yksikään tuettu sarja jää ilman taivutusta.
// ============================================

/** Sarja → genetiivi. Kattaa kaikki tuetut sarjat. */
const SARJAN_GENETIIVI: Record<string, string> = {
  Veikkausliiga: 'Veikkausliigan',
  Ykkösliiga: 'Ykkösliigan',
};

/** Muoto tuntemattomalle sarjalle: oikein, muttei nimeä sarjaa. */
const TUNTEMATON = 'sarjan';

function avain(sarja: string): string {
  return String(sarja || '').replace(/\s+/g, ' ').trim();
}

/** Sarjan genetiivi, tai "sarjan" jos sarjaa ei tunneta. */
export function sarjaGenetiivi(sarja: string): string {
  return SARJAN_GENETIIVI[avain(sarja)] ?? TUNTEMATON;
}

/**
 * Lähdemaininta ilman "Lähde:"-etuliitettä, esim.
 * "Veikkausliigan viralliset tilastot (kausivienti)".
 */
export function lahdeMaininta(sarja: string): string {
  return sarjaGenetiivi(sarja) + ' viralliset tilastot (kausivienti)';
}

/** Sama etuliitteen kanssa, listojen ja alatunnisteiden alle. */
export function lahdeRivi(sarja: string): string {
  return 'Lähde: ' + lahdeMaininta(sarja);
}
