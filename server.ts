import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.googleMapsUri',
  'places.businessStatus',
  'nextPageToken',
].join(',');

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta la variable de entorno GEMINI_API_KEY en el servidor. Configúrala en el panel de Secretos.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function resolveGoogleCloudKey(req: Request): string {
  const headerKey = req.header('X-Google-Cloud-Key')?.trim();
  if (headerKey) return headerKey;
  const envKey = (
    process.env.GOOGLE_CLOUD_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
  return envKey;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 1. Estado de claves del entorno
  app.get('/api/config/status', (_req: Request, res: Response) => {
    const envCloudKey = (
      process.env.GOOGLE_CLOUD_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();
    res.json({
      hasServerCloudKey: Boolean(envCloudKey),
      mapsJsApiKey: envCloudKey,
    });
  });

  // 2. Probar clave de Google Cloud con Places API (New)
  app.post('/api/places/test-key', async (req: Request, res: Response) => {
    try {
      const apiKey = resolveGoogleCloudKey(req);
      if (!apiKey) {
        res.status(400).json({
          error:
            'No se ha proporcionado ninguna clave de Google Cloud. Introdúcela en la pantalla de Ajustes.',
        });
        return;
      }

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName',
        },
        body: JSON.stringify({
          textQuery: 'ayuntamiento en Madrid, España',
          languageCode: 'es',
          regionCode: 'ES',
          pageSize: 1,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const realMessage =
          data?.error?.message || JSON.stringify(data?.error || data);
        res.status(response.status).json({
          error: `Places API respondió (${response.status}): ${realMessage}`,
        });
        return;
      }

      res.json({
        ok: true,
        message: 'Conexión verificada correctamente con Google Places API (New).',
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Error inesperado al verificar la clave de Google Cloud.',
      });
    }
  });

  // 3. Búsqueda en Google Places API (New) - Text Search (places:searchText)
  app.post('/api/places/search', async (req: Request, res: Response) => {
    try {
      const apiKey = resolveGoogleCloudKey(req);
      if (!apiKey) {
        res.status(400).json({
          error:
            'Falta la clave de Google Cloud para consultar Places API. Ve a Ajustes y guarda tu clave de Google Cloud.',
        });
        return;
      }

      const { textQuery, pageToken } = req.body as {
        textQuery?: string;
        pageToken?: string;
      };

      if (!textQuery || !textQuery.trim()) {
        res.status(400).json({
          error: 'Debes indicar una consulta de búsqueda (nicho y zona).',
        });
        return;
      }

      const payload: Record<string, unknown> = {
        textQuery: textQuery.trim(),
        languageCode: 'es',
        regionCode: 'ES',
        pageSize: 20,
      };

      if (pageToken && pageToken.trim()) {
        payload.pageToken = pageToken.trim();
      }

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const realErrorMsg =
          data?.error?.message ||
          data?.error?.status ||
          JSON.stringify(data);
        res.status(response.status).json({
          error: `Error de Places API (${response.status}): ${realErrorMsg}`,
          details: data?.error,
        });
        return;
      }

      res.json({
        places: data.places || [],
        nextPageToken: data.nextPageToken,
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Error de red al consultar Places API (New).',
      });
    }
  });

  // 4. Auditoría móvil con PageSpeed Insights API v5 (runPagespeed)
  app.get('/api/pagespeed/analyze', async (req: Request, res: Response) => {
    try {
      const rawUrl = String(req.query.url || '').trim();
      if (!rawUrl) {
        res.status(400).json({ error: 'Falta el parámetro URL para PageSpeed Insights.' });
        return;
      }

      const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      const apiKey = resolveGoogleCloudKey(req);

      const params = new URLSearchParams();
      params.append('url', targetUrl);
      params.append('strategy', 'mobile');
      params.append('category', 'performance');
      params.append('category', 'seo');
      params.append('category', 'accessibility');
      params.append('category', 'best-practices');
      params.append('locale', 'es');
      if (apiKey) {
        params.append('key', apiKey);
      }

      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
      const response = await fetch(endpoint);
      const data = await response.json();

      if (!response.ok) {
        const realError =
          data?.error?.message || JSON.stringify(data?.error || data);
        res.status(response.status).json({
          error: `Error de PageSpeed Insights API (${response.status}): ${realError}`,
        });
        return;
      }

      const categories = data?.lighthouseResult?.categories || {};
      const toScore = (val?: number) =>
        typeof val === 'number' ? Math.round(val * 100) : 0;

      const screenshotDataUrl: string | undefined =
        data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;

      res.json({
        pageSpeed: {
          analyzedAt: new Date().toISOString(),
          performance: toScore(categories?.performance?.score),
          seo: toScore(categories?.seo?.score),
          accessibility: toScore(categories?.accessibility?.score),
          bestPractices: toScore(categories?.['best-practices']?.score),
          screenshotDataUrl,
        },
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Error al ejecutar PageSpeed Insights v5.',
      });
    }
  });

  // 5. Análisis profundo de la web con Gemini Flash (Paso 1: urlContext -> Paso 2: JSON Schema)
  app.post('/api/gemini/analyze-web', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      const {
        businessName,
        category,
        address,
        websiteUri,
        rating,
        userRatingCount,
        sellerProfile,
        tone,
      } = req.body;

      if (!websiteUri) {
        res.status(400).json({ error: 'El negocio no tiene URL para analizar.' });
        return;
      }

      const normalizedUrl = websiteUri.startsWith('http')
        ? websiteUri
        : `https://${websiteUri}`;

      // PASO 1: Leer la web del negocio usando la herramienta urlContext
      let rawUrlInspection = '';
      try {
        const step1Prompt = `Analiza en detalle la siguiente página web de un negocio local en España: ${normalizedUrl}
Nombre del negocio: ${businessName} (${category})
Dirección: ${address}

Extrae con precisión:
1. A qué se dedica exactamente el negocio, qué servicios o productos destaca y a qué público atiende.
2. Si usa protocolo seguro HTTPS.
3. Si la estructura y textos parecen adaptados a móvil o si presenta carencias visuales/estructurales.
4. Si tiene botón o enlace directo de WhatsApp (wa.me, api.whatsapp.com o icono/teléfono móvil de WhatsApp).
5. Si tiene sistema de reserva de cita online, calendario de reservas o compra directa.
6. Si tiene formulario de contacto funcional.
7. Señales de web desactualizada (año del copyright en el pie de página, avisos antiguos, blog abandonado, diseño anticuado, enlaces rotos).
8. Todos los correos electrónicos que aparezcan en la página.
9. Todos los enlaces a perfiles de redes sociales (Instagram, Facebook, LinkedIn, TikTok, YouTube, X) que aparezcan en la web.
10. Entre 3 y 5 problemas comerciales o de conversión concretos que le estén haciendo perder clientes.`;

        const step1Response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: step1Prompt,
          config: {
            tools: [{ urlContext: {} }],
          },
        });
        rawUrlInspection = step1Response.text || '';
      } catch (urlErr) {
        rawUrlInspection = `No se pudo acceder directamente a todo el HTML de ${normalizedUrl} (${
          urlErr instanceof Error ? urlErr.message : 'acceso restringido'
        }). Evalúa según la URL ${normalizedUrl} y los datos del negocio.`;
      }

      // PASO 2: Estructurar respuesta JSON garantizada con responseSchema (Análisis + 3 Borradores)
      const step2Prompt = `Eres un consultor experto en venta de servicios digitales (páginas web, agentes de IA por WhatsApp y sistemas de citas online) para negocios locales en España (usa siempre español de España natural: "página web", "coger cita", "móvil", "ordenador", "reseñas").

DATOS DEL NEGOCIO:
- Nombre: ${businessName}
- Actividad / Categoría: ${category}
- Dirección: ${address}
- Web analizada: ${normalizedUrl}
- Valoración en Google Maps: ${rating ?? 'Sin valoración'} (${userRatingCount ?? 0} reseñas)

INFORME EXTRAÍDO DE LA WEB (URL CONTEXT):
${rawUrlInspection}

MI PERFIL DE VENDEDOR:
- Mi nombre: ${sellerProfile?.name || 'Consultor Digital'}
- Qué vendo: ${sellerProfile?.servicesOffered || 'Páginas web, agentes de IA por WhatsApp y sistemas de citas'}
- Mi propuesta de valor: ${sellerProfile?.valueProposition || 'Ayudo a negocios locales a captar más clientes.'}
- Tono solicitado para los borradores: ${tone || 'Cercano y directo'}

Genera el análisis estructurado y los 3 borradores personalizados de primer contacto (guion de llamada de 30 segundos, mensaje de WhatsApp y correo electrónico) mencionando de forma natural los problemas reales detectados en su negocio.`;

      const step2Response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: step2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryTwoSentences: {
                type: Type.STRING,
                description:
                  'Resumen claro de a qué se dedica el negocio en exactamente dos frases en español de España.',
              },
              checklist: {
                type: Type.OBJECT,
                properties: {
                  https: { type: Type.BOOLEAN },
                  httpsDetail: { type: Type.STRING },
                  mobileFriendly: { type: Type.BOOLEAN },
                  mobileFriendlyDetail: { type: Type.STRING },
                  whatsappButton: { type: Type.BOOLEAN },
                  whatsappDetail: { type: Type.STRING },
                  onlineBooking: { type: Type.BOOLEAN },
                  onlineBookingDetail: { type: Type.STRING },
                  contactForm: { type: Type.BOOLEAN },
                  contactFormDetail: { type: Type.STRING },
                  outdatedSignals: {
                    type: Type.BOOLEAN,
                    description:
                      'true si la web presenta señales de estar desactualizada (ej. copyright antiguo, diseño obsoleto), false si está al día.',
                  },
                  outdatedDetail: { type: Type.STRING },
                },
                required: [
                  'https',
                  'httpsDetail',
                  'mobileFriendly',
                  'mobileFriendlyDetail',
                  'whatsappButton',
                  'whatsappDetail',
                  'onlineBooking',
                  'onlineBookingDetail',
                  'contactForm',
                  'contactFormDetail',
                  'outdatedSignals',
                  'outdatedDetail',
                ],
              },
              emails: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Correos electrónicos encontrados en la web.',
              },
              socialLinks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Enlaces o nombres de redes sociales encontrados en la web.',
              },
              plainLanguageIssues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Entre 3 y 5 problemas concretos de la web explicados en lenguaje llano, sin tecnicismos, orientados al dueño del negocio.',
              },
              recommendedService: {
                type: Type.OBJECT,
                properties: {
                  service: {
                    type: Type.STRING,
                    description:
                      'Uno de: "Página web nueva", "Agente de IA por WhatsApp", "Sistema de citas online" o "Pack Web + WhatsApp IA".',
                  },
                  why: {
                    type: Type.STRING,
                    description:
                      'Explicación convincente de por qué este servicio concreto es el más rentable para ofrecerle.',
                  },
                },
                required: ['service', 'why'],
              },
              drafts: {
                type: Type.OBJECT,
                properties: {
                  callScript30s: {
                    type: Type.STRING,
                    description:
                      'Guion de llamada telefónica de 30 segundos, natural y conversacional en español de España.',
                  },
                  whatsappMessage: {
                    type: Type.STRING,
                    description:
                      'Mensaje breve de WhatsApp para primer contacto personal.',
                  },
                  emailSubject: {
                    type: Type.STRING,
                    description: 'Asunto del correo electrónico personalizado.',
                  },
                  emailBody: {
                    type: Type.STRING,
                    description: 'Cuerpo completo del correo electrónico personalizado.',
                  },
                },
                required: [
                  'callScript30s',
                  'whatsappMessage',
                  'emailSubject',
                  'emailBody',
                ],
              },
            },
            required: [
              'summaryTwoSentences',
              'checklist',
              'emails',
              'socialLinks',
              'plainLanguageIssues',
              'recommendedService',
              'drafts',
            ],
          },
        },
      });

      const parsed = JSON.parse((step2Response.text || '{}').trim());
      const nowIso = new Date().toISOString();

      res.json({
        analysis: {
          analyzedAt: nowIso,
          summaryTwoSentences: parsed.summaryTwoSentences,
          checklist: parsed.checklist,
          emails: parsed.emails || [],
          socialLinks: parsed.socialLinks || [],
          plainLanguageIssues: (parsed.plainLanguageIssues || []).slice(0, 5),
          recommendedService: parsed.recommendedService,
        },
        drafts: {
          generatedAt: nowIso,
          tone: tone || 'Cercano y directo',
          callScript30s: parsed.drafts?.callScript30s || '',
          whatsappMessage: parsed.drafts?.whatsappMessage || '',
          emailSubject: parsed.drafts?.emailSubject || '',
          emailBody: parsed.drafts?.emailBody || '',
        },
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Error en Gemini al analizar la página web.',
      });
    }
  });

  // 6. Generación / Regeneración de borradores (y diagnóstico para negocios sin web propia)
  app.post('/api/gemini/drafts', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      const {
        businessName,
        category,
        address,
        websiteUri,
        webClassification,
        detectedPlatform,
        rating,
        userRatingCount,
        existingAnalysis,
        pageSpeed,
        sellerProfile,
        tone,
      } = req.body;

      const prompt = `Eres un experto en prospección comercial B2B en España que vende servicios digitales a comercios locales (usa español de España natural: "página web", "coger cita", "WhatsApp", "clientes de la zona").

DATOS DEL NEGOCIO:
- Nombre: ${businessName}
- Actividad: ${category}
- Dirección: ${address}
- Situación web: ${
        webClassification === 'no_website'
          ? 'NO TIENE PÁGINA WEB en su ficha de Google Maps'
          : webClassification === 'social_or_directory'
          ? `NO TIENE WEB PROPIA (solo enlaza a ${detectedPlatform || 'red social/directorio'}: ${websiteUri})`
          : `Tiene web propia: ${websiteUri}`
      }
- Valoración en Google Maps: ${rating ?? 'N/A'} (${userRatingCount ?? 0} reseñas)
${
  pageSpeed
    ? `- Notas PageSpeed Móvil: Rendimiento ${pageSpeed.performance}/100, SEO ${pageSpeed.seo}/100, Accesibilidad ${pageSpeed.accessibility}/100, Buenas prácticas ${pageSpeed.bestPractices}/100`
    : ''
}
${
  existingAnalysis
    ? `- Problemas ya detectados: ${(existingAnalysis.plainLanguageIssues || []).join(' | ')}
- Servicio recomendado: ${existingAnalysis.recommendedService?.service} (${existingAnalysis.recommendedService?.why})`
    : ''
}

MI PERFIL DE VENDEDOR:
- Nombre: ${sellerProfile?.name || 'Consultor Digital'}
- Qué vendo: ${sellerProfile?.servicesOffered || 'Páginas web, agentes de IA por WhatsApp y sistemas de citas'}
- Mi propuesta: ${sellerProfile?.valueProposition || 'Ayudo a negocios locales a captar más clientes.'}
- Tono elegido: ${tone || 'Cercano y directo'}

Genera los tres borradores personalizados de primer contacto (guion de llamada de 30 segundos, mensaje de WhatsApp y correo electrónico con asunto) y el resumen/diagnóstico del negocio.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryTwoSentences: {
                type: Type.STRING,
                description:
                  'Resumen en dos frases de a qué se dedica el negocio y su situación digital actual.',
              },
              plainLanguageIssues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Entre 3 y 5 problemas o pérdidas de oportunidad explicados en lenguaje llano.',
              },
              recommendedService: {
                type: Type.OBJECT,
                properties: {
                  service: {
                    type: Type.STRING,
                    description:
                      'Uno de: "Página web nueva", "Agente de IA por WhatsApp", "Sistema de citas online" o "Pack Web + WhatsApp IA".',
                  },
                  why: { type: Type.STRING },
                },
                required: ['service', 'why'],
              },
              drafts: {
                type: Type.OBJECT,
                properties: {
                  callScript30s: { type: Type.STRING },
                  whatsappMessage: { type: Type.STRING },
                  emailSubject: { type: Type.STRING },
                  emailBody: { type: Type.STRING },
                },
                required: [
                  'callScript30s',
                  'whatsappMessage',
                  'emailSubject',
                  'emailBody',
                ],
              },
            },
            required: [
              'summaryTwoSentences',
              'plainLanguageIssues',
              'recommendedService',
              'drafts',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const nowIso = new Date().toISOString();

      const fallbackChecklist = {
        https: false,
        httpsDetail:
          webClassification === 'no_website'
            ? 'No dispone de página web.'
            : `Enlaza únicamente a ${detectedPlatform || 'perfil externo'}.`,
        mobileFriendly: false,
        mobileFriendlyDetail: 'Carece de web propia adaptada a móvil.',
        whatsappButton: false,
        whatsappDetail: 'No tiene embudo web propio hacia WhatsApp.',
        onlineBooking: false,
        onlineBookingDetail: 'No dispone de sistema propio de reserva online.',
        contactForm: false,
        contactFormDetail: 'Sin formulario de captación propio.',
        outdatedSignals: true,
        outdatedDetail:
          webClassification === 'no_website'
            ? 'Presencia digital inexistente fuera de la ficha de Google Maps.'
            : `Depende de ${detectedPlatform || 'un directorio externo'} sin dominio propio.`,
      };

      res.json({
        analysis: existingAnalysis || {
          analyzedAt: nowIso,
          summaryTwoSentences: parsed.summaryTwoSentences,
          checklist: fallbackChecklist,
          emails: [],
          socialLinks: websiteUri ? [websiteUri] : [],
          plainLanguageIssues: (parsed.plainLanguageIssues || []).slice(0, 5),
          recommendedService: parsed.recommendedService,
        },
        drafts: {
          generatedAt: nowIso,
          tone: tone || 'Cercano y directo',
          callScript30s: parsed.drafts?.callScript30s || '',
          whatsappMessage: parsed.drafts?.whatsappMessage || '',
          emailSubject: parsed.drafts?.emailSubject || '',
          emailBody: parsed.drafts?.emailBody || '',
        },
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Error al generar los borradores con Gemini.',
      });
    }
  });

  // 7. Radar de Nichos con Gemini Flash (responseSchema JSON)
  app.post('/api/gemini/niche-radar', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      const { zone, categories, sellerProfile } = req.body;

      if (!zone || !Array.isArray(categories) || categories.length === 0) {
        res.status(400).json({
          error: 'Se requiere una zona y al menos una categoría con datos para analizar.',
        });
        return;
      }

      const prompt = `Eres un estratega comercial experto en venta de servicios digitales (páginas web, agentes de IA por WhatsApp y sistemas de citas online) a negocios locales en España.

Has escaneado la zona "${zone}" con Google Places API y has obtenido estos datos reales por cada nicho:
${JSON.stringify(categories, null, 2)}

PERFIL DEL VENDEDOR:
- Servicios que vende: ${sellerProfile?.servicesOffered || 'Páginas web, agentes de IA por WhatsApp y sistemas de citas online'}
- Propuesta de valor: ${sellerProfile?.valueProposition || ''}

Ordena TODAS las categorías analizadas de mayor a menor oportunidad comercial real (valorando porcentaje sin web propia, volumen de negocios activos, media de reseñas y ticket medio del sector).
Destaca en un resumen ejecutivo las 3 mejores categorías, explica por qué hay tanta oportunidad en "${zone}" y especifica qué servicio exacto vender en cada categoría y con qué argumento.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topThreeSummary: {
                type: Type.STRING,
                description:
                  'Resumen estratégico en español de España explicando cuáles son los 3 mejores nichos en esta zona y por qué empezar por ellos.',
              },
              rankedRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    niche: { type: Type.STRING },
                    rank: { type: Type.INTEGER },
                    opportunityLevel: {
                      type: Type.STRING,
                      description: 'Uno de: "Alta", "Media" o "Baja".',
                    },
                    recommendedService: {
                      type: Type.STRING,
                      description:
                        'Qué servicio vender principalmente en este nicho (ej. "Sistema de citas + Agente WhatsApp", "Página web nueva de captación", etc.).',
                    },
                    whyOpportunity: {
                      type: Type.STRING,
                      description:
                        'Por qué este nicho en esta zona concreta tiene esa oportunidad según los números encontrados.',
                    },
                    salesAngle: {
                      type: Type.STRING,
                      description:
                        'Gancho comercial concreto para abordar a los dueños de este nicho.',
                    },
                  },
                  required: [
                    'niche',
                    'rank',
                    'opportunityLevel',
                    'recommendedService',
                    'whyOpportunity',
                    'salesAngle',
                  ],
                },
              },
            },
            required: ['topThreeSummary', 'rankedRecommendations'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Error en Gemini al clasificar el Radar de nichos.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Radar de Clientes ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
