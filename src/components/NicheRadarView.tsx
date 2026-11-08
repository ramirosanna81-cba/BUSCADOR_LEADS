import React, { useEffect, useState } from 'react';
import {
  Compass,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import {
  NicheCategoryMetrics,
  NicheRadarReport,
  SUGGESTED_NICHES,
  SellerProfile,
} from '../types';
import { dbRepository } from '../services/db';
import {
  generateNicheRadarWithGemini,
  searchPlacesByZoneAndNiche,
} from '../services/api';

interface NicheRadarViewProps {
  initialZone: string;
  sellerProfile: SellerProfile;
  onOpenNicheInSearch: (zone: string, niche: string) => void;
  onUsageUpdated: () => Promise<void>;
}

export const NicheRadarView: React.FC<NicheRadarViewProps> = ({
  initialZone,
  sellerProfile,
  onOpenNicheInSearch,
  onUsageUpdated,
}) => {
  const [zone, setZone] = useState(initialZone || 'Córdoba Capital');
  const [categories, setCategories] = useState<string[]>([...SUGGESTED_NICHES]);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Estado de pre-confirmación de llamadas a Places
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    totalCategories: number;
    cachedCount: number;
    callsToSpend: number;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentNiche: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<NicheRadarReport | null>(null);

  useEffect(() => {
    if (zone.trim()) {
      dbRepository.getNicheReport(zone).then((existing) => {
        if (existing) {
          setReport(existing);
        }
      });
    }
  }, [zone]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryInput.trim().toLowerCase();
    if (!clean) return;
    if (!categories.some((c) => c.toLowerCase() === clean)) {
      setCategories((prev) => [...prev, clean]);
    }
    setNewCategoryInput('');
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  const handleRestoreDefaultCategories = () => {
    setCategories([...SUGGESTED_NICHES]);
  };

  const handlePrepareScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone.trim() || categories.length === 0) return;
    setError(null);

    let cachedCount = 0;
    for (const niche of categories) {
      const cached = await dbRepository.getSearchCache(zone.trim(), niche);
      if (cached && cached.places.length > 0) {
        cachedCount += 1;
      }
    }

    const callsToSpend = categories.length - cachedCount;
    setConfirmModal({
      open: true,
      totalCategories: categories.length,
      cachedCount,
      callsToSpend,
    });
  };

  const handleConfirmAndExecuteScan = async () => {
    if (!confirmModal) return;
    setConfirmModal(null);
    setIsScanning(true);
    setError(null);

    const metricsList: NicheCategoryMetrics[] = [];

    try {
      for (let i = 0; i < categories.length; i++) {
        const niche = categories[i];
        setScanProgress({
          current: i + 1,
          total: categories.length,
          currentNiche: niche,
        });

        const res = await searchPlacesByZoneAndNiche({
          zone: zone.trim(),
          niche,
          forceRefresh: false,
        });

        await onUsageUpdated();

        const operational = res.leads.filter(
          (l) => !l.businessStatus || l.businessStatus === 'OPERATIONAL'
        );
        const totalBusinesses = operational.length;
        const withoutOwnWebCount = operational.filter(
          (l) => l.webClassification !== 'own_website'
        ).length;
        const withoutOwnWebPercent =
          totalBusinesses > 0
            ? Math.round((withoutOwnWebCount / totalBusinesses) * 100)
            : 0;

        const rated = operational.filter((l) => typeof l.rating === 'number');
        const avgRating =
          rated.length > 0
            ? Number(
                (
                  rated.reduce((acc, l) => acc + (l.rating || 0), 0) /
                  rated.length
                ).toFixed(2)
              )
            : 0;

        const avgReviews =
          totalBusinesses > 0
            ? Math.round(
                operational.reduce(
                  (acc, l) => acc + (l.userRatingCount || 0),
                  0
                ) / totalBusinesses
              )
            : 0;

        metricsList.push({
          niche,
          totalBusinesses,
          withoutOwnWebCount,
          withoutOwnWebPercent,
          avgRating,
          avgReviews,
          fromCache: res.fromCache,
        });
      }

      setScanProgress({
        current: categories.length,
        total: categories.length,
        currentNiche: 'Clasificando oportunidades con Gemini Flash...',
      });

      const generatedReport = await generateNicheRadarWithGemini({
        zone: zone.trim(),
        categories: metricsList,
        sellerProfile,
      });

      setReport(generatedReport);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error durante el análisis del Radar de nichos.'
      );
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuración del Radar */}
      <div className="bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200/90 rounded-xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <Compass className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Radar de Nichos por Zona
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Analiza múltiples sectores en una localidad, calcula el porcentaje real de negocios sin web propia y deja que Gemini te recomiende los 3 nichos más rentables.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestoreDefaultCategories}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline self-start md:self-auto cursor-pointer"
          >
            Restaurar las 14 sugerencias
          </button>
        </div>

        <form onSubmit={handlePrepareScan} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-8">
              <label
                htmlFor="radar-zone"
                className="block text-xs font-bold text-slate-800 mb-1.5"
              >
                Zona a escanear (ciudad, barrio o código postal)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="radar-zone"
                  type="text"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="Ej. Córdoba Capital / Nueva Córdoba / Centro / 14001"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="lg:col-span-4">
              <button
                type="submit"
                disabled={isScanning || !zone.trim() || categories.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analizando nichos...</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    <span>Analizar {categories.length} categorías en la zona</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Lista editable de categorías */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Categorías incluidas en el barrido ({categories.length}):
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <div
                key={cat}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-800"
              >
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  title={`Quitar ${cat}`}
                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddCategory}
            className="flex items-center gap-2 max-w-md pt-1"
          >
            <input
              type="text"
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              placeholder="Añadir otra categoría (ej. abogados, fontaneros...)"
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir nicho</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal de confirmación de llamadas a Places */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Confirmar consumo de llamadas a Places API
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vas a analizar <strong>{confirmModal.totalCategories}</strong> categorías en{' '}
              <strong>«{zone}»</strong>:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Categorías ya en caché (0 llamadas):</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {confirmModal.cachedCount}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-900">
                  Llamadas nuevas a Places API que se gastarán:
                </span>
                <span className="font-mono tabular-nums text-sm font-bold text-blue-700">
                  {confirmModal.callsToSpend} llamadas
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndExecuteScan}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
              >
                Confirmar y ejecutar ({confirmModal.callsToSpend} llamadas)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de progreso durante el barrido */}
      {isScanning && scanProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-blue-950">
            <div className="flex items-center gap-2 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
              <span>Procesando: {scanProgress.currentNiche}</span>
            </div>
            <span className="font-mono tabular-nums">
              {scanProgress.current} / {scanProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-700 h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (scanProgress.current / scanProgress.total) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
            <div className="font-semibold">Error en el Radar de nichos</div>
            <div className="mt-1 font-mono">{error}</div>
          </div>
        </div>
      )}

      {/* Resultados del Radar de Nichos */}
      {report && !isScanning && (
        <div className="space-y-6">
          {/* Top 3 Recomendaciones de Gemini */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Estrategia recomendada por Gemini para {report.zone}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Los 3 nichos con mayor oportunidad comercial
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-4xl">
                  {report.topThreeSummary}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {report.rankedRecommendations.slice(0, 3).map((rec, idx) => {
                const stats = report.categories.find(
                  (c) => c.niche.toLowerCase() === rec.niche.toLowerCase()
                );

                const podiumStyles = [
                  {
                    card: 'bg-gradient-to-b from-amber-50/70 via-white to-amber-50/20 border-2 border-amber-400 ring-1 ring-amber-300/50 shadow-sm',
                    badge: 'bg-amber-500 text-white font-bold',
                    btn: 'bg-amber-600 hover:bg-amber-700 text-white font-semibold',
                    tag: 'bg-amber-100 text-amber-900 border-amber-300',
                  },
                  {
                    card: 'bg-gradient-to-b from-sky-50/70 via-white to-sky-50/20 border-2 border-sky-400 ring-1 ring-sky-300/50 shadow-sm',
                    badge: 'bg-sky-600 text-white font-bold',
                    btn: 'bg-sky-700 hover:bg-sky-800 text-white font-semibold',
                    tag: 'bg-sky-100 text-sky-900 border-sky-300',
                  },
                  {
                    card: 'bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/20 border-2 border-emerald-400 ring-1 ring-emerald-300/50 shadow-sm',
                    badge: 'bg-emerald-600 text-white font-bold',
                    btn: 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold',
                    tag: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                  },
                ][idx] || {
                  card: 'bg-slate-50 border border-slate-200',
                  badge: 'bg-blue-600 text-white font-bold',
                  btn: 'bg-slate-900 hover:bg-slate-800 text-white',
                  tag: 'bg-slate-100 text-slate-800 border-slate-200',
                };

                return (
                  <div
                    key={rec.niche}
                    className={`rounded-xl p-5 flex flex-col justify-between transition-all duration-150 hover:shadow-md ${podiumStyles.card}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${podiumStyles.badge}`}>
                          #{idx + 1} TOP OPORTUNIDAD
                        </span>
                        <span className="font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[11px]">
                          {rec.opportunityLevel}
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-slate-900 capitalize">
                        {rec.niche}
                      </h4>

                      {stats && (
                        <div className="text-xs text-slate-600 font-mono tabular-nums bg-white/80 p-2 rounded-lg border border-slate-200/60">
                          {stats.totalBusinesses} negocios en zona ·{' '}
                          <strong className="text-rose-700 font-bold">
                            {stats.withoutOwnWebPercent}% sin web propia
                          </strong>{' '}
                          · {stats.avgRating} ★ ({stats.avgReviews} reseñas/med)
                        </div>
                      )}

                      <div className="pt-2 text-xs space-y-1.5">
                        <div>
                          <span className="font-bold text-slate-800">
                            Servicio ideal a vender:{' '}
                          </span>
                          <span className="text-blue-700 font-semibold">
                            {rec.recommendedService}
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {rec.whyOpportunity}
                        </p>
                        <p className="text-slate-700 italic bg-white/70 p-2 rounded border border-slate-200/50">
                          «{rec.salesAngle}»
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenNicheInSearch(report.zone, rec.niche)}
                      className={`mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg shadow-xs transition-colors cursor-pointer ${podiumStyles.btn}`}
                    >
                      <span>Ver negocios de {rec.niche} en {report.zone}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla completa ordenada por oportunidad */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Clasificación Completa de Categorías en {report.zone}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordenadas por Gemini de mayor a menor oportunidad comercial
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Categoría / Nicho</th>
                    <th className="py-2.5 px-3 text-right">Negocios</th>
                    <th className="py-2.5 px-3 text-right">% Sin web propia</th>
                    <th className="py-2.5 px-3 text-right">Valoración media</th>
                    <th className="py-2.5 px-3 text-right">Media reseñas</th>
                    <th className="py-2.5 px-3">Servicio ideal a vender</th>
                    <th className="py-2.5 px-3">Por qué atacar este nicho</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {report.rankedRecommendations.map((rec, index) => {
                    const stats =
                      report.categories.find(
                        (c) => c.niche.toLowerCase() === rec.niche.toLowerCase()
                      ) || {
                        niche: rec.niche,
                        totalBusinesses: 0,
                        withoutOwnWebCount: 0,
                        withoutOwnWebPercent: 0,
                        avgRating: 0,
                        avgReviews: 0,
                        fromCache: true,
                      };

                    return (
                      <tr key={rec.niche} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono tabular-nums font-semibold text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 capitalize">
                          {rec.niche}
                          <div className="text-[11px] font-normal text-slate-500">
                            Oportunidad {rec.opportunityLevel}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {stats.totalBusinesses}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              stats.withoutOwnWebPercent >= 40
                                ? 'text-emerald-700'
                                : stats.withoutOwnWebPercent >= 20
                                ? 'text-amber-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {stats.withoutOwnWebPercent}%
                          </span>
                          <span className="text-slate-400 ml-1">
                            ({stats.withoutOwnWebCount})
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {stats.avgRating > 0 ? `${stats.avgRating} ★` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {stats.avgReviews}
                        </td>
                        <td className="py-3 px-3 font-medium text-blue-800 max-w-[180px]">
                          {rec.recommendedService}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                          {rec.whyOpportunity}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenNicheInSearch(report.zone, rec.niche)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                          >
                            <span>Ver negocios</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
