/**
 * PELAAJAHISTORIA IMPORT — 2024–2026 pelaajadata
 *
 * Lukee pelaajahistoria.json:stä ja kirjoittaa Firestoreen batch-erinä:
 *   suoritukset/{sarja}_{kausi}_{joukkue}_{slug}
 *   seasons/{kausi}/players/{sarja}_{slug}
 *
 * Käyttö: POST /api/admin/import-pelaajahistoria
 */

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

export function toSlug(etu: string, suku: string): string {
  return `${etu}-${suku}`
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

export interface ImportStats {
  imported: number;
  skipped: number;
  series: Record<string, { seasons: Record<number, number> }>;
}

export async function importPelaajaHistoria(): Promise<ImportStats> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const stats: ImportStats = {
    imported: 0,
    skipped: 0,
    series: {},
  };

  const CHUNK = 200;

  for (const [sarja, kaudet] of Object.entries(pelaajaHistoriaData)) {
    if (!sarja || sarja === 'nan' || sarja.includes('undefined')) {
      stats.skipped++;
      continue;
    }

    if (!stats.series[sarja]) {
      stats.series[sarja] = { seasons: {} };
    }

    for (const [kausiStr, joukkueet] of Object.entries(kaudet)) {
      const kausi = parseInt(kausiStr, 10);
      if (!kausi || kausi === 0) {
        stats.skipped++;
        continue;
      }

      if (!stats.series[sarja].seasons[kausi]) {
        stats.series[sarja].seasons[kausi] = 0;
      }

      const pelaajat: Array<{ slug: string; data: PelaajaData; joukkue: string }> = [];

      for (const [joukkueKey, pelaajat_] of Object.entries(joukkueet)) {
        for (const [slug, pdata] of Object.entries(pelaajat_ as Record<string, PelaajaData>)) {
          pelaajat.push({
            slug,
            data: pdata as PelaajaData,
            joukkue: (pdata as any).joukkue || joukkueKey.replace(/_/g, ' '),
          });
        }
      }

      for (let i = 0; i < pelaajat.length; i += CHUNK) {
        const batch = db.batch();
        const slice = pelaajat.slice(i, i + CHUNK);

        for (const { slug, data, joukkue } of slice) {
          const suoritusRef = db
            .collection('suoritukset')
            .doc(`${sarja}_${kausi}_${joukkue}_${slug}`);

          batch.set(suoritusRef, {
            sarja,
            kausi,
            joukkue,
            slug,
            nimi: `${data.etunimi} ${data.sukunimi}`,
            palloid: data.palloid,
            ika: data.ika,
            minuutit: data.minuutit,
            aloitukset: data.aloitukset,
            ottelut: data.ottelut,
            maalit: data.maalit,
            updatedAt: now,
          });

          const playerRef = db
            .collection('seasons')
            .doc(String(kausi))
            .collection('players')
            .doc(`${sarja}_${slug}`);

          batch.set(playerRef, {
            sarja,
            slug,
            nimi: `${data.etunimi} ${data.sukunimi}`,
            palloid: data.palloid,
            ika: data.ika,
            joukkue,
            minuutit: data.minuutit,
            aloitukset: data.aloitukset,
            ottelut: data.ottelut,
            maalit: data.maalit,
            updatedAt: now,
          });

          stats.imported++;
          stats.series[sarja].seasons[kausi]++;
        }

        await batch.commit();
      }
    }
  }

  return stats;
}
