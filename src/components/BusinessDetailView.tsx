import React, { useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Globe,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Printer,
  Bookmark,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  MessageSquare,
  PhoneCall,
} from 'lucide-react';
import {
  BusinessLead,
  LEAD_STATUSES,
  LeadStatus,
  TONE_OPTIONS,
  ToneOption,
} from '../types';
import { getScoreColorClasses } from './ScoreBadge';

interface BusinessDetailViewProps {
  lead: BusinessLead;
  onBack: () => void;
  onUpdateLead: (updated: BusinessLead) => Promise<void>;
  onAnalyzeLead: (lead: BusinessLead) => Promise<void>;
  onRegenerateDrafts: (lead: BusinessLead, tone: ToneOption) => Promise<void>;
  isAnalyzing: boolean;
}

export const BusinessDetailView: React.FC<BusinessDetailViewProps> = ({
  lead,
  onBack,
  onUpdateLead,
  onAnalyzeLead,
  onRegenerateDrafts,
  isAnalyzing,
}) => {
  const [selectedTone, setSelectedTone] = useState<ToneOption>(
    lead.outreachDrafts?.tone || 'Cercano y directo'
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeDraftTab, setActiveDraftTab] = useState<
    'call' | 'whatsapp' | 'email'
  >('whatsapp');
  const [actionError, setActionError] = useState<string | null>(null);

  const phone = lead.nationalPhoneNumber || lead.internationalPhoneNumber;
  const oppColors = getScoreColorClasses(lead.opportunityScore.total, true);

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleTriggerAnalysis = async () => {
    setActionError(null);
    try {
      await onAnalyzeLead(lead);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Error al analizar el negocio'
      );
    }
  };

  const handleRegenerateTone = async () => {
    setActionError(null);
    setIsRegenerating(true);
    try {
      await onRegenerateDrafts(lead, selectedTone);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Error al regenerar los borradores'
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleSaveLead = async () => {
    await onUpdateLead({
      ...lead,
      isSavedLead: !lead.isSavedLead,
      savedAt: !lead.isSavedLead
        ? new Date().toISOString()
        : lead.savedAt,
    });
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    await onUpdateLead({
      ...lead,
      isSavedLead: true,
      status: newStatus,
      savedAt: lead.savedAt || new Date().toISOString(),
    });
  };

  const handleNotesChange = async (notes: string) => {
    await onUpdateLead({
      ...lead,
      notes,
    });
  };

  const handleNextActionDateChange = async (nextActionDate: string) => {
    await onUpdateLead({
      ...lead,
      nextActionDate,
    });
  };

  const renderPageSpeedMetric = (label: string, value: number) => {
    const c = getScoreColorClasses(value, false);
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">{label}</span>
          <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
        </div>
        <div
          className={`mt-1.5 font-mono tabular-nums text-2xl font-bold ${c.text}`}
        >
          {value}
          <span className="text-xs font-normal text-slate-400">/100</span>
        </div>
        <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar}`}
            style={{ width: `${Math.max(4, value)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 print-container">
      {/* Barra superior de retorno y acciones principales */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al listado</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSaveLead}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              lead.isSavedLead
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>
              {lead.isSavedLead ? 'Guardado en mis leads' : 'Guardar en mis leads'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Exportar ficha (Imprimir / PDF)</span>
          </button>
        </div>
      </div>

      {/* Cabecera de Datos del Negocio con estilo ejecutivo y colores */}
      <div className="bg-gradient-to-br from-[#0b1329] via-[#142345] to-[#0d1933] border border-slate-700/80 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-blue-300">{lead.primaryTypeDisplayName}</span>
              <span className="text-slate-500">·</span>
              <span>Zona: <strong className="text-slate-100">{lead.zoneTag || 'Córdoba Capital'}</strong></span>
              <span className="text-slate-500">·</span>
              <span>
                Estado: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">{lead.status}</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              {lead.displayName}
            </h1>

            <p className="text-sm text-slate-300">{lead.formattedAddress}</p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Valoración Maps:</span>
                <span className="font-mono tabular-nums font-semibold text-white">
                  {typeof lead.rating === 'number' ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-amber-400 font-bold">★ {lead.rating.toFixed(1)}</span>
                      <span className="text-slate-300">({lead.userRatingCount} reseñas)</span>
                    </span>
                  ) : (
                    'Sin valoraciones'
                  )}
                </span>
              </div>

              <span className="text-slate-600">·</span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Situación web:</span>
                {lead.webClassification === 'no_website' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Sin web
                  </span>
                ) : lead.webClassification === 'social_or_directory' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Sin web propia ({lead.detectedPlatform || 'Red social / Directorio'})
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Con web propia
                  </span>
                )}
              </div>
            </div>

            {/* Botones de acción rápida de contacto */}
            <div className="pt-3 flex flex-wrap items-center gap-2.5 no-print">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">Llamar ({phone})</span>
                </a>
              )}

              {lead.websiteUri && (
                <a
                  href={lead.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>
                    {lead.webClassification === 'social_or_directory'
                      ? `Abrir ${lead.detectedPlatform || 'enlace'}`
                      : 'Abrir página web'}
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}

              {lead.googleMapsUri && (
                <a
                  href={lead.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold rounded-lg transition-colors"
                >
                  <span>Ver en Google Maps</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
            </div>
          </div>

          {/* Resumen de Puntuación de Oportunidad y Desglose */}
          <div className="lg:w-96 bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 shrink-0 shadow-inner">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div>
                <div className="text-xs font-bold text-white">
                  Puntuación de Oportunidad
                </div>
                <div className="text-[11px] text-slate-400">
                  {lead.opportunityScore.isProvisional
                    ? 'Nota provisional (datos de Places)'
                    : 'Nota auditada (Places + Web)'}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`font-mono tabular-nums text-2xl font-bold ${oppColors.text}`}
                >
                  {lead.opportunityScore.total}
                </span>
                <span className="font-mono text-xs text-slate-400">/100</span>
              </div>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {lead.opportunityScore.breakdown.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 text-xs"
                >
                  <span className="text-slate-300" title={item.reason}>
                    {item.label}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold shrink-0 ${
                      item.points >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.points >= 0 ? `+${item.points}` : item.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(actionError || lead.analysisError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
            <div className="font-semibold">Error durante el análisis</div>
            <div className="mt-1 font-mono">{actionError || lead.analysisError}</div>
          </div>
        </div>
      )}

      {/* Bloque 1: Auditoría de la Web (PageSpeed Móvil + Gemini URL Context) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Análisis de la Presencia Web y Diagnóstico Comercial
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lead.webClassification === 'own_website'
                ? 'Auditoría técnica en móvil (PageSpeed Insights v5) e inspección de contenido con Gemini URL Context (tarda entre 10 y 30 segundos).'
                : lead.webClassification === 'social_or_directory'
                ? `Este negocio enlaza a ${lead.detectedPlatform || 'un perfil externo'} («Sin web propia»). No se invoca PageSpeed y se prepara una propuesta directa.`
                : 'Este negocio no tiene página web («Sin web»). No se invoca PageSpeed y se prepara una propuesta para crear su presencia digital.'}
            </p>
          </div>

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleTriggerAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer no-print"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analizando (10–30 s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {lead.geminiAnalysis ? 'Repetir análisis' : 'Analizar'}
                </span>
              </>
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-blue-700 animate-spin mx-auto" />
            <div className="text-sm font-medium text-slate-900">
              Auditando el negocio y redactando borradores personalizados...
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {lead.webClassification === 'own_website'
                ? 'Ejecutando lighthouse móvil en PageSpeed Insights v5 y leyendo la web del negocio con Gemini URL Context. Puede tardar entre 10 y 30 segundos.'
                : 'Generando diagnóstico de oportunidad y los 3 borradores de primer contacto con Gemini Flash.'}
            </p>
          </div>
        )}

        {!isAnalyzing && !lead.geminiAnalysis && (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-600">
              Pulsa en <strong>«Analizar»</strong> para obtener{' '}
              {lead.webClassification === 'own_website'
                ? 'las 4 notas de PageSpeed en móvil, la captura de pantalla de la web, la lista de comprobación y los 3 borradores de contacto.'
                : 'el diagnóstico comercial y los 3 borradores de primer contacto adaptados a este negocio sin web propia.'}
            </p>
          </div>
        )}

        {!isAnalyzing && lead.geminiAnalysis && (
          <div className="mt-6 space-y-6">
            {/* Notas de PageSpeed y Captura Móvil (solo si tiene web propia) */}
            {lead.webClassification === 'own_website' && lead.pageSpeed && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-4">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Puntuaciones de PageSpeed Insights v5 (Estrategia Móvil)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {renderPageSpeedMetric(
                      'Rendimiento',
                      lead.pageSpeed.performance
                    )}
                    {renderPageSpeedMetric('SEO', lead.pageSpeed.seo)}
                    {renderPageSpeedMetric(
                      'Accesibilidad',
                      lead.pageSpeed.accessibility
                    )}
                    {renderPageSpeedMetric(
                      'Buenas prácticas',
                      lead.pageSpeed.bestPractices
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4">
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">
                    Captura en móvil (final-screenshot)
                  </h3>
                  {lead.pageSpeed.screenshotDataUrl ? (
                    <div className="border border-slate-200 rounded-md bg-slate-50 p-2 flex justify-center">
                      <img
                        src={lead.pageSpeed.screenshotDataUrl}
                        alt={`Captura móvil de ${lead.displayName}`}
                        referrerPolicy="no-referrer"
                        className="max-h-64 w-auto rounded border border-slate-200 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-md bg-slate-50 p-6 text-center text-xs text-slate-500">
                      PageSpeed no devolvió captura visual para esta URL.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resumen de a qué se dedica y Servicio Recomendado */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700">
                    ¿A qué se dedica el negocio? (Resumen en 2 frases)
                  </h3>
                  <p className="text-sm text-slate-900 mt-1 leading-relaxed">
                    {lead.geminiAnalysis.summaryTwoSentences}
                  </p>
                </div>

                {/* Correos y redes sociales extraídos de la web */}
                <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">
                      Correos en la web:
                    </span>
                    {lead.geminiAnalysis.emails.length > 0 ? (
                      <ul className="space-y-1 font-mono text-slate-800">
                        {lead.geminiAnalysis.emails.map((em, idx) => (
                          <li key={idx} className="truncate">
                            <a
                              href={`mailto:${em}`}
                              className="text-blue-700 hover:underline"
                            >
                              {em}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500">
                        Ningún correo visible en la web
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">
                      Redes sociales detectadas:
                    </span>
                    {lead.geminiAnalysis.socialLinks.length > 0 ? (
                      <ul className="space-y-1 text-slate-800">
                        {lead.geminiAnalysis.socialLinks.map((soc, idx) => (
                          <li key={idx} className="truncate">
                            {soc.startsWith('http') ? (
                              <a
                                href={soc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 hover:underline"
                              >
                                {soc.replace(/^https?:\/\/(www\.)?/, '')}
                              </a>
                            ) : (
                              <span>{soc}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500">
                        Ninguna red social enlazada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Qué servicio ofrecer y por qué */}
              <div className="lg:col-span-5 bg-blue-50/70 border border-blue-200 rounded-md p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-blue-900">
                    Servicio recomendado para venderle
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {lead.geminiAnalysis.recommendedService.service}
                  </div>
                  <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                    {lead.geminiAnalysis.recommendedService.why}
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de comprobación y Problemas en lenguaje llano */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Checklist */}
              <div className="lg:col-span-6 border border-slate-200 rounded-md p-4">
                <h3 className="text-xs font-semibold text-slate-900 pb-2.5 border-b border-slate-200">
                  Lista de comprobación de la web
                </h3>
                <div className="mt-3 divide-y divide-slate-100 text-xs">
                  {[
                    {
                      label: 'Certificado seguro HTTPS',
                      ok: lead.geminiAnalysis.checklist.https,
                      detail: lead.geminiAnalysis.checklist.httpsDetail,
                    },
                    {
                      label: 'Adaptada a celulares y pantallas móviles',
                      ok: lead.geminiAnalysis.checklist.mobileFriendly,
                      detail:
                        lead.geminiAnalysis.checklist.mobileFriendlyDetail,
                    },
                    {
                      label: 'Botón o contacto por WhatsApp',
                      ok: lead.geminiAnalysis.checklist.whatsappButton,
                      detail: lead.geminiAnalysis.checklist.whatsappDetail,
                    },
                    {
                      label: 'Sistema de turnos o reserva online',
                      ok: lead.geminiAnalysis.checklist.onlineBooking,
                      detail: lead.geminiAnalysis.checklist.onlineBookingDetail,
                    },
                    {
                      label: 'Formulario de contacto',
                      ok: lead.geminiAnalysis.checklist.contactForm,
                      detail: lead.geminiAnalysis.checklist.contactFormDetail,
                    },
                    {
                      label: 'Web actualizada (sin avisos ni copyright antiguo)',
                      ok: !lead.geminiAnalysis.checklist.outdatedSignals,
                      detail: lead.geminiAnalysis.checklist.outdatedDetail,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="py-2 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2">
                        {item.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-slate-900">
                            {item.label}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            {item.detail}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`font-semibold shrink-0 ${
                          item.ok ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {item.ok ? 'Sí' : 'No'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entre 3 y 5 problemas explicados en lenguaje llano */}
              <div className="lg:col-span-6 border border-slate-200 rounded-md p-4">
                <h3 className="text-xs font-semibold text-slate-900 pb-2.5 border-b border-slate-200">
                  Problemas detectados (explicados en lenguaje llano para el cliente)
                </h3>
                <ol className="mt-3 space-y-2.5 text-xs text-slate-800 list-decimal list-inside">
                  {lead.geminiAnalysis.plainLanguageIssues.map((issue, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded leading-relaxed"
                    >
                      {issue}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bloque 2: Primer Contacto (3 Borradores Personalizados) */}
      {lead.outreachDrafts && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Primer Contacto Personalizado
              </h2>
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-1.5 inline-block font-medium">
                Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento
              </p>
            </div>

            {/* Selector de tono y regenerar */}
            <div className="flex flex-wrap items-center gap-2 no-print">
              <select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value as ToneOption)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    Tono: {t}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isRegenerating}
                onClick={handleRegenerateTone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-800 transition-colors cursor-pointer"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Regenerar con otro tono</span>
              </button>
            </div>
          </div>

          {/* Pestañas en pantalla con colores vivos por canal */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit no-print">
            <button
              type="button"
              onClick={() => setActiveDraftTab('whatsapp')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeDraftTab === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Mensaje de WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDraftTab('call')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeDraftTab === 'call'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50/60'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Guion de llamada (30 s)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDraftTab('email')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeDraftTab === 'email'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Correo electrónico</span>
            </button>
          </div>

          {/* Contenido de los borradores */}
          <div className="space-y-4">
            {/* WhatsApp */}
            <div
              className={`${
                activeDraftTab === 'whatsapp' ? 'block' : 'hidden print:block'
              } bg-emerald-50/70 border border-emerald-300 rounded-xl p-5 shadow-xs`}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span>1. Mensaje de WhatsApp (Tono: {lead.outreachDrafts.tone})</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      lead.outreachDrafts!.whatsappMessage,
                      'whatsapp'
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/60 rounded-md text-xs font-bold text-emerald-800 transition-colors cursor-pointer no-print"
                >
                  {copiedField === 'whatsapp' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-800 font-bold">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar mensaje</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-3.5 text-xs text-slate-900 whitespace-pre-wrap font-sans leading-relaxed bg-white/90 p-4 rounded-lg border border-emerald-200/80 shadow-2xs">
                {lead.outreachDrafts.whatsappMessage}
              </pre>
            </div>

            {/* Guion de llamada 30s */}
            <div
              className={`${
                activeDraftTab === 'call' ? 'block' : 'hidden print:block'
              } bg-blue-50/70 border border-blue-300 rounded-xl p-5 shadow-xs`}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-blue-200">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-blue-700" />
                  <span>2. Guion de llamada de 30 segundos</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(lead.outreachDrafts!.callScript30s, 'call')
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100/60 rounded-md text-xs font-bold text-blue-800 transition-colors cursor-pointer no-print"
                >
                  {copiedField === 'call' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-blue-800 font-bold">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar guion</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-3.5 text-xs text-slate-900 whitespace-pre-wrap font-sans leading-relaxed bg-white/90 p-4 rounded-lg border border-blue-200/80 shadow-2xs">
                {lead.outreachDrafts.callScript30s}
              </pre>
            </div>

            {/* Correo electrónico */}
            <div
              className={`${
                activeDraftTab === 'email' ? 'block' : 'hidden print:block'
              } bg-purple-50/70 border border-purple-300 rounded-xl p-5 space-y-3 shadow-xs`}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-purple-200">
                <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-purple-700" />
                  <span>3. Correo electrónico personalizado</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `Asunto: ${lead.outreachDrafts!.emailSubject}\n\n${
                        lead.outreachDrafts!.emailBody
                      }`,
                      'email'
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-purple-300 hover:bg-purple-100/60 rounded-md text-xs font-bold text-purple-800 transition-colors cursor-pointer no-print"
                >
                  {copiedField === 'email' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-purple-800 font-bold">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar asunto y correo</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-xs bg-white/90 p-3 rounded-lg border border-purple-200/80">
                <span className="font-bold text-purple-900">Asunto: </span>
                <span className="font-semibold text-slate-900">
                  {lead.outreachDrafts.emailSubject}
                </span>
              </div>
              <pre className="text-xs text-slate-900 whitespace-pre-wrap font-sans leading-relaxed bg-white/90 p-4 rounded-lg border border-purple-200/80 shadow-2xs">
                {lead.outreachDrafts.emailBody}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Bloque 3: Seguimiento comercial (Notas, Estado y Fecha de próxima acción) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
          Seguimiento del Lead
        </h2>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Estado del lead
            </label>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            >
              {LEAD_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Fecha de la próxima acción
            </label>
            <input
              type="date"
              value={lead.nextActionDate}
              onChange={(e) => handleNextActionDateChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-12">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notas comerciales y acuerdos
            </label>
            <textarea
              rows={4}
              value={lead.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Anota aquí con quién hablaste, qué objeciones puso, presupuesto comentado o detalles para la próxima llamada..."
              className="w-full bg-slate-50 border border-slate-300 rounded-md p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
