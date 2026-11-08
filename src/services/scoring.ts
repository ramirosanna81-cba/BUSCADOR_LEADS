import {
  BusinessLead,
  GeminiWebAnalysis,
  OpportunityScore,
  PageSpeedMetrics,
  PlaceRaw,
  ScoreBreakdownItem,
  WebClassification,
} from '../types';

const SOCIAL_AND_DIRECTORY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(^|\.)facebook\.com/i, label: 'Facebook' },
  { pattern: /(^|\.)fb\.com/i, label: 'Facebook' },
  { pattern: /(^|\.)instagram\.com/i, label: 'Instagram' },
  { pattern: /(^|\.)linktr\.ee/i, label: 'Linktree' },
  { pattern: /(^|\.)beacons\.ai/i, label: 'Beacons' },
  { pattern: /(^|\.)tiktok\.com/i, label: 'TikTok' },
  { pattern: /(^|\.)twitter\.com|(^|\.)x\.com/i, label: 'X / Twitter' },
  { pattern: /(^|\.)linkedin\.com/i, label: 'LinkedIn' },
  { pattern: /(^|\.)paginasamarillas\.es/i, label: 'Páginas Amarillas' },
  { pattern: /(^|\.)doctoralia\.es/i, label: 'Doctoralia' },
  { pattern: /(^|\.)topdoctors\.es/i, label: 'TopDoctors' },
  { pattern: /(^|\.)treatwell\.es/i, label: 'Treatwell' },
  { pattern: /(^|\.)booksy\.com/i, label: 'Booksy' },
  { pattern: /(^|\.)tripadvisor\./i, label: 'TripAdvisor' },
  { pattern: /(^|\.)thefork\.es|(^|\.)eltenedor\.es/i, label: 'TheFork' },
  { pattern: /(^|\.)yelp\./i, label: 'Yelp' },
  { pattern: /(^|\.)habitissimo\.es/i, label: 'Habitissimo' },
  { pattern: /(^|\.)cronoshare\.com/i, label: 'Cronoshare' },
  { pattern: /(^|\.)milanuncios\.com/i, label: 'Milanuncios' },
  { pattern: /(^|\.)idealista\.com/i, label: 'Idealista' },
  { pattern: /(^|\.)fotocasa\.es/i, label: 'Fotocasa' },
  { pattern: /(^|\.)infoempresa\.com|(^|\.)einforma\.com|(^|\.)empresia\.es/i, label: 'Directorio Empresarial' },
  { pattern: /(^|\.)google\.com\/maps|(^|\.)goo\.gl\/maps/i, label: 'Google Maps' },
  { pattern: /(^|\.)wa\.me|(^|\.)api\.whatsapp\.com/i, label: 'Enlace WhatsApp' },
];

export function classifyWebsiteUri(websiteUri?: string): {
  classification: WebClassification;
  detectedPlatform?: string;
} {
  if (!websiteUri || !websiteUri.trim()) {
    return { classification: 'no_website' };
  }

  try {
    const parsed = new URL(websiteUri.startsWith('http') ? websiteUri : `https://${websiteUri}`);
    const hostAndPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();

    for (const item of SOCIAL_AND_DIRECTORY_PATTERNS) {
      if (item.pattern.test(hostAndPath)) {
        return {
          classification: 'social_or_directory',
          detectedPlatform: item.label,
        };
      }
    }

    return { classification: 'own_website' };
  } catch {
    return { classification: 'own_website' };
  }
}

export function calculateOpportunityScore(
  lead: {
    webClassification: WebClassification;
    detectedPlatform?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount: number;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    businessStatus?: string;
  },
  pageSpeed?: PageSpeedMetrics,
  geminiAnalysis?: GeminiWebAnalysis
): OpportunityScore {
  const breakdown: ScoreBreakdownItem[] = [];
  const hasAnalysis = Boolean(pageSpeed || geminiAnalysis);

  // 1. Estado del negocio
  if (lead.businessStatus && lead.businessStatus !== 'OPERATIONAL') {
    breakdown.push({
      label: 'Negocio cerrado o inactivo',
      points: -50,
      reason: 'El negocio figura como cerrado temporal o permanentemente en Google Maps.',
    });
  }

  // 2. Situación de la página web
  if (lead.webClassification === 'no_website') {
    breakdown.push({
      label: 'Sin página web',
      points: 48,
      reason: 'No tiene ninguna web vinculada en su perfil de Google Maps: máxima necesidad digital.',
    });
  } else if (lead.webClassification === 'social_or_directory') {
    breakdown.push({
      label: `Sin web propia (${lead.detectedPlatform || 'Red social / Directorio'})`,
      points: 44,
      reason: `Solo enlaza a ${lead.detectedPlatform || 'un perfil externo'} en lugar de una web propia de captación.`,
    });
  } else {
    // Tiene web propia
    if (!hasAnalysis) {
      breakdown.push({
        label: 'Con web propia (pendiente de auditar)',
        points: 18,
        reason: 'Puntuación provisional hasta analizar la velocidad móvil y el contenido real de su web.',
      });
      if (lead.websiteUri && lead.websiteUri.startsWith('http://')) {
        breakdown.push({
          label: 'Enlace sin HTTPS (http://)',
          points: 10,
          reason: 'La URL registrada en Maps no utiliza protocolo seguro HTTPS.',
        });
      }
    } else {
      // Con análisis de PageSpeed y/o Gemini
      if (pageSpeed) {
        if (pageSpeed.performance < 50) {
          breakdown.push({
            label: `PageSpeed Móvil bajo (${pageSpeed.performance}/100)`,
            points: 24,
            reason: 'La web carga lenta en móvil y penaliza la conversión de visitas en clientes.',
          });
        } else if (pageSpeed.performance < 75) {
          breakdown.push({
            label: `PageSpeed Móvil mejorable (${pageSpeed.performance}/100)`,
            points: 14,
            reason: 'El rendimiento en móvil tiene margen claro de optimización.',
          });
        } else if (pageSpeed.performance >= 90) {
          breakdown.push({
            label: `PageSpeed Móvil excelente (${pageSpeed.performance}/100)`,
            points: -12,
            reason: 'La web ya está bien optimizada en velocidad móvil.',
          });
        }

        if (pageSpeed.seo < 75) {
          breakdown.push({
            label: `SEO técnico deficiente (${pageSpeed.seo}/100)`,
            points: 8,
            reason: 'Pierde posicionamiento local en buscadores por carencias básicas de SEO.',
          });
        }
      }

      if (geminiAnalysis) {
        const c = geminiAnalysis.checklist;
        if (!c.whatsappButton) {
          breakdown.push({
            label: 'Sin botón de WhatsApp',
            points: 14,
            reason: 'No ofrece contacto inmediato por WhatsApp (oportunidad directa de Agente IA o widget).',
          });
        }
        if (!c.onlineBooking) {
          breakdown.push({
            label: 'Sin sistema para sacar turnos o reservas online',
            points: 12,
            reason: 'El cliente no puede sacar turno ni ver disponibilidad desde la web.',
          });
        }
        if (!c.mobileFriendly || !c.https || c.outdatedSignals) {
          breakdown.push({
            label: 'Web desactualizada o mal adaptada',
            points: 12,
            reason: c.outdatedSignals
              ? c.outdatedDetail || 'Presenta señales claras de antigüedad o abandono.'
              : 'Problemas de visualización móvil o ausencia de certificado HTTPS.',
          });
        }
        if (
          c.whatsappButton &&
          c.onlineBooking &&
          c.mobileFriendly &&
          c.https &&
          !c.outdatedSignals &&
          (pageSpeed ? pageSpeed.performance >= 80 : true)
        ) {
          breakdown.push({
            label: 'Web completa y bien equipada',
            points: -18,
            reason: 'Ya cuenta con buena web, WhatsApp y sistema de contacto moderno.',
          });
        }
      }
    }
  }

  // 3. Actividad comercial del negocio (reseñas)
  const reviews = lead.userRatingCount || 0;
  if (reviews >= 40) {
    breakdown.push({
      label: `Negocio consolidado (${reviews} reseñas)`,
      points: 20,
      reason: 'Alta tracción de clientes locales y capacidad económica para invertir.',
    });
  } else if (reviews >= 12) {
    breakdown.push({
      label: `Negocio activo (${reviews} reseñas)`,
      points: 15,
      reason: 'Flujo constante de clientela demostrado en Google Maps.',
    });
  } else if (reviews >= 3) {
    breakdown.push({
      label: `Actividad moderada (${reviews} reseñas)`,
      points: 6,
      reason: 'Negocio operativo pero con poca presencia de reseñas.',
    });
  } else {
    breakdown.push({
      label: `Muy poca actividad (${reviews} reseñas)`,
      points: -10,
      reason: 'Apenas tiene reseñas en Google Maps; menor probabilidad de presupuesto.',
    });
  }

  // 4. Valoración media
  if (typeof lead.rating === 'number') {
    if (lead.rating >= 4.2) {
      breakdown.push({
        label: `Buena reputación (${lead.rating.toFixed(1)} ★)`,
        points: 10,
        reason: 'Clientes satisfechos con el servicio; buen candidato para escalar captación.',
      });
    } else if (lead.rating >= 3.5) {
      breakdown.push({
        label: `Valoración media (${lead.rating.toFixed(1)} ★)`,
        points: 5,
        reason: 'Valoración aceptable en su zona.',
      });
    } else {
      breakdown.push({
        label: `Valoración baja (${lead.rating.toFixed(1)} ★)`,
        points: -5,
        reason: 'Puntuación de clientes baja.',
      });
    }
  }

  // 5. Teléfono de contacto directo
  const hasPhone = Boolean(lead.nationalPhoneNumber || lead.internationalPhoneNumber);
  if (hasPhone) {
    breakdown.push({
      label: 'Teléfono directo disponible',
      points: 10,
      reason: 'Permite contacto inmediato por llamada o WhatsApp.',
    });
  } else {
    breakdown.push({
      label: 'Sin teléfono visible en Maps',
      points: -15,
      reason: 'Dificulta el contacto directo inicial.',
    });
  }

  const rawTotal = breakdown.reduce((acc, item) => acc + item.points, 0);
  const total = Math.max(0, Math.min(100, rawTotal));

  return {
    total,
    isProvisional: lead.webClassification === 'own_website' && !hasAnalysis,
    breakdown,
  };
}

export function mapPlaceRawToBusinessLead(
  raw: PlaceRaw,
  zoneTag: string,
  nicheTag: string,
  existingLead?: BusinessLead
): BusinessLead {
  const webCheck = classifyWebsiteUri(raw.websiteUri);

  const baseLead = {
    id: raw.id,
    displayName: raw.displayName?.text || 'Negocio sin nombre',
    primaryTypeDisplayName: raw.primaryTypeDisplayName?.text || nicheTag || 'Comercio local',
    types: raw.types || [],
    formattedAddress: raw.formattedAddress || 'Dirección no disponible',
    location: raw.location,
    nationalPhoneNumber: raw.nationalPhoneNumber,
    internationalPhoneNumber: raw.internationalPhoneNumber,
    websiteUri: raw.websiteUri,
    webClassification: webCheck.classification,
    detectedPlatform: webCheck.detectedPlatform,
    rating: raw.rating,
    userRatingCount: raw.userRatingCount ?? 0,
    googleMapsUri: raw.googleMapsUri,
    businessStatus: raw.businessStatus || 'OPERATIONAL',
    zoneTag: existingLead?.zoneTag || zoneTag,
    nicheTag: existingLead?.nicheTag || nicheTag,
    pageSpeed: existingLead?.pageSpeed,
    geminiAnalysis: existingLead?.geminiAnalysis,
    outreachDrafts: existingLead?.outreachDrafts,
    isSavedLead: existingLead?.isSavedLead ?? false,
    status: existingLead?.status ?? 'Nuevo',
    notes: existingLead?.notes ?? '',
    nextActionDate: existingLead?.nextActionDate ?? '',
    savedAt: existingLead?.savedAt,
    updatedAt: existingLead?.updatedAt || new Date().toISOString(),
  };

  const opportunityScore = calculateOpportunityScore(
    baseLead,
    baseLead.pageSpeed,
    baseLead.geminiAnalysis
  );

  return {
    ...baseLead,
    opportunityScore,
  };
}
