import {
  AppSettings,
  BusinessLead,
  NicheRadarReport,
  SearchCacheEntry,
} from '../types';

const DB_NAME = 'radar_clientes_db';
const DB_VERSION = 1;

const STORE_LEADS = 'leads';
const STORE_SEARCH_CACHE = 'searchCache';
const STORE_NICHE_REPORTS = 'nicheReports';
const STORE_SETTINGS = 'settings';

export const DEFAULT_SETTINGS: AppSettings = {
  googleCloudApiKey: '',
  sellerProfile: {
    name: 'Ramiro Sanna',
    servicesOffered:
      'Páginas web adaptadas a celulares, sistemas de turnos con seña online para canchas de fútbol, turnos automáticos para estética/salud, y catálogos de pedidos rápidos por WhatsApp para comercios.',
    valueProposition:
      'Ayudo a negocios locales en Córdoba y Argentina a captar más clientes, asegurar turnos con seña y automatizar pedidos por WhatsApp sin costos ocultos.',
    defaultTone: 'Cercano y directo',
  },
  monthlyPlacesLimit: 1000,
  placesUsageByMonth: {},
};

/**
 * Interfaz de repositorio desacoplada para permitir migrar a Firebase Firestore
 * sin modificar los componentes de la interfaz.
 */
export interface DataRepository {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  incrementPlacesUsage(callsCount?: number): Promise<AppSettings>;
  getCurrentMonthKey(): string;

  getAllLeads(): Promise<BusinessLead[]>;
  getSavedLeads(): Promise<BusinessLead[]>;
  getLeadById(id: string): Promise<BusinessLead | undefined>;
  upsertLead(lead: BusinessLead): Promise<void>;
  upsertManyLeads(leads: BusinessLead[]): Promise<void>;
  deleteLead(id: string): Promise<void>;

  getSearchCache(zone: string, niche: string): Promise<SearchCacheEntry | undefined>;
  saveSearchCache(entry: SearchCacheEntry): Promise<void>;
  clearSearchCache(): Promise<void>;

  getNicheReport(zone: string): Promise<NicheRadarReport | undefined>;
  saveNicheReport(report: NicheRadarReport): Promise<void>;
}

export function normalizeCacheKey(zone: string, niche: string): string {
  const clean = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  return `${clean(zone)}__${clean(niche)}`;
}

export function normalizeZoneKey(zone: string): string {
  return zone
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LEADS)) {
        db.createObjectStore(STORE_LEADS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCH_CACHE)) {
        db.createObjectStore(STORE_SEARCH_CACHE, { keyPath: 'cacheKey' });
      }
      if (!db.objectStoreNames.contains(STORE_NICHE_REPORTS)) {
        db.createObjectStore(STORE_NICHE_REPORTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class IndexedDBRepository implements DataRepository {
  getCurrentMonthKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async getSettings(): Promise<AppSettings> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          const loadedProfile = {
            ...DEFAULT_SETTINGS.sellerProfile,
            ...(req.result.value.sellerProfile || {}),
          };
          if (!loadedProfile.name || loadedProfile.name === 'Carlos Mendoza') {
            loadedProfile.name = 'Ramiro Sanna';
          }
          if (loadedProfile.valueProposition?.includes('España')) {
            loadedProfile.valueProposition = loadedProfile.valueProposition.replace(
              /en España/g,
              'en Córdoba y Argentina'
            );
          }
          if (loadedProfile.servicesOffered?.includes('reserva de citas')) {
            loadedProfile.servicesOffered = loadedProfile.servicesOffered.replace(
              /reserva de citas online/g,
              'sistemas para sacar turnos online'
            );
          }
          resolve({
            ...DEFAULT_SETTINGS,
            ...req.result.value,
            sellerProfile: loadedProfile,
            placesUsageByMonth: {
              ...(req.result.value.placesUsageByMonth || {}),
            },
          });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put({ key: 'app_settings', value: settings });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async incrementPlacesUsage(callsCount = 1): Promise<AppSettings> {
    const settings = await this.getSettings();
    const monthKey = this.getCurrentMonthKey();
    const current = settings.placesUsageByMonth[monthKey] || 0;
    const updated: AppSettings = {
      ...settings,
      placesUsageByMonth: {
        ...settings.placesUsageByMonth,
        [monthKey]: current + callsCount,
      },
    };
    await this.saveSettings(updated);
    return updated;
  }

  async getAllLeads(): Promise<BusinessLead[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEADS, 'readonly');
      const store = tx.objectStore(STORE_LEADS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as BusinessLead[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getSavedLeads(): Promise<BusinessLead[]> {
    const all = await this.getAllLeads();
    return all
      .filter((l) => l.isSavedLead)
      .sort((a, b) => b.opportunityScore.total - a.opportunityScore.total);
  }

  async getLeadById(id: string): Promise<BusinessLead | undefined> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEADS, 'readonly');
      const store = tx.objectStore(STORE_LEADS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as BusinessLead | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async upsertLead(lead: BusinessLead): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEADS, 'readwrite');
      const store = tx.objectStore(STORE_LEADS);
      store.put({
        ...lead,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async upsertManyLeads(leads: BusinessLead[]): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEADS, 'readwrite');
      const store = tx.objectStore(STORE_LEADS);
      const now = new Date().toISOString();
      for (const lead of leads) {
        store.put({
          ...lead,
          updatedAt: now,
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteLead(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEADS, 'readwrite');
      const store = tx.objectStore(STORE_LEADS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSearchCache(zone: string, niche: string): Promise<SearchCacheEntry | undefined> {
    const key = normalizeCacheKey(zone, niche);
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SEARCH_CACHE, 'readonly');
      const store = tx.objectStore(STORE_SEARCH_CACHE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as SearchCacheEntry | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSearchCache(entry: SearchCacheEntry): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SEARCH_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_SEARCH_CACHE);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearSearchCache(): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SEARCH_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_SEARCH_CACHE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getNicheReport(zone: string): Promise<NicheRadarReport | undefined> {
    const id = normalizeZoneKey(zone);
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NICHE_REPORTS, 'readonly');
      const store = tx.objectStore(STORE_NICHE_REPORTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as NicheRadarReport | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async saveNicheReport(report: NicheRadarReport): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NICHE_REPORTS, 'readwrite');
      const store = tx.objectStore(STORE_NICHE_REPORTS);
      store.put(report);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbRepository: DataRepository = new IndexedDBRepository();
