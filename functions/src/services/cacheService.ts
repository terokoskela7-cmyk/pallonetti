// ============================================
// FIRESTORE CACHE SERVICE
// Caches API responses to minimize external
// API calls and improve performance
// ============================================
import * as admin from 'firebase-admin';
import { CacheEntry } from '../types';

// Cache validity durations (in hours)
const CACHE_DURATIONS: Record<string, number> = {
  standings: 2,
  teams: 24,
  players: 6,
  player_stats: 6,
  matches: 1,
  fixtures: 1,
  youth_stats: 6,
  fbref_stats: 12,
  transfermarkt_values: 24,
  lineups: 0.5,
};

class CacheService {
  // Lazy: admin.firestore() kutsutaan vasta ensimmäisellä käytöllä.
  // Konstruktori ajetaan module-load-aikana, mutta initializeApp() vasta
  // index.ts:n body-koodissa — eager-init kaataisi adminin.
  private get db(): admin.firestore.Firestore {
    return admin.firestore();
  }

  constructor() {
    // Ei mitään — db alustuu lazy:nä
  }

  /** Hae cache-merkintä */
  async get<T>(key: string): Promise<T | null> {
    try {
      const doc = await this.db.collection('cache').doc(key).get();
      if (!doc.exists) return null;

      const data = doc.data() as CacheEntry<T>;
      const now = new Date();
      const expiresAt = new Date(data.expiresAt);

      if (now > expiresAt) {
        console.log(`Cache expired for key: ${key}`);
        return null;
      }

      console.log(`Cache hit for key: ${key} (source: ${data.source})`);
      return data.data;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  /** Tallenna cache-merkintä */
  async set<T>(key: string, data: T, source: string, type?: string): Promise<void> {
    try {
      const duration = (type && CACHE_DURATIONS[type]) || 1;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000);

      const entry: CacheEntry<T> = {
        data,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        source,
        // Tallenna myös looginen tyyppi, jotta clearType voi invalidoida
        // oikein (aiemmin clearType haki source-kentästä type-arvolla → ei osunut).
        type: type ?? source,
        version: 1,
      };

      await this.db.collection('cache').doc(key).set(entry);
      console.log(`Cache set for key: ${key} (expires: ${expiresAt.toISOString()})`);
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
    }
  }

  /** Hae tai hae ja tallenna */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    source: string,
    type?: string
  ): Promise<{ data: T; cached: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, cached: true };
    }

    const data = await fetchFn();
    await this.set(key, data, source, type);
    return { data, cached: false };
  }

  /** Poista vanhentuneet merkinnät */
  async cleanup(): Promise<number> {
    try {
      const snapshot = await this.db.collection('cache').get();
      const now = new Date();
      let deleted = 0;

      const batch = this.db.batch();
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as CacheEntry<unknown>;
        if (new Date(data.expiresAt) < now) {
          batch.delete(doc.ref);
          deleted++;
        }
      });

      await batch.commit();
      console.log(`Cache cleanup: removed ${deleted} expired entries`);
      return deleted;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /** Tyhjennä tietty cache-tyyppi. Hakee `type`-kentästä (ei `source`) —
   *  korjattu: ennen haki source-kentästä type-arvolla, jolloin esim.
   *  youth_agg (source='aggregator', type='youth_stats') ei koskaan tyhjentynyt. */
  async clearType(type: string): Promise<void> {
    try {
      const snapshot = await this.db
        .collection('cache')
        .where('type', '==', type)
        .get();

      const batch = this.db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Cleared cache type: ${type}`);
    } catch (error) {
      console.error(`Cache clear error for type ${type}:`, error);
    }
  }

  /** Hae cache-tilastot */
  async getStats(): Promise<{
    totalEntries: number;
    bySource: Record<string, number>;
    expiredEntries: number;
  }> {
    const snapshot = await this.db.collection('cache').get();
    const now = new Date();
    const bySource: Record<string, number> = {};
    let expiredEntries = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CacheEntry<unknown>;
      bySource[data.source] = (bySource[data.source] || 0) + 1;
      if (new Date(data.expiresAt) < now) expiredEntries++;
    });

    return {
      totalEntries: snapshot.size,
      bySource,
      expiredEntries,
    };
  }
}

export const cacheService = new CacheService();
