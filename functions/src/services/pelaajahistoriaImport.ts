import * as admin from 'firebase-admin';
import pelaajaHistoriaData from '../data/pelaajahistoria.json';

export interface PelaajaData {
  etunimi: string;
  sukunimi: string;
  palloid: number | null;
  ika: number;
  minuutit: number;
  aloitukset: number;
  ottelut: number;
  maalit: number;
}

export async function importPelaajaHistoria() {
  const db = admin.firestore();
  const stats = { imported: 0, skipped: 0, series: {} };
  
  for (const [sarja, kaudet] of Object.entries(pelaajaHistoriaData)) {
    for (const [kausiStr, joukkueet] of Object.entries(kaudet as any)) {
      const kausi = parseInt(kausiStr, 10);
      if (!kausi) continue;
      
      for (const [joukkueKey, pelaajat_] of Object.entries(joukkueet as any)) {
        for (const [slug, pdata] of Object.entries(pelaajat_ as any)) {
          stats.imported++;
        }
      }
    }
  }
  
  return stats;
}
