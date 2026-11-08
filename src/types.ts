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

export interface NicheGroup {
  groupName: string;
  badgeColor: string;
  items: string[];
}

export const NICHE_GROUPS: NicheGroup[] = [
  {
    groupName: 'Canchas y Deportes',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    items: [
      'canchas de fútbol 5',
      'canchas de fútbol 7',
      'canchas de fútbol 9',
      'canchas de fútbol 11',
      'complejos de fútbol y canchas',
      'canchas de pádel',
      'gimnasios y centros de fitness',
    ],
  },
  {
    groupName: 'Comercios de Cercanía y Alimentos',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    items: [
      'carnicerías',
      'verdulerías y fruterías',
      'kioscos y drugstores',
      'supermercados y minimercados',
      'panaderías y confiterías',
      'pollerías y granjas',
      'dietéticas y herboristerías',
      'negocios y almacenes de barrio',
    ],
  },
  {
    groupName: 'Barberías y Estética',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    items: [
      'barberías',
      'peluquerías',
      'centros de estética',
      'salones de belleza y uñas',
    ],
  },
  {
    groupName: 'Gastronomía y Delivery',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    items: [
      'lomiterías',
      'pizzerías',
      'rotiserías y casas de comidas',
      'hamburgueserías',
      'heladerías',
      'restaurantes y bodegones',
    ],
  },
  {
    groupName: 'Salud y Bienestar',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    items: [
      'veterinarias',
      'consultorios odontológicos',
      'consultorios médicos',
      'kinesiólogos y fisioterapia',
      'ópticas',
    ],
  },
  {
    groupName: 'Oficios y Hogar',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    items: [
      'cerrajerías',
      'electricistas',
      'plomeros y gasistas',
      'reparación de aire acondicionado',
      'albañilería y refacciones',
      'pintores de obra',
    ],
  },
  {
    groupName: 'Automotor',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    items: [
      'talleres mecánicos',
      'lavaderos de autos',
      'gomerías',
      'talleres de chapa y pintura',
      'lubricentros',
    ],
  },
];

export const SUGGESTED_NICHES: string[] = NICHE_GROUPS.flatMap((g) => g.items);

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
    service:
      | 'Página web nueva'
      | 'Agente de IA por WhatsApp'
      | 'Sistema de turnos online'
      | 'Turnos con seña online'
      | 'Catálogo y pedidos por WhatsApp'
      | 'Sistema de citas online'
      | 'Pack Web + WhatsApp IA';
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
