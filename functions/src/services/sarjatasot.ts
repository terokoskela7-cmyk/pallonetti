// ============================================
// SARJATASOT KAUSITTAIN
//
// Sarjajärjestelmä muuttui kaudeksi 2024: Veikkausliigan ja Ykkösen
// väliin tuli Ykkösliiga. Sama sarjanimi ei siis tarkoita samaa tasoa:
//
//   kaudet 2021–2023   taso 1 Veikkausliiga · taso 2 Ykkönen
//   kaudesta 2024      taso 1 Veikkausliiga · taso 2 Ykkösliiga · taso 3 Ykkönen
//
// Nousu ja putoaminen päätellään tasosta, ei sarjan nimestä: Ykkönen 2023
// → Veikkausliiga 2024 on nousu tasolta 2 tasolle 1, mutta Ykkönen 2023 →
// Ykkösliiga 2024 on sama taso.
//
// Taulukko on nimetty vakio eikä nimestä päätelty sääntö (sama periaate
// kuin akatemiajoukkueilla).
// ============================================

export const VEIKKAUSLIIGA = 'Veikkausliiga';
export const YKKOSLIIGA = 'Ykkösliiga';
export const YKKONEN = 'Miesten Ykkönen';

/** Ensimmäinen kausi, jolla Ykkösliiga on taso 2. */
export const YKKOSLIIGA_ALKAA = 2024;

/** Sarjan taso kaudella. null = sarjaa ei ollut sillä kaudella. */
export function sarjanTaso(sarja: string, kausi: number): number | null {
  if (sarja === VEIKKAUSLIIGA) return 1;
  if (sarja === YKKOSLIIGA) return kausi >= YKKOSLIIGA_ALKAA ? 2 : null;
  if (sarja === YKKONEN) return kausi >= YKKOSLIIGA_ALKAA ? 3 : 2;
  return null;
}

/** Tason sarja kaudella. null = tasoa ei ollut (taso 3 ennen 2024). */
export function tasonSarja(taso: number, kausi: number): string | null {
  if (taso === 1) return VEIKKAUSLIIGA;
  if (taso === 2) return kausi >= YKKOSLIIGA_ALKAA ? YKKOSLIIGA : YKKONEN;
  if (taso === 3) return kausi >= YKKOSLIIGA_ALKAA ? YKKONEN : null;
  return null;
}
