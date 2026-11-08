import {
  AnalysisQueueStatus,
  BusinessLead,
  GeminiWebAnalysis,
  NicheCategoryMetrics,
  NicheRadarReport,
  OutreachDrafts,
  PageSpeedMetrics,
  PlaceRaw,
  SellerProfile,
  ToneOption,
} from '../types';
import { dbRepository, normalizeCacheKey, normalizeZoneKey } from './db';
import { calculateOpportunityScore, mapPlaceRawToBusinessLead } from './scoring';

async function getCloudKeyHeader(): Promise<Record<string, string>> {
  const settings = await dbRepository.getSettings();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.googleCloudApiKey && settings.googleCloudApiKey.trim()) {
    headers['X-Google-Cloud-Key'] = settings.googleCloudApiKey.trim();
  }
  return headers;
}

function checkQuotaSignal(status: number, bodyText: string) {
  if (
    status === 429 ||
    bodyText.includes('RESOURCE_EXHAUSTED') ||
    bodyText.includes('OVER_QUERY_LIMIT')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

/**
 * Parsea la respuesta HTTP de forma segura sin lanzar "Unexpected token '<'"
 * cuando un proxy intermedio o servidor devuelve una página HTML de error/timeout.
 */
async function safeReadJson(
  res: Response,
  serviceLabel: string
): Promise<any> {
  const rawText = await res.text();
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    if (rawText.trim().startsWith('<')) {
      throw new Error(
        `El servidor o la web tardó demasiado en responder al consultar ${serviceLabel} (HTTP ${res.status}). Inténtalo de nuevo.`
      );
    }
    throw new Error(
      `Respuesta inesperada de ${serviceLabel} (HTTP ${res.status}): ${rawText.slice(0, 140)}`
    );
  }
}

export async function fetchServerConfigStatus(): Promise<{
  hasServerCloudKey: boolean;
  mapsJsApiKey: string;
}> {
  try {
    const res = await fetch('/api/config/status');
    if (!res.ok) return { hasServerCloudKey: false, mapsJsApiKey: '' };
    return await safeReadJson(res, 'Configuración');
  } catch {
    return { hasServerCloudKey: false, mapsJsApiKey: '' };
  }
}

export async function testGoogleCloudKey(apiKeyToTest?: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const headers = await getCloudKeyHeader();
  if (apiKeyToTest !== undefined && apiKeyToTest.trim()) {
    headers['X-Google-Cloud-Key'] = apiKeyToTest.trim();
  }
  const res = await fetch('/api/places/test-key', {
    method: 'POST',
    headers,
  });
  const data = await safeReadJson(res, 'Places API');
  if (!res.ok) {
    checkQuotaSignal(res.status, JSON.stringify(data));
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

export async function searchPlacesByZoneAndNiche(params: {
  zone: string;
  niche: string;
  pageToken?: string;
  forceRefresh?: boolean;
}): Promise<{
  leads: BusinessLead[];
  nextPageToken?: string;
  pagesLoaded: number;
  fromCache: boolean;
}> {
  const { zone, niche, pageToken, forceRefresh } = params;
  const cacheKey = normalizeCacheKey(zone, niche);

  // Si es la primera página y no forzamos refresco, revisar caché
  if (!pageToken && !forceRefresh) {
    const cached = await dbRepository.getSearchCache(zone, niche);
    if (cached && cached.places.length > 0) {
      const existingLeads = await dbRepository.getAllLeads();
      const existingById: Record<string, BusinessLead> = {};
      for (const l of existingLeads) {
        existingById[l.id] = l;
      }
      const merged = cached.places.map((p) => existingById[p.id] || p);
      return {
        leads: merged,
        nextPageToken: cached.nextPageToken,
        pagesLoaded: cached.pagesLoaded,
        fromCache: true,
      };
    }
  }

  const headers = await getCloudKeyHeader();
  const textQuery = `${niche.trim()} en ${zone.trim()}`;

  const res = await fetch('/api/places/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      textQuery,
      pageToken,
    }),
  });

  const data = await safeReadJson(res, 'Places API');
  if (!res.ok) {
    checkQuotaSignal(res.status, JSON.stringify(data));
    throw new Error(data.error || `Error de Places API (${res.status})`);
  }

  // Incrementar contador mensual de llamadas a Places
  await dbRepository.incrementPlacesUsage(1);

  const rawPlaces: PlaceRaw[] = Array.isArray(data.places) ? data.places : [];
  const existingLeads = await dbRepository.getAllLeads();
  const existingById: Record<string, BusinessLead> = {};
  for (const item of existingLeads) {
    existingById[item.id] = item;
  }

  const newLeads = rawPlaces.map((raw) =>
    mapPlaceRawToBusinessLead(raw, zone.trim(), niche.trim(), existingById[raw.id])
  );

  await dbRepository.upsertManyLeads(newLeads);

  const previousCache = pageToken ? await dbRepository.getSearchCache(zone, niche) : undefined;
  const combinedMap: Record<string, BusinessLead> = {};
  if (previousCache) {
    for (const p of previousCache.places) {
      combinedMap[p.id] = existingById[p.id] || p;
    }
  }
  for (const p of newLeads) {
    combinedMap[p.id] = p;
  }

  const allLeads = Object.values(combinedMap);
  const pagesLoaded = previousCache ? previousCache.pagesLoaded + 1 : 1;
  const nextToken = pagesLoaded < 3 ? data.nextPageToken : undefined;

  await dbRepository.saveSearchCache({
    cacheKey,
    zone: zone.trim(),
    niche: niche.trim(),
    places: allLeads,
    nextPageToken: nextToken,
    pagesLoaded,
    createdAt: new Date().toISOString(),
  });

  return {
    leads: allLeads,
    nextPageToken: nextToken,
    pagesLoaded,
    fromCache: false,
  };
}

export async function analyzeSingleBusinessLead(
  lead: BusinessLead,
  customTone?: ToneOption
): Promise<BusinessLead> {
  const settings = await dbRepository.getSettings();
  const headers = await getCloudKeyHeader();
  const tone = customTone || settings.sellerProfile.defaultTone;

  let pageSpeed: PageSpeedMetrics | undefined = lead.pageSpeed;
  let geminiAnalysis: GeminiWebAnalysis | undefined = lead.geminiAnalysis;
  let outreachDrafts: OutreachDrafts | undefined = lead.outreachDrafts;

  // 1. Si tiene web propia, ejecutar PageSpeed Insights v5 (móvil) + Análisis Gemini con URL Context
  if (lead.webClassification === 'own_website' && lead.websiteUri) {
    const psUrl = `/api/pagespeed/analyze?url=${encodeURIComponent(lead.websiteUri)}`;
    const [psRes, geminiRes] = await Promise.allSettled([
      fetch(psUrl, { headers }),
      fetch('/api/gemini/analyze-web', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          businessName: lead.displayName,
          category: lead.primaryTypeDisplayName,
          address: lead.formattedAddress,
          websiteUri: lead.websiteUri,
          rating: lead.rating,
          userRatingCount: lead.userRatingCount,
          sellerProfile: settings.sellerProfile,
          tone,
        }),
      }),
    ]);

    if (psRes.status === 'fulfilled') {
      try {
        const psJson = await safeReadJson(psRes.value, 'PageSpeed Insights');
        if (psRes.value.ok && psJson.pageSpeed) {
          pageSpeed = psJson.pageSpeed;
        } else {
          console.warn('Aviso PageSpeed:', psJson.error);
        }
      } catch (psErr) {
        console.warn('PageSpeed no disponible para esta URL:', psErr);
      }
    }

    if (geminiRes.status === 'fulfilled') {
      const gemJson = await safeReadJson(geminiRes.value, 'Gemini API');
      if (!geminiRes.value.ok) {
        throw new Error(gemJson.error || 'Error al analizar la web con Gemini');
      }
      geminiAnalysis = gemJson.analysis;
      outreachDrafts = gemJson.drafts;
    } else {
      throw new Error(geminiRes.reason?.message || 'Error de red al conectar con Gemini');
    }
  } else {
    // 2. Si NO tiene web propia (Sin web o solo Red social / Directorio), NO llamamos a PageSpeed
    const res = await fetch('/api/gemini/drafts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessName: lead.displayName,
        category: lead.primaryTypeDisplayName,
        address: lead.formattedAddress,
        websiteUri: lead.websiteUri,
        webClassification: lead.webClassification,
        detectedPlatform: lead.detectedPlatform,
        rating: lead.rating,
        userRatingCount: lead.userRatingCount,
        sellerProfile: settings.sellerProfile,
        tone,
      }),
    });

    const data = await safeReadJson(res, 'Gemini API');
    if (!res.ok) {
      throw new Error(data.error || 'Error al generar borradores con Gemini');
    }
    geminiAnalysis = data.analysis;
    outreachDrafts = data.drafts;
  }

  const updatedScore = calculateOpportunityScore(lead, pageSpeed, geminiAnalysis);
  const nextStatus = lead.status === 'Nuevo' ? 'Analizado' : lead.status;

  const updatedLead: BusinessLead = {
    ...lead,
    pageSpeed,
    geminiAnalysis,
    outreachDrafts,
    analysisError: undefined,
    opportunityScore: updatedScore,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  await dbRepository.upsertLead(updatedLead);

  if (lead.zoneTag && lead.nicheTag) {
    const cached = await dbRepository.getSearchCache(lead.zoneTag, lead.nicheTag);
    if (cached) {
      const updatedPlaces = cached.places.map((p) => (p.id === updatedLead.id ? updatedLead : p));
      await dbRepository.saveSearchCache({
        ...cached,
        places: updatedPlaces,
      });
    }
  }

  return updatedLead;
}

export async function regenerateOutreachDrafts(
  lead: BusinessLead,
  tone: ToneOption,
  sellerProfile?: SellerProfile
): Promise<BusinessLead> {
  const settings = await dbRepository.getSettings();
  const profile = sellerProfile || settings.sellerProfile;
  const headers = await getCloudKeyHeader();

  const res = await fetch('/api/gemini/drafts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      businessName: lead.displayName,
      category: lead.primaryTypeDisplayName,
      address: lead.formattedAddress,
      websiteUri: lead.websiteUri,
      webClassification: lead.webClassification,
      detectedPlatform: lead.detectedPlatform,
      rating: lead.rating,
      userRatingCount: lead.userRatingCount,
      existingAnalysis: lead.geminiAnalysis,
      pageSpeed: lead.pageSpeed,
      sellerProfile: profile,
      tone,
    }),
  });

  const data = await safeReadJson(res, 'Gemini API');
  if (!res.ok) {
    throw new Error(data.error || 'No se pudieron regenerar los borradores');
  }

  const updatedLead: BusinessLead = {
    ...lead,
    outreachDrafts: data.drafts,
    geminiAnalysis: lead.geminiAnalysis || data.analysis,
    updatedAt: new Date().toISOString(),
  };

  await dbRepository.upsertLead(updatedLead);
  return updatedLead;
}

export async function generateNicheRadarWithGemini(params: {
  zone: string;
  categories: NicheCategoryMetrics[];
  sellerProfile: SellerProfile;
}): Promise<NicheRadarReport> {
  const headers = await getCloudKeyHeader();
  const res = await fetch('/api/gemini/niche-radar', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await safeReadJson(res, 'Gemini API');
  if (!res.ok) {
    throw new Error(data.error || 'Error al generar recomendaciones de nichos con Gemini');
  }

  const report: NicheRadarReport = {
    id: normalizeZoneKey(params.zone),
    zone: params.zone.trim(),
    analyzedAt: new Date().toISOString(),
    categories: params.categories,
    topThreeSummary: data.topThreeSummary,
    rankedRecommendations: data.rankedRecommendations,
  };

  await dbRepository.saveNicheReport(report);
  return report;
}

/**
 * Cola de análisis concurrente de máximo 2 negocios simultáneos.
 */
class ConcurrentAnalysisQueue {
  private concurrency = 2;
  private activeIds: Set<string> = new Set();
  private queue: BusinessLead[] = [];
  private currentNames: Record<string, string> = {};
  private completedCount = 0;
  private totalCount = 0;
  private listeners: Set<(status: AnalysisQueueStatus, updatedLead?: BusinessLead) => void> =
    new Set();

  subscribe(fn: (status: AnalysisQueueStatus, updatedLead?: BusinessLead) => void): () => void {
    this.listeners.add(fn);
    fn(this.getStatus());
    return () => {
      this.listeners.delete(fn);
    };
  }

  getStatus(): AnalysisQueueStatus {
    return {
      activeIds: Array.from(this.activeIds),
      queuedIds: this.queue.map((l) => l.id),
      completedCount: this.completedCount,
      totalCount: this.totalCount,
      currentNames: Array.from(this.activeIds).map((id) => this.currentNames[id] || id),
    };
  }

  private notify(updatedLead?: BusinessLead) {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status, updatedLead);
    }
  }

  enqueue(leads: BusinessLead[]) {
    const toAdd = leads.filter(
      (l) => !this.activeIds.has(l.id) && !this.queue.some((q) => q.id === l.id)
    );
    if (toAdd.length === 0) return;

    if (this.activeIds.size === 0 && this.queue.length === 0) {
      this.completedCount = 0;
      this.totalCount = 0;
    }

    this.totalCount += toAdd.length;
    for (const lead of toAdd) {
      this.currentNames[lead.id] = lead.displayName;
      this.queue.push(lead);
    }
    this.notify();
    this.processNext();
  }

  private processNext() {
    while (this.activeIds.size < this.concurrency && this.queue.length > 0) {
      const nextLead = this.queue.shift()!;
      this.activeIds.add(nextLead.id);
      this.notify();

      analyzeSingleBusinessLead(nextLead)
        .then((updated) => {
          this.activeIds.delete(nextLead.id);
          this.completedCount += 1;
          this.notify(updated);
          this.processNext();
        })
        .catch(async (err) => {
          this.activeIds.delete(nextLead.id);
          this.completedCount += 1;
          const failedLead: BusinessLead = {
            ...nextLead,
            analysisError: err instanceof Error ? err.message : 'Error durante el análisis',
          };
          await dbRepository.upsertLead(failedLead);
          this.notify(failedLead);
          this.processNext();
        });
    }
  }
}

export const analysisQueue = new ConcurrentAnalysisQueue();
