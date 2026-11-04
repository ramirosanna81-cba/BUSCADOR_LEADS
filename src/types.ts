export type WebClassification = 'own_website' | 'social_or_directory' | 'no_website';

export type LeadStatus =
  | 'Nuevo'
  | 'Analizado'
  | 'Contactado'
  | 'Respondió'
  | 'Reunión'
  | 'Cliente'
  | 'Descartado';

export const LEAD_STATUSES: LeadStatus[] = [
  'Nuevo',
  'Analizado',
  'Contactado',
  'Respondió',
  'Reunión',
  'Cliente',
  'Descartado',
];

export type ToneOption =
  | 'Cercano y directo'
  | 'Consultivo profesional'
  | 'Enfocado en pérdida de clientes'
  | 'Breve y al grano';

export const TONE_OPTIONS: ToneOption[] = [
  'Cercano y directo',
  'Consultivo profesional',
  'Enfocado en pérdida de clientes',
  'Breve y al grano',
];

export const SUGGESTED_NICHES: string[] = [
  'talleres mecánicos',
  'clínicas dentales',
  'fisioterapeutas',
  'peluquerías',
  'centros de estética',
  'restaurantes',
  'gimnasios',
  'academias',
  'inmobiliarias',
  'reformas',
  'veterinarios',
  'autoescuelas',
  'ópticas',
  'gestorías',
];

export interface ScoreBreakdownItem {
  label: string;
  points: number;
  reason: string;
}

export interface OpportunityScore {
  total: number; // 0 to 100
  isProvisional: boolean;
  breakdown: ScoreBreakdownItem[];
}

export interface PageSpeedMetrics {
  analyzedAt: string;
  performance: number; // 0 to 100
  seo: number; // 0 to 100
  accessibility: number; // 0 to 100
  bestPractices: number; // 0 to 100
  screenshotDataUrl?: string; // base64 data:image/jpeg;base64,...
}

export interface WebChecklist {
  https: boolean;
  httpsDetail: string;
  mobileFriendly: boolean;
  mobileFriendlyDetail: string;
  whatsappButton: boolean;
  whatsappDetail: string;
  onlineBooking: boolean;
  onlineBookingDetail: string;
  contactForm: boolean;
  contactFormDetail: string;
  outdatedSignals: boolean; // true = se detectan señales de desactualización
  outdatedDetail: string;
}

export interface GeminiWebAnalysis {
  analyzedAt: string;
  summaryTwoSentences: string;
  checklist: WebChecklist;
  emails: string[];
  socialLinks: string[];
  plainLanguageIssues: string[]; // 3 to 5 issues in plain Spanish
  recommendedService: {
    service: 'Página web nueva' | 'Agente de IA por WhatsApp' | 'Sistema de citas online' | 'Pack Web + WhatsApp IA';
    why: string;
  };
}

export interface OutreachDrafts {
  generatedAt: string;
  tone: ToneOption;
  callScript30s: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
}

export interface PlaceRaw {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text: string; languageCode?: string };
  types?: string[];
  googleMapsUri?: string;
  businessStatus?: string;
}

export interface BusinessLead {
  id: string; // place.id
  displayName: string;
  primaryTypeDisplayName: string;
  types: string[];
  formattedAddress: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  webClassification: WebClassification;
  detectedPlatform?: string; // ej. "Instagram", "Facebook", "Linktree", "Directorio"
  rating?: number;
  userRatingCount: number;
  googleMapsUri?: string;
  businessStatus: string;

  // Contexto de búsqueda
  zoneTag: string;
  nicheTag: string;

  // Puntuación de oportunidad (0 a 100)
  opportunityScore: OpportunityScore;

  // Análisis (opcional hasta que se analice)
  pageSpeed?: PageSpeedMetrics;
  geminiAnalysis?: GeminiWebAnalysis;
  outreachDrafts?: OutreachDrafts;
  analysisError?: string;

  // CRM / Seguimiento
  isSavedLead: boolean;
  status: LeadStatus;
  notes: string;
  nextActionDate: string; // YYYY-MM-DD or ''
  savedAt?: string;
  updatedAt: string;
}

export interface SearchCacheEntry {
  cacheKey: string;
  zone: string;
  niche: string;
  places: BusinessLead[];
  nextPageToken?: string;
  pagesLoaded: number;
  createdAt: string;
}

export interface NicheCategoryMetrics {
  niche: string;
  totalBusinesses: number;
  withoutOwnWebCount: number;
  withoutOwnWebPercent: number;
  avgRating: number;
  avgReviews: number;
  fromCache: boolean;
}

export interface NicheRecommendationItem {
  niche: string;
  rank: number;
  opportunityLevel: 'Alta' | 'Media' | 'Baja';
  recommendedService: string;
  whyOpportunity: string;
  salesAngle: string;
}

export interface NicheRadarReport {
  id: string; // normalized zone
  zone: string;
  analyzedAt: string;
  categories: NicheCategoryMetrics[];
  topThreeSummary: string;
  rankedRecommendations: NicheRecommendationItem[];
}

export interface SellerProfile {
  name: string;
  servicesOffered: string;
  valueProposition: string;
  defaultTone: ToneOption;
}

export interface AppSettings {
  googleCloudApiKey: string; // guardada solo en el navegador si el usuario la introduce
  sellerProfile: SellerProfile;
  monthlyPlacesLimit: number;
  placesUsageByMonth: Record<string, number>; // 'YYYY-MM' -> llamadas realizadas
}

export interface AnalysisQueueStatus {
  activeIds: string[];
  queuedIds: string[];
  completedCount: number;
  totalCount: number;
  currentNames: string[];
}
