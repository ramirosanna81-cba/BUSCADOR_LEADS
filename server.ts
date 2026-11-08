import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

/**
 * Ejecuta generateContent con reintentos automáticos y conmutación ágil de modelos
 * (gemini-3.5-flash -> gemini-3.1-flash-lite -> gemini-3.8-flash) para
 * garantizar disponibilidad absoluta frente a picos de demanda (errores 503 UNAVAILABLE o 429).
 */
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }
): Promise<any> {
  const requestedModel = params.primaryModel || 'gemini-3.5-flash';
  // Orden de preferencia: gemini-3.5-flash (alta disponibilidad comprobada), gemini-3.1-flash-lite, gemini-3.8-flash
  const candidateModels = Array.from(
    new Set([requestedModel, 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'])
  );
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || '');
        const isUnavailableOrRateLimit =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('DEADLINE_EXCEEDED');

        if (isUnavailableOrRateLimit && attempt < 2) {
          // Breve pausa antes del segundo intento
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }

        // Si este modelo está saturado o da error de demanda, saltar inmediatamente al siguiente candidato
        if (isUnavailableOrRateLimit) {
          console.warn(`[Gemini] Modelo ${model} saturado (503/429). Conmutando al siguiente modelo disponible...`);
          break;
        }

        // Si es otro error fatal distinto a saturación, propagarlo
        throw err;
      }
    }
  }

  throw lastError || new Error('El servicio de IA está experimentando alta demanda momentánea. Por favor, reintenta en unos instantes.');
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

/**
 * Realiza una petición HTTP y parsea la respuesta de forma segura,
 * evitando errores "Unexpected token '<'" si un servidor externo devuelve HTML.
 */
async function safeFetchJson(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  const response = await fetch(url, options);
  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    const snippet = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    data = {
      error: {
        message: snippet || `Respuesta no válida (HTTP ${response.status})`,
      },
    };
  }
  return {
    ok: response.ok,
    status: response.status,
    data,
    rawText,
  };
}

/**
 * Inspección rápida del HTML de la web del negocio (con timeout de 7 segundos)
 * para extraer señales reales (HTTPS, viewport móvil, WhatsApp, formularios,
 * enlaces de reserva, correos, redes sociales, año de copyright y textos principales).
 */
async function inspectWebsiteHtmlFast(targetUrl: string): Promise<string> {
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
    });

    const finalUrl = response.url || targetUrl;
    const isHttps = finalUrl.startsWith('https://');
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
      );
    const metaDescription = descMatch ? descMatch[1].trim() : '';

    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hasWhatsapp =
      /wa\.me\/|api\.whatsapp\.com|whatsapp/i.test(html);
    const hasBooking =
      /calendly|booksy|treatwell|doctoralia|thefork|reservar|reserva[-\s]?online|pedir[-\s]?cita|cita[-\s]?previa|cita[-\s]?online/i.test(
        html
      );
    const hasForm = /<form[\s>]/i.test(html);

    // Extraer correos electrónicos visibles
    const emailMatches =
      html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const filteredEmails = Array.from(
      new Set(
        emailMatches
          .map((e) => e.toLowerCase())
          .filter(
            (e) =>
              !e.endsWith('.png') &&
              !e.endsWith('.jpg') &&
              !e.endsWith('.webp') &&
              !e.endsWith('.svg') &&
              !e.endsWith('.js') &&
              !e.endsWith('.css') &&
              !e.includes('sentry') &&
              !e.includes('wixpress') &&
              !e.includes('example.com')
          )
      )
    ).slice(0, 6);

    // Extraer enlaces a redes sociales
    const socialRegex =
      /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com)\/[a-zA-Z0-9_./-]+/gi;
    const socialMatches = html.match(socialRegex) || [];
    const uniqueSocials = Array.from(new Set(socialMatches)).slice(0, 8);

    // Detectar año de copyright
    const copyrightMatches =
      html.match(/(?:©|&copy;|copyright)[^0-9]{0,25}(20[0-2][0-9])/gi) || [];

    // Extraer texto limpio de encabezados y párrafos
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2500);

    return `INSPECCIÓN DIRECTA DEL HTML (${finalUrl}):
- Protocolo HTTPS activo: ${isHttps ? 'SÍ' : 'NO'}
- Etiqueta meta viewport móvil: ${hasViewport ? 'SÍ' : 'NO'}
- Título de la página: ${title || 'No detectado'}
- Meta descripción: ${metaDescription || 'No detectada'}
- Señales de botón/enlace WhatsApp en código: ${hasWhatsapp ? 'SÍ' : 'NO'}
- Señales de cita previa / reserva online en código: ${hasBooking ? 'SÍ' : 'NO'}
- Formulario (<form>) detectado en la página: ${hasForm ? 'SÍ' : 'NO'}
- Correos electrónicos encontrados: ${
      filteredEmails.length > 0 ? filteredEmails.join(', ') : 'Ninguno'
    }
- Redes sociales encontradas: ${
      uniqueSocials.length > 0 ? uniqueSocials.join(', ') : 'Ninguna'
    }
- Menciones de copyright detectadas: ${
      copyrightMatches.length > 0 ? copyrightMatches.join(' | ') : 'No detectadas'
    }
- Extracto de texto visible en la web: ${cleanText}`;
  } catch (err) {
    return `No se pudo descargar el HTML directo en menos de 7s (${
      err instanceof Error ? err.message : 'timeout o bloqueo'
    }).`;
  }
}

function cleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
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

      const { ok, status, data } = await safeFetchJson(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName',
          },
          body: JSON.stringify({
            textQuery: 'municipalidad en Córdoba, Argentina',
            languageCode: 'es',
            regionCode: 'AR',
            pageSize: 1,
          }),
        }
      );

      if (!ok) {
        const realMessage =
          data?.error?.message || JSON.stringify(data?.error || data);
        res.status(status).json({
          error: `Places API respondió (${status}): ${realMessage}`,
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

      const { ok, status, data } = await safeFetchJson(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACES_FIELD_MASK,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!ok) {
        const realErrorMsg =
          data?.error?.message ||
          data?.error?.status ||
          JSON.stringify(data);
        res.status(status).json({
          error: `Error de Places API (${status}): ${realErrorMsg}`,
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
        res
          .status(400)
          .json({ error: 'Falta el parámetro URL para PageSpeed Insights.' });
        return;
      }

      const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      const apiKey = resolveGoogleCloudKey(req);

      const buildParams = (includeKey: boolean) => {
        const params = new URLSearchParams();
        params.append('url', targetUrl);
        params.append('strategy', 'mobile');
        params.append('category', 'performance');
        params.append('category', 'seo');
        params.append('category', 'accessibility');
        params.append('category', 'best-practices');
        params.append('locale', 'es');
        if (includeKey && apiKey) {
          params.append('key', apiKey);
        }
        return params.toString();
      };

      let result = await safeFetchJson(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${buildParams(
          Boolean(apiKey)
        )}`,
        { signal: AbortSignal.timeout(22000) }
      );

      // Si la clave de Google Cloud tiene restricción solo para Maps/Places y rechaza PageSpeed (400/403),
      // reintentar automáticamente sin clave usando la cuota pública de PageSpeed Insights.
      if (!result.ok && apiKey && (result.status === 400 || result.status === 403)) {
        result = await safeFetchJson(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${buildParams(
            false
          )}`,
          { signal: AbortSignal.timeout(22000) }
        );
      }

      if (!result.ok) {
        const realError =
          result.data?.error?.message ||
          JSON.stringify(result.data?.error || result.data);
        res.status(result.status).json({
          error: `Error de PageSpeed Insights API (${result.status}): ${realError}`,
        });
        return;
      }

      const categories = result.data?.lighthouseResult?.categories || {};
      const toScore = (val?: number) =>
        typeof val === 'number' ? Math.round(val * 100) : 0;

      const screenshotDataUrl: string | undefined =
        result.data?.lighthouseResult?.audits?.['final-screenshot']?.details
          ?.data;

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
            : 'Tiempo de espera agotado o error al ejecutar PageSpeed Insights v5.',
      });
    }
  });

  // 5. Análisis profundo de la web con Gemini Flash (Paso 1: urlContext + HTML -> Paso 2: JSON Schema)
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

      // PASO 1: Leer la web en paralelo con urlContext de Gemini (con timeout de 12s para evitar bloqueos de proxy)
      // e inspección rápida del HTML directo.
      const urlContextPromise = (async () => {
        try {
          const step1Prompt = `Analiza la página web ${normalizedUrl} del negocio local "${businessName}" (${category}) en ${address}.
Indica de forma concisa: a qué se dedica, si usa HTTPS, si está bien adaptada a móvil, si tiene botón de WhatsApp, si tiene sistema de cita/reserva online, si tiene formulario de contacto, señales de web desactualizada (año de copyright), correos visibles, redes sociales y 3-5 problemas claros.`;

          const step1Response = await Promise.race([
            generateContentWithRetry(ai, {
              primaryModel: 'gemini-3.5-flash',
              contents: step1Prompt,
              config: {
                tools: [{ urlContext: {} }],
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Tiempo máximo de urlContext alcanzado')),
                12000
              )
            ),
          ]);
          return step1Response.text || '';
        } catch (err) {
          return `Nota urlContext: ${
            err instanceof Error ? err.message : 'no disponible'
          }`;
        }
      })();

      const [rawUrlInspection, directHtmlReport] = await Promise.all([
        urlContextPromise,
        inspectWebsiteHtmlFast(normalizedUrl),
      ]);

      // PASO 2: Estructurar respuesta JSON garantizada con responseSchema y ThinkingLevel.LOW
      const step2Prompt = `Sos un consultor experto en venta de servicios digitales (páginas web, agentes de IA para WhatsApp y sistemas de turnos online) para negocios locales en Argentina (usá siempre español de Argentina con voseo comercial sobrio: "vos", "tenés", "podés", "fijate", "sabés", "celu", "página web", "sacar turno", "llamada corta", sin modismos informales excesivos).

DATOS DEL NEGOCIO:
- Nombre: ${businessName}
- Actividad / Categoría: ${category}
- Dirección: ${address}
- Web analizada: ${normalizedUrl}
- Valoración en Google Maps: ${rating ?? 'Sin valoración'} (${userRatingCount ?? 0} reseñas)

INFORME DE URL CONTEXT (GEMINI):
${rawUrlInspection}

${directHtmlReport}

MI PERFIL DE VENDEDOR:
- Mi nombre: ${sellerProfile?.name && sellerProfile.name !== 'Carlos Mendoza' ? sellerProfile.name : 'Ramiro Sanna'}
- Qué vendo: ${sellerProfile?.servicesOffered || 'Páginas web adaptadas a celulares, agentes de IA para WhatsApp y sistemas para sacar turnos online'}
- Mi propuesta de valor: ${sellerProfile?.valueProposition || 'Ayudo a negocios locales en Córdoba y Argentina a captar más clientes y automatizar consultas.'}
- Tono solicitado para los borradores: ${tone || 'Cercano y directo'}

REGLAS ESTRICTAS DE REDACCIÓN EN ESPAÑOL DE ARGENTINA (VOSEO COMERCIAL SOBRIO):
1. Voseo comercial sobrio: Usá "vos", "tenés", "podés", "querés", "sabés", "fijate". Prohibido el tuteo peninsular o neutro ("tú", "puedes", "coge cita", "ordenador", "móvil"). Tampoco uses lunfardo informal pesado ("che", "laburo", "chabón"). Mantené un estilo comercial respetuoso, claro y profesional.
2. Identidad del vendedor: Tu nombre es "${sellerProfile?.name && sellerProfile.name !== 'Carlos Mendoza' ? sellerProfile.name : 'Ramiro Sanna'}". Cuando te presentes en el guion de llamada, WhatsApp o correo, presentate siempre como "${sellerProfile?.name && sellerProfile.name !== 'Carlos Mendoza' ? sellerProfile.name : 'Ramiro Sanna'}" (NUNCA uses "Carlos Mendoza" ni nombres ficticios).
3. Vocabulario de negocio: Usá "celu" o "teléfono", "página web", "llamada corta", "sacar turno", "clientes de la zona".
4. Cierre / Llamado a la acción (CTA): Cerrá SIEMPRE con una pregunta al grano para responder con un SÍ o un NO por WhatsApp (ejemplos: "¿Te sirve que te mande un ejemplo rápido por acá?", "¿Te gustaría que lo veamos en 5 minutos?", "¿Te interesa ver cómo quedaría?").
5. Adaptación al tono elegido:
   - "Cercano y directo": Voseo empático y concreto, directo a la solución que le ahorra tiempo y le trae clientes.
   - "Consultivo profesional": Voseo sobrio y formal, enfocado en rentabilidad, orden comercial y presencia de marca.
   - "Enfocado en pérdida de clientes": Voseo que hace foco en consultas que se pierden fuera de hora o clientes que eligen a la competencia por no poder sacar turno o consultar directo por WhatsApp.
   - "Breve y al grano": 3 o 4 líneas directas al punto, sin vueltas ni preámbulos.

Generá el análisis estructurado y los 3 borradores personalizados de primer contacto (guion de llamada corta de 30 segundos, mensaje de WhatsApp y correo electrónico) mencionando de forma natural las oportunidades reales detectadas en su negocio.`;

      const step2Response = await generateContentWithRetry(ai, {
        primaryModel: 'gemini-3.5-flash',
        contents: step2Prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryTwoSentences: {
                type: Type.STRING,
                description:
                  'Resumen claro de a qué se dedica el negocio en exactamente dos frases en español de Argentina.',
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
                      'Uno de: "Página web nueva", "Agente de IA por WhatsApp", "Sistema de turnos online" o "Pack Web + WhatsApp IA".',
                  },
                  why: {
                    type: Type.STRING,
                    description:
                      'Explicación convincente de por qué este servicio concreto es el más conveniente para ofrecerle.',
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
                      'Guion de llamada telefónica corta de 30 segundos, natural y fluido con voseo comercial sobrio en español de Argentina.',
                  },
                  whatsappMessage: {
                    type: Type.STRING,
                    description:
                      'Mensaje breve de WhatsApp para primer contacto personal con voseo sobrio y cierre de pregunta sí/no.',
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

      const parsed = JSON.parse(cleanJsonText(step2Response.text || '{}'));
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

      const prompt = `Sos un experto en prospección comercial B2B en Argentina que vende servicios digitales a negocios locales (usá español de Argentina con voseo comercial sobrio: "vos", "tenés", "podés", "fijate", "sabés", "celu", "página web", "sacar turno", "llamada corta", sin modismos informales excesivos).

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
    ? `- Notas PageSpeed Celular: Rendimiento ${pageSpeed.performance}/100, SEO ${pageSpeed.seo}/100, Accesibilidad ${pageSpeed.accessibility}/100, Buenas prácticas ${pageSpeed.bestPractices}/100`
    : ''
}
${
  existingAnalysis
    ? `- Problemas y oportunidades detectadas: ${(existingAnalysis.plainLanguageIssues || []).join(' | ')}
- Servicio recomendado: ${existingAnalysis.recommendedService?.service} (${existingAnalysis.recommendedService?.why})`
    : ''
}

MI PERFIL DE VENDEDOR:
- Nombre: ${sellerProfile?.name && sellerProfile.name !== 'Carlos Mendoza' ? sellerProfile.name : 'Ramiro Sanna'}
- Qué vendo: ${sellerProfile?.servicesOffered || 'Páginas web adaptadas a celulares, agentes de IA para WhatsApp y sistemas para sacar turnos online'}
- Mi propuesta: ${sellerProfile?.valueProposition || 'Ayudo a negocios locales en Córdoba y Argentina a captar más clientes y automatizar consultas.'}
- Tono elegido: ${tone || 'Cercano y directo'}

REGLAS ESTRICTAS DE REDACCIÓN EN ESPAÑOL DE ARGENTINA (VOSEO COMERCIAL SOBRIO):
1. Voseo comercial sobrio: Usá "vos", "tenés", "podés", "querés", "sabés", "fijate". Prohibido el tuteo peninsular o neutro ("tú", "puedes", "coge cita", "ordenador", "móvil"). Tampoco uses lunfardo informal pesado ("che", "laburo", "chabón"). Mantené un tono comercial respetuoso, directo y profesional.
2. Identidad del vendedor: Tu nombre es "${sellerProfile?.name && sellerProfile.name !== 'Carlos Mendoza' ? sellerProfile.name : 'Ramiro Sanna'}". Cuando te presentes en el mensaje de WhatsApp, guion de llamada o correo electrónico, presentate SIEMPRE como "${sellerProfile?.name && sellerProfile.name !== 'Carlos Mendoza' ? sellerProfile.name : 'Ramiro Sanna'}" (NUNCA uses "Carlos Mendoza" ni nombres ficticios).
3. Vocabulario de negocio: Usá "celu" o "teléfono", "página web", "llamada corta", "sacar turno", "clientes de la zona".
4. Cierre / Llamado a la acción (CTA): Cerrá SIEMPRE con una pregunta al grano para responder con un SÍ o un NO por WhatsApp (ejemplos: "¿Te sirve que te mande un ejemplo rápido por acá?", "¿Te gustaría que te muestre cómo quedaría?", "¿Te interesa que lo veamos en 5 minutos?").
5. Adaptación al tono elegido:
   - "Cercano y directo": Voseo empático y concreto, directo a la solución que le ahorra tiempo y le trae clientes.
   - "Consultivo profesional": Voseo sobrio y formal, enfocado en rentabilidad, orden comercial y presencia de marca.
   - "Enfocado en pérdida de clientes": Voseo que hace foco en consultas que se pierden fuera de hora o clientes que eligen a la competencia por no poder sacar turno o consultar directo por WhatsApp.
   - "Breve y al grano": 3 o 4 líneas directas al punto, sin rodeos.

Generá los tres borradores personalizados de primer contacto (guion de llamada corta de 30 segundos, mensaje de WhatsApp y correo electrónico con asunto) y el resumen/diagnóstico del negocio.`;

      const response = await generateContentWithRetry(ai, {
        primaryModel: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryTwoSentences: {
                type: Type.STRING,
                description:
                  'Resumen en dos frases de a qué se dedica el negocio y su situación digital actual en español de Argentina.',
              },
              plainLanguageIssues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Entre 3 y 5 problemas u oportunidades explicados en lenguaje llano para el dueño.',
              },
              recommendedService: {
                type: Type.OBJECT,
                properties: {
                  service: {
                    type: Type.STRING,
                    description:
                      'Uno de: "Página web nueva", "Agente de IA por WhatsApp", "Sistema de turnos online" o "Pack Web + WhatsApp IA".',
                  },
                  why: { type: Type.STRING },
                },
                required: ['service', 'why'],
              },
              drafts: {
                type: Type.OBJECT,
                properties: {
                  callScript30s: {
                    type: Type.STRING,
                    description:
                      'Guion de llamada telefónica corta de 30 segundos con voseo comercial sobrio en español de Argentina.',
                  },
                  whatsappMessage: {
                    type: Type.STRING,
                    description:
                      'Mensaje de WhatsApp para primer contacto con voseo sobrio y cierre de pregunta sí/no.',
                  },
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

      const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
      const nowIso = new Date().toISOString();

      const fallbackChecklist = {
        https: false,
        httpsDetail:
          webClassification === 'no_website'
            ? 'No dispone de página web.'
            : `Enlaza únicamente a ${detectedPlatform || 'perfil externo'}.`,
        mobileFriendly: false,
        mobileFriendlyDetail: 'Carece de web propia adaptada a celulares.',
        whatsappButton: false,
        whatsappDetail: 'No tiene embudo web propio hacia WhatsApp.',
        onlineBooking: false,
        onlineBookingDetail: 'No dispone de sistema propio para sacar turnos online.',
        contactForm: false,
        contactFormDetail: 'Sin formulario de contacto propio.',
        outdatedSignals: true,
        outdatedDetail:
          webClassification === 'no_website'
            ? 'Presencia digital inexistente fuera de la ficha de Google Maps.'
            : `Depende de ${detectedPlatform || 'un perfil externo'} sin dominio propio.`,
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
          error:
            'Se requiere una zona y al menos una categoría con datos para analizar.',
        });
        return;
      }

      const prompt = `Sos un estratega comercial experto en venta de servicios digitales (páginas web adaptadas a celulares, agentes de IA para WhatsApp y sistemas para sacar turnos online) a negocios locales en Argentina (usá español de Argentina con voseo comercial sobrio).

Has escaneado la zona "${zone}" con Google Places API y obtuviste estos datos reales por cada nicho:
${JSON.stringify(categories, null, 2)}

PERFIL DEL VENDEDOR:
- Servicios que vende: ${sellerProfile?.servicesOffered || 'Páginas web adaptadas a celulares, agentes de IA para WhatsApp y sistemas de turnos online'}
- Propuesta de valor: ${sellerProfile?.valueProposition || 'Ayudo a negocios locales a captar más clientes y automatizar consultas.'}

Ordená TODAS las categorías analizadas de mayor a menor oportunidad comercial real (valorando porcentaje sin web propia, volumen de negocios activos, media de reseñas y ticket promedio del sector en Argentina).
Destacá en un resumen ejecutivo las 3 mejores categorías, explicá por qué hay tanta oportunidad en "${zone}" y especificá qué servicio exacto vender en cada categoría y con qué argumento comercial de cierre en Argentina.`;

      const response = await generateContentWithRetry(ai, {
        primaryModel: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topThreeSummary: {
                type: Type.STRING,
                description:
                  'Resumen estratégico en español de Argentina explicando cuáles son los 3 mejores nichos en esta zona y por qué empezar por ellos.',
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
                        'Qué servicio vender principalmente en este nicho (ej. "Sistema de turnos online + Agente WhatsApp", "Página web nueva de captación", etc.).',
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

      const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
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
