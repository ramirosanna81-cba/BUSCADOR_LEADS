# Radar de Clientes — Plataforma de Prospección Local B2B

Aplicación web profesional en español de España diseñada para consultores y vendedores de servicios digitales (diseño de páginas web, agentes de IA por WhatsApp y sistemas de reservas/citas online) que buscan identificar, auditar y contactar negocios locales con alta oportunidad comercial.

## User Review & Critical Decisions

> [!IMPORTANT]
> Estas son las decisiones de diseño y arquitectura confirmadas a partir de tus respuestas, listas para tu revisión antes de escribir una sola línea de código:

- **Estilo Visual Confirmado**: **Modo claro técnico de alto contraste** (superficies en blanco puro `#FFFFFF` y gris piedra `#F8FAFC`, bordes técnicos de `1px` en `#E2E8F0`, textos en pizarra `#0F172A` y acento primario en azul cobalto `#1D4ED8`). Sin degradados morados ni adornos superfluos; indicadores de puntuación y PageSpeed coloreados semánticamente en rojo (`#DC2626`), ámbar (`#D97706`) y verde (`#16A34A`) siempre acompañados de su valor numérico y etiqueta legible.
- **Almacenamiento en el Navegador Confirmado**: **IndexedDB con capa de repositorio desacoplada**. Permite almacenar cientos de leads, auditorías completas, capturas de pantalla móviles en base64 (`final-screenshot` de PageSpeed) y la caché de búsquedas sin sufrir el límite de 5 MB de `localStorage`, manteniendo una interfaz de datos (`DataRepository`) lista para conectarse a Firebase en el futuro sin tocar las vistas.
- **Vistas de Exploración Confirmadas**: En la pantalla **Buscar**, además de las vistas en **Tabla de alta densidad** y **Tarjetas**, se incluye una tercera pestaña de **Mapa interactivo opcional** para visualizar dónde se concentran los negocios del barrio o ciudad buscada.
- **Gestión de Claves API**:
  - **Gemini API**: se ejecuta exclusivamente en el servidor usando la clave del entorno (`GEMINI_API_KEY`).
  - **Google Cloud (Places API New + PageSpeed Insights v5)**: el servidor comprueba primero si existe una clave en variables de entorno (`GOOGLE_CLOUD_API_KEY` / `VITE_GOOGLE_MAPS_API_KEY`); si no está definida o deseas usar tu propia clave de Google Cloud, podrás introducirla en la pantalla **Ajustes** (se guarda únicamente en tu navegador y se envía por cabecera segura al proxy del servidor, sin escribirse jamás en el código fuente).

---

## 1. Overview & Core Concept

- **Qué hace**: Permite localizar negocios reales por zona y nicho mediante Google Places API (New), detectar cuáles carecen de web propia (incluyendo aquellos que solo enlazan a Facebook, Instagram, Linktree o directorios), auditar el rendimiento móvil y contenido real de sus webs con PageSpeed Insights v5 y Gemini Flash (`urlContext`), calcular una puntuación transparente de oportunidad comercial (0 a 100) y preparar borradores personalizados de primer contacto (guion de llamada de 30 s, WhatsApp y correo) junto con un CRM ligero por estados.
- **Perfil de usuario**: Profesional o agencia que vende páginas web, agentes de IA por WhatsApp y sistemas de citas a pymes y comercios locales en España.
- **Valor principal**: Ahorra horas de investigación manual cruzando datos de Google Maps, métricas técnicas móviles e inspección real de la web del negocio para entregar argumentos de venta concretos y comprensibles (sin jerga técnica) antes de descolgar el teléfono o escribir un mensaje.

---

## 2. User Experience & Visual Design (Pantallas)

### Identidad Visual y Tipografía
- **Dirección Estética**: Herramienta de trabajo B2B de alta densidad informativa, inspirada en terminales de inteligencia comercial (Linear / Stripe Dashboard en modo claro).
- **Paleta de Color (Regla 60-30-10)**:
  - **60% Lienzo Neutro**: Fondo de trabajo en gris piedra claro (`#F8FAFC`) y contenedores principales en blanco (`#FFFFFF`).
  - **30% Estructura y Tipografía**: Pizarra profunda (`#0F172A`) para titulares y nombres de negocios, gris pizarra medio (`#475569`) para datos secundarios y líneas divisorias de `1px` (`#E2E8F0`).
  - **10% Acento y Semántica**: Azul cobalto (`#1D4ED8`) para acciones primarias; semáforo de oportunidad y notas técnicas en Verde (`#16A34A`, 80–100 / Oportunidad Alta), Ámbar (`#D97706`, 50–79 / Media) y Rojo (`#DC2626`, 0–49 / Crítica en PageSpeed).
- **Jerarquía Tipográfica**:
  - **Titulares y Navegación**: `Plus Jakarta Sans` (SemiBold/Bold) para lectura clara y estructura firme.
  - **Cuerpo y Tablas**: `Public Sans` (Regular/Medium) optimizada para interfaces densas en escritorio y móvil.
  - **Métricas, Teléfonos y Puntuaciones**: `JetBrains Mono` con `tabular-nums` para alineación vertical exacta en columnas numéricas.

### Estructura de las 5 Pantallas (Menú Lateral Fijo + Cabecera Contextual)

#### Pantalla 1: Buscar
- **Buscador Principal**:
  - Campo **Zona** (ej. *«Dos Hermanas, Sevilla»*, *«28015 Madrid»*, *«Ruzafa, Valencia»*).
  - Campo **Nicho** de texto libre acompañado de selector rápido de las 14 sugerencias clave: *talleres mecánicos, clínicas dentales, fisioterapeutas, peluquerías, centros de estética, restaurantes, gimnasios, academias, inmobiliarias, reformas, veterinarios, autoescuelas, ópticas, gestorías*.
  - Indicador de caché: informa si la búsqueda ya está en caché local (0 llamadas gastadas) e incluye botón para forzar actualización si se desea.
- **Barra de Filtros en Vivo**:
  - Interruptores y selectores: *Solo sin web propia*, *Solo con teléfono*, *Valoración mínima* (ej. ≥ 3.5★, ≥ 4.0★, ≥ 4.5★), *Mínimo de reseñas* (ej. ≥ 5, ≥ 15, ≥ 50) y *Ocultar negocios cerrados* (activado por defecto para excluir `CLOSED_PERMANENTLY` / `CLOSED_TEMPORARILY`).
- **Conmutador de Vista (Tabla · Tarjetas · Mapa)**:
  - **Tabla y Tarjetas**: muestran nombre del negocio, actividad (`primaryTypeDisplayName`), dirección, teléfono pulsable (`tel:`), enlace a su web o etiqueta diferenciada (**«Sin web»** si no tiene URL, o **«Sin web propia»** si la URL es de Facebook, Instagram, Linktree o directorio como Páginas Amarillas, Doctoralia, Treatwell, etc.), valoración y nº de reseñas, enlace directo a Google Maps, **Puntuación de Oportunidad (0–100)** con desglose emergente al pulsar, y estado actual en el embudo (*No guardado*, *Nuevo*, *Analizado*, *Contactado*, etc.).
  - **Mapa Opcional**: muestra los marcadores de los negocios filtrados en la zona, coloreados según su nivel de oportunidad comercial, permitiendo abrir su resumen o ficha con un clic.
- **Acciones en Lote y Paginación**:
  - Casillas de selección múltiple con barra flotante contextual: **«Guardar en mis leads»** y **«Analizar seleccionados»** (ejecuta la cola de análisis de 2 en 2 con barra de progreso en tiempo real).
  - Botón **«Cargar más resultados»** al final de la lista usando el `nextPageToken` de Places API (hasta 60 negocios por búsqueda: 20 + 20 + 20).

#### Pantalla 2: Ficha del Negocio (Vista Detallada e Imprimible)
- **Cabecera de Contacto y Acciones Rápidas**:
  - Nombre, categoría, dirección completa, estado de apertura, valoración, contador de reseñas y botones directos: **Llamar**, **Abrir web**, **Abrir en Google Maps** y **Exportar ficha (Imprimir / PDF)**.
  - Panel de **Puntuación de Oportunidad (0–100)** con el desglose línea por línea de por qué recibe esa nota (puntos sumados/restados).
- **Bloque de Auditoría Web (Botón «Analizar web», 10–30 s)**:
  - *Si el negocio no tiene web o solo tiene red social/directorio*: no realiza llamadas innecesarias a PageSpeed Insights, clasifica la oportunidad como **«Sin web» / «Sin web propia»** y permite generar directamente los borradores orientados a la creación de su primera web o sistema de captación por WhatsApp.
  - *Si tiene web propia*:
    1. **4 Notas de PageSpeed Insights (Móvil)**: Rendimiento (*Performance*), SEO, Accesibilidad y Buenas prácticas con código de color semántico.
    2. **Captura de Pantalla Móvil Real**: imagen devuelta por la auditoría `final-screenshot` enmarcada en proporción móvil.
    3. **Informe de Gemini con URL Context**:
       - Resumen claro de a qué se dedica el negocio en dos frases.
       - **Lista de comprobación visual**: HTTPS activo, adaptada a móvil, botón/enlace de WhatsApp, sistema de cita o reserva online, formulario de contacto y señales de web desactualizada (ej. año del copyright antiguo).
       - **Datos extraídos de la web**: correos electrónicos y enlaces a redes sociales encontrados dentro de la página.
       - **Entre 3 y 5 problemas detectados** redactados en lenguaje llano y comercial (para que el dueño del negocio lo entienda al instante).
       - **Recomendación de servicio a vender**: qué ofrecerle (*Web nueva*, *Agente de IA por WhatsApp*, *Sistema de citas*) y el argumento exacto del porqué.
- **Bloque de Primer Contacto (Borradores Personalizados)**:
  - Aviso legal visible junto a los borradores: *«Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento»*.
  - Tres pestañas listas para usar: **1. Guion de llamada (30 segundos)**, **2. Mensaje de WhatsApp** y **3. Correo electrónico**.
  - Cada borrador combina los problemas reales detectados en ese negocio con tu **Perfil de vendedor** configurado en Ajustes.
  - Botones para **Copiar al portapapeles** (con confirmación visual) y **Regenerar con otro tono** (*Cercano y natural*, *Consultivo profesional*, *Directo al grano*, *Enfocado en pérdida de clientes*).
- **Seguimiento Comercial (CRM en Ficha)**:
  - Selector de **Estado** (*Nuevo, Analizado, Contactado, Respondió, Reunión, Cliente, Descartado*), selector de **Fecha de próxima acción** y área de **Notas de seguimiento** con guardado automático en IndexedDB.
- **Exportación Imprimible / PDF**:
  - El botón **«Exportar ficha»** formatea un informe limpio de auditoría y ficha comercial listo para guardar como PDF o imprimir desde el diálogo nativo del sistema (`@media print` optimizado).

#### Pantalla 3: Radar de Nichos
- **Configuración del Barrido**:
  - Campo **Zona** y lista editable de **Categorías / Nichos** a comparar (precargada con las 14 sugerencias oficiales, pudiendo activar/desactivar o añadir cualquier nicho).
  - **Aviso y Confirmación de Consumo**: antes de lanzar el análisis, calcula exactamente cuántas llamadas a Places API va a consumir (descontando los nichos de esa misma zona que ya estén en caché) y muestra un cuadro de confirmación explícito.
- **Tabla Comparativa de Oportunidad por Nicho**:
  - Para cada categoría procesada calcula en tiempo real: **Nº de negocios encontrados**, **% sin web propia**, **Valoración media** y **Media de reseñas**.
- **Recomendación Estratégica de Gemini**:
  - Gemini analiza la tabla estadística de la zona, ordena las categorías de mayor a menor oportunidad comercial, destaca el **Top 3 de nichos recomendados**, explica el **porqué** de cada uno en esa localidad y especifica **qué servicio concreto vender** en cada nicho.
  - Cada fila y tarjeta recomendada incluye el botón **«Ver negocios»**, que abre directamente la pantalla **Buscar** con los resultados de ese nicho ya cargados desde la caché (sin gastar otra llamada).

#### Pantalla 4: Mis Leads (Tabla y Tablero Kanban)
- **Conmutador entre Vista Tabla y Vista Tablero (Kanban)**:
  - **Tablero por Estados**: 7 columnas interactivas (*Nuevo, Analizado, Contactado, Respondió, Reunión, Cliente, Descartado*) con cambio rápido de estado, indicador de próxima acción y acceso en un clic a la Ficha del negocio.
  - **Tabla CRM**: vista compacta ordenable por puntuación de oportunidad, fecha de próxima acción o valoración.
- **Filtros y Exportación**:
  - Filtros combinables por **Estado**, **Nicho**, **Zona** y búsqueda por texto (nombre, teléfono o notas).
  - Botón **«Exportar a CSV»** con codificación UTF-8 con BOM (para que Excel en español abra tildes y eñes perfectamente) incluyendo todos los datos de contacto, notas de PageSpeed, diagnóstico, recomendación y seguimiento.

#### Pantalla 5: Ajustes
- **Clave de Google Cloud (Places y PageSpeed)**:
  - Indicador de estado de la clave (si ya está provista por el entorno o configurada en el navegador).
  - Campo seguro para guardar o actualizar la clave de Google Cloud exclusivamente en este navegador, con botón **«Probar conexión»**.
- **Mi Perfil de Vendedor**:
  - Campos editables: **Tu nombre / agencia**, **Qué servicios vendes** (Webs, Agentes de IA por WhatsApp, Sistemas de citas), **Tu propuesta de valor / diferencial** y **Tono preferido por defecto**.
- **Control de Cuota Mensual de Places API**:
  - Contador en tiempo real de llamadas a Places realizadas en el mes en curso (`YYYY-MM`).
  - Límite mensual editable (por defecto **1.000 llamadas gratuitas**) con alerta destacada en ámbar al alcanzar o superar las **800 llamadas** (80% del límite) y opción de reiniciar contador o vaciar caché de búsquedas.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Combinación de `urlContext` y Salida Estructurada JSON en Gemini**
  - *Enfoque elegido*: Flujo en **dos llamadas encadenadas en el servidor** dentro del endpoint de análisis (`/api/gemini/analyze-website`), con fallback automático si una sola llamada híbrida no es aceptada por la API para ese esquema.
  - *Por qué*: El modelo `gemini-3.8-flash` con la herramienta `urlContext` lee directamente el HTML/contenido real de la web del negocio. Al separar el paso 1 (inspección profunda de la URL con `tools: [{ urlContext: {} }]`) del paso 2 (estructuración estricta con `responseMimeType: "application/json"` y `responseSchema`), garantizamos al 100% que nunca falle por incompatibilidad entre herramientas nativas y validación de esquemas JSON complejos, cumpliendo fielmente tu indicación (*«Si no se puede combinar URL context con salida estructurada, haz dos llamadas»*).
- **Decisión 2: Detección Inteligente de «Sin web propia»**
  - *Enfoque elegido*: Clasificador determinista de dominios para el campo `websiteUri` de Places API.
  - *Por qué*: Muchos comercios locales ponen en su ficha de Google Maps un enlace a `instagram.com`, `facebook.com`, `linktr.ee`, `doctoralia.es`, `paginasamarillas.es` o `treatwell.es`. La aplicación detecta estos dominios automáticamente, los etiqueta como **«Sin web propia»**, conserva el enlace para que puedas cotillear su perfil social si quieres, pero los puntúa como candidatos de máxima prioridad para venderles una web propia o automatización de WhatsApp.
- **Decisión 3: Cola de Análisis con Concurrencia Máxima de 2 en 2**
  - *Enfoque elegido*: Gestor de cola asíncrona (`AnalysisQueue`) con límite de 2 trabajadores simultáneos (`concurrency = 2`).
  - *Por qué*: Cada auditoría completa (PageSpeed móvil + lectura web con Gemini) tarda entre 10 y 30 segundos. Limitar el análisis en lote a 2 negocios en paralelo evita saturar las cuotas por minuto de PageSpeed Insights y Gemini, mostrando en la interfaz qué dos negocios se están analizando ahora mismo y cuántos quedan pendientes.

---

## 4. Technical Architecture, APIs & Data Model

### Diagrama de Arquitectura y Flujo de Datos

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          INTERFAZ WEB (React 19 + Tailwind)                       │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ 1. Buscar    │  │ 2. Ficha Negocio │  │ 3. Radar Nichos│  │ 4. Mis Leads   │  │
│  │ (Tabla/Cards │  │ (PageSpeed + IA  │  │ (Comparativa + │  │ (Tabla + Kanban│  │
│  │  /Mapa + Lote│  │  + 3 Borradores  │  │  Ranking IA)   │  │  + Export CSV) │  │
│  └──────┬───────┘  └────────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│         │                   │                    │                   │           │
│         └───────────────────┴─────────┬──────────┴───────────────────┘           │
│                                       ▼                                          │
│         ┌─────────────────────────────────────────────────────────────┐          │
│         │   Capa de Servicios & Cola de Análisis (Máx. 2 en paralelo) │          │
│         │   + Motor de Puntuación de Oportunidad (0–100 + Desglose)   │          │
│         └──────────────┬─────────────────────────────────┬────────────┘          │
│                        ▼                                 ▼                       │
│         ┌─────────────────────────────┐   ┌───────────────────────────────────┐  │
│         │ Capa de Datos (Repository)  │   │ Proxy API Backend (Express :3000) │  │
│         │ IndexedDB:                  │   │ • POST /api/places/search         │  │
│         │ • leads (fichas + capturas) │   │ • GET  /api/pagespeed/analyze     │  │
│         │ • searchCache (zona+nicho)  │   │ • POST /api/gemini/analyze-web    │  │
│         │ • nicheReports (radar)      │   │ • POST /api/gemini/drafts         │  │
│         │ • settings & apiCounter     │   │ • POST /api/gemini/niche-radar    │  │
│         └─────────────────────────────┘   └─────┬──────────────┬───────────┬──┘  │
└─────────────────────────────────────────────────┼──────────────┼───────────┼─────┘
                                                  │              │           │
                       ┌──────────────────────────┘              │           └───────────────────────┐
                       ▼                                         ▼                                   ▼
      ┌─────────────────────────────────┐       ┌─────────────────────────────────┐  ┌──────────────────────────────┐
      │ Google Places API (New)         │       │ PageSpeed Insights API v5       │  │ Gemini API (@google/genai)   │
      │ POST places:searchText          │       │ GET runPagespeed?strategy=mobile│  │ Modelo: gemini-3.8-flash     │
      │ • languageCode: "es"            │       │ • performance, seo,             │  │ • Paso 1: tools:[urlContext] │
      │ • regionCode: "ES", pageSize:20 │       │   accessibility, best-practices │  │ • Paso 2: responseSchema JSON│
      │ • FieldMask estricto (14 campos)│       │ • Captura: final-screenshot     │  │ • Redacción de 3 borradores  │
      └─────────────────────────────────┘       └─────────────────────────────────┘  └──────────────────────────────┘
```

### Cómo se usa cada API

1. **Google Places API (New) — `places:searchText`**:
   - Llamada HTTP `POST https://places.googleapis.com/v1/places:searchText` a través del servidor Express para evitar problemas de CORS y proteger la clave.
   - Cuerpo de la petición:
     - `textQuery`: `"{nicho} en {zona}"` (ej. `"talleres mecánicos en Dos Hermanas, Sevilla"`).
     - `languageCode`: `"es"`, `regionCode`: `"ES"`, `pageSize`: `20`.
     - `pageToken`: opcional, enviado al pulsar «Cargar más» hasta alcanzar un máximo de 60 resultados por búsqueda (3 páginas).
   - Cabecera `X-Goog-FieldMask` **exacta**:
     `places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.types,places.googleMapsUri,places.businessStatus,nextPageToken`.
   - Cada llamada exitosa incrementa el contador mensual del mes actual (`YYYY-MM`) y guarda los resultados en la tabla `searchCache` de IndexedDB bajo la clave normalizada `zona + nicho`.

2. **PageSpeed Insights API v5 — `runPagespeed`**:
   - Llamada `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={websiteUri}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices&locale=es`.
   - Solo se ejecuta cuando el negocio posee una **web propia** (no se invoca si carece de web o si su URL es un perfil de Instagram/Facebook/Linktree/directorio).
   - Extrae las 4 puntuaciones enteras (0–100) y la imagen en base64 de `lighthouseResult.audits['final-screenshot'].details.data`.

3. **Gemini API (`gemini-3.8-flash`)**:
   - **Análisis de Web (`/api/gemini/analyze-web`)**:
     - *Llamada 1 (`urlContext`)*: inspecciona la `websiteUri` del negocio usando `tools: [{ urlContext: {} }]` para extraer a qué se dedica exactamente, verificar HTTPS, adaptabilidad móvil, presencia de botón de WhatsApp, sistema de reservas/citas online, formulario de contacto, año de copyright/señales de abandono, emails de contacto y enlaces a redes sociales.
     - *Llamada 2 (`responseSchema` JSON)*: convierte el hallazgo anterior junto con las notas de PageSpeed y el perfil del vendedor en un objeto JSON validado por esquema con el resumen en 2 frases, la lista de comprobación, correos/redes, de 3 a 5 problemas explicados en lenguaje llano, el servicio recomendado con su justificación y los 3 borradores de contacto.
   - **Borradores para Negocios Sin Web o Regeneración de Tono (`/api/gemini/drafts`)**:
     - Genera en JSON estructurado (`responseSchema`) el guion de llamada de 30 segundos, el mensaje de WhatsApp y el correo electrónico adaptados al tono elegido y a tu perfil de vendedor.
   - **Radar de Nichos (`/api/gemini/niche-radar`)**:
     - Recibe las estadísticas reales obtenidas de Places para cada categoría en la zona y devuelve un JSON estructurado con el ranking ordenado por oportunidad, los 3 mejores nichos recomendados, la explicación comercial y el servicio ideal para vender en cada uno.

### Modelo de Datos (Separado tras interfaz `DataRepository` en IndexedDB)

- **`BusinessLead` (Almacén `leads`)**:
  - Identificación y Places: `id` (placeId), `displayName`, `primaryTypeDisplayName`, `types`, `formattedAddress`, `location` (`lat`, `lng`), `nationalPhoneNumber`, `internationalPhoneNumber`, `websiteUri`, `webClassification` (`'own_website' | 'social_or_directory' | 'no_website'`), `detectedPlatform` (ej. `'Instagram'`, `'Facebook'`, `'Linktree'`, `'Directorio'`), `rating`, `userRatingCount`, `googleMapsUri`, `businessStatus`.
  - Puntuación de Oportunidad: `opportunityScore` (`total` 0–100, `isProvisional` boolean, `breakdown`: lista de `{ label, points, reason }`).
  - Auditoría Técnica (`pageSpeed` opcional): `analyzedAt`, `performance`, `seo`, `accessibility`, `bestPractices`, `screenshotDataUrl` (base64).
  - Análisis IA (`geminiAnalysis` opcional): `summaryTwoSentences`, `checklist` (`https`, `mobileFriendly`, `whatsappButton`, `onlineBooking`, `contactForm`, `outdatedSignals`), `emails`, `socialLinks`, `plainLanguageIssues` (3–5), `recommendedService` (`service`, `rationale`).
  - Primer Contacto (`outreachDrafts` opcional): `callScript30s`, `whatsappMessage`, `emailSubject`, `emailBody`, `toneUsed`.
  - Gestión CRM: `status` (`'Nuevo' | 'Analizado' | 'Contactado' | 'Respondió' | 'Reunión' | 'Cliente' | 'Descartado'`), `notes`, `nextActionDate`, `savedAt`, `updatedAt`, `zoneTag`, `nicheTag`.
- **`SearchCacheEntry` (Almacén `searchCache`)**:
  - `cacheKey` (`normalizar(zona)__normalizar(nicho)`), `zone`, `niche`, `places` (lista de negocios), `nextPageToken`, `fetchedPages` (1 a 3), `timestamp`.
- **`SellerProfile & AppSettings` (Almacén `settings`)**:
  - `sellerName`, `servicesOffered`, `valueProposition`, `defaultTone`, `googleCloudApiKey` (local), `monthlyPlacesLimit` (por defecto 1000), `usageByMonth` (`Record<'YYYY-MM', number>`).

### Fórmula de Puntuación de Oportunidad (0 a 100) con Desglose Visible

Cada negocio muestra siempre su nota entre 0 y 100 y la lista exacta de factores que suman o restan puntos:

1. **Puntuación Provisional (calculada al instante con datos de Places)**:
   - **Estado de la Web**:
     - Sin web (`no_website`): **+45 ptos** (*«Carece por completo de página web»*).
     - Solo red social o directorio (`social_or_directory`): **+40 ptos** (*«Usa {plataforma} en lugar de una web propia»*).
     - Tiene web propia (`own_website`): **+15 ptos base** (*«Tiene web propia pendiente de auditar»*).
   - **Actividad y Tracción del Negocio (Reseñas y Valoración)**:
     - Negocio muy activo (≥ 30 reseñas): **+20 ptos** | Activo (10–29 reseñas): **+15 ptos** | Poca actividad (3–9 reseñas): **+5 ptos** | Casi sin actividad (< 3 reseñas): **-10 ptos**.
     - Buena reputación (valoración ≥ 4.0★): **+10 ptos** | Valoración media (3.2–3.9★): **+5 ptos** | Baja (< 3.2★): **-5 ptos**.
   - **Contactabilidad**:
     - Dispone de teléfono directo: **+10 ptos** | Sin teléfono registrado: **-15 ptos**.
     - Negocio cerrado temporal o permanentemente: **-50 ptos**.

2. **Puntuación Definitiva (tras pulsar «Analizar» en negocios con web propia)**:
   - Sustituye los +15 ptos base de web por el diagnóstico real:
     - **PageSpeed Móvil (Rendimiento)**: < 50 (**+25 ptos**: *«Web móvil lenta o deficiente»*), 50–74 (**+15 ptos**: *«Rendimiento móvil mejorable»*), 75–89 (**+5 ptos**), ≥ 90 (**-15 ptos**: *«Web técnicamente rápida y optimizada»*).
     - **PageSpeed SEO / Accesibilidad**: SEO < 70 (**+10 ptos**), Accesibilidad < 70 (**+5 ptos**).
     - **Carencias de Conversión detectadas por Gemini**:
       - Sin botón de WhatsApp: **+12 ptos**.
       - Sin sistema de cita/reserva online (o formulario): **+12 ptos**.
       - Sin HTTPS o con señales claras de web desactualizada: **+10 ptos**.
       - Web moderna que ya cumple todos los puntos de conversión: **-20 ptos**.
   - El total se acota siempre al rango `0–100`.

---

## 5. Orden de Construcción

Una vez apruebes este plan, construiré la aplicación siguiendo este orden estructurado:

1. **Capa de Datos e Infraestructura Local (`IndexedDB` + Repositorio)**:
   - Implementación del motor de almacenamiento en IndexedDB separado por interfaz (`DataRepository`), detector de «Sin web propia» (redes sociales y directorios), calculadora de Puntuación de Oportunidad (provisional y definitiva con desglose) y control de cuota mensual de Places.
2. **Servidor Backend Express y Rutas de Integración (`/api/*`)**:
   - Configuración de `server.ts` en el puerto 3000 integrando:
     - Proxy a **Google Places API (New)** (`places:searchText`) con el `FieldMask` exacto de 14 campos, idioma `es`, región `ES` y soporte de `pageToken`.
     - Proxy a **PageSpeed Insights API v5** (`runPagespeed` móvil, 4 categorías + extracción de `final-screenshot`).
     - Servicios **Gemini (`gemini-3.8-flash`)** con `@google/genai`: análisis de web en dos pasos (`urlContext` + `responseSchema` JSON), generador de los 3 borradores de primer contacto y recomendador estratégico para el Radar de nichos.
3. **Estructura de Navegación y Pantalla 5 (Ajustes)**:
   - Menú lateral de las 5 pantallas en modo claro técnico de alto contraste, indicador global de llamadas a Places del mes (con aviso al llegar a 800/1.000), configuración de clave de Google Cloud y formulario de «Mi perfil de vendedor».
4. **Pantalla 1 (Buscar) + Cola de Análisis de 2 en 2**:
   - Buscador por Zona y Nicho (con las 14 sugerencias rápidas), caché inteligente de búsquedas, filtros en tiempo real, vistas en Tabla, Tarjetas y Mapa opcional, paginación «Cargar más» (hasta 60 resultados) y barra de acciones en lote con cola concurrente de máximo 2 análisis simultáneos.
5. **Pantalla 2 (Ficha del Negocio + Exportación Imprimible/PDF)**:
   - Ficha completa con acciones de contacto, velocímetros y captura móvil de PageSpeed, checklist y problemas en lenguaje llano de Gemini, los 3 borradores con aviso legal, copiado y regeneración de tono, notas/estado/fecha de próxima acción y vista de impresión/PDF.
6. **Pantalla 3 (Radar de Nichos) y Pantalla 4 (Mis Leads CRM)**:
   - Radar de nichos con pre-cálculo de llamadas a Places, confirmación del usuario, agregación estadística por categoría y recomendación de Gemini con botón «Ver negocios».
   - CRM «Mis leads» en vista Tabla y Tablero Kanban por los 7 estados, filtros combinados y exportación a CSV compatible con Excel.
7. **Verificación y Compilación Final**:
   - Comprobación de tipos TypeScript, compilación del proyecto y revisión de estados de carga, vacíos y mensajes reales de error de las APIs.
