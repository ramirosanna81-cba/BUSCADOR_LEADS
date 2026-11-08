import React, { useMemo, useState } from 'react';
import {
  Search,
  Phone,
  Globe,
  ExternalLink,
  BookmarkPlus,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Loader2,
  MapPin,
  LayoutGrid,
  Table as TableIcon,
  Map as MapIcon,
  CheckSquare,
  Square,
  ChevronDown,
} from 'lucide-react';
import {
  AnalysisQueueStatus,
  BusinessLead,
  NICHE_GROUPS,
  SUGGESTED_NICHES,
} from '../types';
import { ScoreBadge } from './ScoreBadge';
import { SearchMapView } from './SearchMapView';

interface SearchViewProps {
  zone: string;
  niche: string;
  onZoneChange: (zone: string) => void;
  onNicheChange: (niche: string) => void;
  leads: BusinessLead[];
  nextPageToken?: string;
  pagesLoaded: number;
  fromCache: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  onSearch: (forceRefresh?: boolean) => void;
  onLoadMore: () => void;
  onSelectLead: (lead: BusinessLead) => void;
  onSaveSelectedLeads: (leadsToSave: BusinessLead[]) => Promise<void>;
  onAnalyzeSelectedLeads: (leadsToAnalyze: BusinessLead[]) => void;
  queueStatus: AnalysisQueueStatus;
  mapsApiKey: string;
}

export const SearchView: React.FC<SearchViewProps> = ({
  zone,
  niche,
  onZoneChange,
  onNicheChange,
  leads,
  nextPageToken,
  pagesLoaded,
  fromCache,
  isLoading,
  isLoadingMore,
  error,
  onSearch,
  onLoadMore,
  onSelectLead,
  onSaveSelectedLeads,
  onAnalyzeSelectedLeads,
  queueStatus,
  mapsApiKey,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'map'>('table');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [savingBatch, setSavingBatch] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');

  // Filtros en cliente
  const [onlyWithoutOwnWeb, setOnlyWithoutOwnWeb] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [minReviews, setMinReviews] = useState<number>(0);
  const [hideClosed, setHideClosed] = useState(true);

  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        if (hideClosed && lead.businessStatus && lead.businessStatus !== 'OPERATIONAL') {
          return false;
        }
        if (onlyWithoutOwnWeb && lead.webClassification === 'own_website') {
          return false;
        }
        if (
          onlyWithPhone &&
          !lead.nationalPhoneNumber &&
          !lead.internationalPhoneNumber
        ) {
          return false;
        }
        if (minRating > 0 && (lead.rating || 0) < minRating) {
          return false;
        }
        if (minReviews > 0 && (lead.userRatingCount || 0) < minReviews) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.opportunityScore.total - a.opportunityScore.total);
  }, [
    leads,
    hideClosed,
    onlyWithoutOwnWeb,
    onlyWithPhone,
    minRating,
    minReviews,
  ]);

  const selectedLeads = useMemo(
    () => filteredLeads.filter((l) => selectedIds[l.id]),
    [filteredLeads, selectedIds]
  );

  const allFilteredSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((l) => Boolean(selectedIds[l.id]));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      for (const l of filteredLeads) {
        next[l.id] = true;
      }
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleBatchSave = async () => {
    if (selectedLeads.length === 0) return;
    setSavingBatch(true);
    try {
      await onSaveSelectedLeads(selectedLeads);
    } finally {
      setSavingBatch(false);
    }
  };

  const handleBatchAnalyze = () => {
    if (selectedLeads.length === 0) return;
    onAnalyzeSelectedLeads(selectedLeads);
  };

  const renderWebColumn = (lead: BusinessLead) => {
    if (lead.webClassification === 'no_website') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          Sin web
        </span>
      );
    }
    if (lead.webClassification === 'social_or_directory') {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Sin web propia
          </span>
          {lead.websiteUri && (
            <a
              href={lead.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 hover:underline truncate max-w-[160px]"
            >
              <span>{lead.detectedPlatform || 'Perfil externo'}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
        </div>
      );
    }

    return (
      <a
        href={lead.websiteUri}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline truncate max-w-[180px]"
      >
        <Globe className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
        <span className="truncate">
          {lead.websiteUri?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
        </span>
      </a>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Búsqueda */}
      <div className="bg-white border-t-4 border-t-blue-600 border-x border-b border-slate-200/90 rounded-xl p-5 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(false);
          }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end"
        >
          <div className="lg:col-span-5">
            <label
              htmlFor="input-zone"
              className="block text-xs font-bold text-slate-800 mb-1.5"
            >
              Zona (ciudad, barrio o código postal)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-zone"
                type="text"
                value={zone}
                onChange={(e) => onZoneChange(e.target.value)}
                placeholder="Ej. Córdoba Capital, Argentina / Nueva Córdoba / Cerro de las Rosas / Centro"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="lg:col-span-5">
            <label
              htmlFor="input-niche"
              className="block text-xs font-bold text-slate-800 mb-1.5"
            >
              Nicho o actividad del negocio
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-niche"
                type="text"
                value={niche}
                onChange={(e) => onNicheChange(e.target.value)}
                placeholder="Ej. canchas de fútbol 5, carnicerías, barberías, lomiterías..."
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading || !zone.trim() || !niche.trim()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sugerencias de nichos agrupadas por rubro */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Nichos sugeridos para Córdoba Capital (elegí para autocompletar):</span>
            </div>

            {/* Pestañas de categorías de rubros */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('all')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                  selectedCategoryTab === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              {NICHE_GROUPS.map((group) => (
                <button
                  key={group.groupName}
                  type="button"
                  onClick={() => setSelectedCategoryTab(group.groupName)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                    selectedCategoryTab === group.groupName
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {group.groupName}
                </button>
              ))}
            </div>
          </div>

          {/* Chips de nichos según categoría seleccionada */}
          <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
            {(selectedCategoryTab === 'all'
              ? SUGGESTED_NICHES
              : NICHE_GROUPS.find((g) => g.groupName === selectedCategoryTab)?.items || []
            ).map((sug) => {
              const active = niche.trim().toLowerCase() === sug.toLowerCase();
              return (
                <button
                  key={sug}
                  type="button"
                  onClick={() => onNicheChange(sug)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs ring-1 ring-blue-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                  }`}
                >
                  {sug}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Barra de progreso de la cola de análisis (máximo 2 en paralelo) */}
      {(queueStatus.activeIds.length > 0 || queueStatus.queuedIds.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 text-blue-700 animate-spin shrink-0" />
            <div className="text-xs text-blue-950">
              <span className="font-semibold">
                Analizando webs (máx. 2 en paralelo):
              </span>{' '}
              {queueStatus.currentNames.join(' y ')}
              <span className="mx-1.5 text-blue-400">·</span>
              <span className="font-mono tabular-nums">
                {queueStatus.completedCount} de {queueStatus.totalCount} completados
              </span>
            </div>
          </div>
          <div className="w-full sm:w-48 bg-blue-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-700 h-full transition-all duration-300"
              style={{
                width: `${
                  queueStatus.totalCount > 0
                    ? Math.round((queueStatus.completedCount / queueStatus.totalCount) * 100)
                    : 10
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Mensaje de error real de la API */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <div className="font-semibold">Error en la consulta</div>
            <div className="mt-1 font-mono text-xs break-words">{error}</div>
          </div>
        </div>
      )}

      {/* Barra de Filtros y Conmutador de Vista */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithoutOwnWeb}
              onChange={(e) => setOnlyWithoutOwnWeb(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="font-medium">Solo sin web propia</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithPhone}
              onChange={(e) => setOnlyWithPhone(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="font-medium">Solo con teléfono</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideClosed}
              onChange={(e) => setHideClosed(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="font-medium">Ocultar cerrados</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Valoración mín.:</span>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-800"
            >
              <option value={0}>Todas</option>
              <option value={3.5}>≥ 3.5 ★</option>
              <option value={4.0}>≥ 4.0 ★</option>
              <option value={4.5}>≥ 4.5 ★</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Reseñas mín.:</span>
            <select
              value={minReviews}
              onChange={(e) => setMinReviews(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-800"
            >
              <option value={0}>Todas</option>
              <option value={5}>≥ 5</option>
              <option value={15}>≥ 15</option>
              <option value={30}>≥ 30</option>
              <option value={50}>≥ 50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between xl:justify-end gap-3 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          {fromCache && leads.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Cargado de caché (0 llamadas)</span>
              <button
                type="button"
                onClick={() => onSearch(true)}
                title="Repetir llamada a Places API para actualizar datos"
                className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Actualizar</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabla</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Mapa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Selección Múltiple */}
      {filteredLeads.length > 0 && (
        <div className="bg-slate-900 text-white rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white font-medium cursor-pointer"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {allFilteredSelected
                  ? 'Deseleccionar todos'
                  : `Seleccionar todos (${filteredLeads.length})`}
              </span>
            </button>
            <span className="text-slate-600">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              {selectedLeads.length} seleccionados de {filteredLeads.length} mostrados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedLeads.length === 0 || savingBatch}
              onClick={handleBatchSave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-medium rounded border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Guardar en mis leads ({selectedLeads.length})</span>
            </button>

            <button
              type="button"
              disabled={selectedLeads.length === 0}
              onClick={handleBatchAnalyze}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analizar seleccionados ({selectedLeads.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Estado de carga inicial */}
      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 bg-slate-100 rounded animate-pulse w-full"
            />
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && filteredLeads.length === 0 && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {leads.length === 0
              ? 'Busca negocios en Córdoba Capital o tu zona para empezar'
              : 'Ningún negocio coincide con los filtros activos'}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            {leads.length === 0
              ? 'Escribe una localidad o código postal (por ejemplo, «Córdoba Capital») y elige un nicho para descubrir clientes potenciales y auditar sus páginas web.'
              : 'Prueba a relajar los filtros de valoración, reseñas o situación web para ver todos los resultados obtenidos.'}
          </p>
        </div>
      )}

      {/* Resultados en TABLA */}
      {!isLoading && filteredLeads.length > 0 && viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3 w-9">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-700"
                    />
                  </th>
                  <th className="py-2.5 px-3">Negocio y actividad</th>
                  <th className="py-2.5 px-3">Dirección</th>
                  <th className="py-2.5 px-3">Teléfono</th>
                  <th className="py-2.5 px-3">Página web</th>
                  <th className="py-2.5 px-3 text-right">Valoración</th>
                  <th className="py-2.5 px-3">Oportunidad</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredLeads.map((lead) => {
                  const isAnalyzing =
                    queueStatus.activeIds.includes(lead.id) ||
                    queueStatus.queuedIds.includes(lead.id);
                  const phone =
                    lead.nationalPhoneNumber || lead.internationalPhoneNumber;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedIds[lead.id])}
                          onChange={() => toggleSelectOne(lead.id)}
                          className="rounded border-slate-300 text-blue-700"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {lead.displayName}
                        </div>
                        <div className="text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{lead.primaryTypeDisplayName}</span>
                          {lead.googleMapsUri && (
                            <>
                              <span>·</span>
                              <a
                                href={lead.googleMapsUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-slate-500 hover:text-blue-700 hover:underline"
                              >
                                <span>Maps</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate">
                        {lead.formattedAddress}
                      </td>

                      <td
                        className="py-2.5 px-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {phone ? (
                          <a
                            href={`tel:${phone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-800 hover:text-blue-700 font-medium"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">Sin teléfono</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {renderWebColumn(lead)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {typeof lead.rating === 'number' ? (
                          <div>
                            <span className="font-semibold text-slate-900">
                              {lead.rating.toFixed(1)} ★
                            </span>
                            <span className="text-slate-500 ml-1">
                              ({lead.userRatingCount})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Sin reseñas</span>
                        )}
                      </td>

                      <td
                        className="py-2.5 px-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ScoreBadge score={lead.opportunityScore} />
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isAnalyzing ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Analizando...</span>
                          </span>
                        ) : (
                          <div className="text-slate-700">
                            <span className="font-medium">{lead.status}</span>
                            {lead.isSavedLead && (
                              <span className="text-slate-400 ml-1">
                                · Guardado
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectLead(lead)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors cursor-pointer"
                        >
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultados en TARJETAS */}
      {!isLoading && filteredLeads.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const phone =
              lead.nationalPhoneNumber || lead.internationalPhoneNumber;
            const isSelected = Boolean(selectedIds[lead.id]);
            const isAnalyzing =
              queueStatus.activeIds.includes(lead.id) ||
              queueStatus.queuedIds.includes(lead.id);

            const score = lead.opportunityScore.total;
            const borderTopClass =
              score >= 70
                ? 'border-t-4 border-t-emerald-500'
                : score >= 45
                ? 'border-t-4 border-t-amber-500'
                : 'border-t-4 border-t-rose-400';

            return (
              <div
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`bg-white border rounded-xl p-4 transition-all duration-150 cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${borderTopClass} ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelectOne(lead.id)}
                        className="mt-1 rounded border-slate-300 text-blue-700 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {lead.displayName}
                        </h3>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-700">{lead.primaryTypeDisplayName}</span>
                          <span>·</span>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {lead.status}
                          </span>
                          {lead.isSavedLead && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              ★ En mis leads
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="text-slate-600 truncate flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{lead.formattedAddress}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Teléfono:</span>
                      {phone ? (
                        <a
                          href={`tel:${phone.replace(/\s+/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono tabular-nums font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-blue-500" />
                          <span>{phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Sin teléfono</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Web:</span>
                      <div>{renderWebColumn(lead)}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Reseñas Maps:</span>
                      <span className="font-mono tabular-nums text-slate-800">
                        {typeof lead.rating === 'number' ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-amber-500 font-bold">★ {lead.rating.toFixed(1)}</span>
                            <span className="text-slate-500">({lead.userRatingCount})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin reseñas</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div onClick={(e) => e.stopPropagation()}>
                    <ScoreBadge score={lead.opportunityScore} />
                  </div>

                  <div className="flex items-center gap-2">
                    {lead.googleMapsUri && (
                      <a
                        href={lead.googleMapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-blue-700 hover:bg-slate-50 border border-slate-200 rounded transition-colors"
                      >
                        Maps
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLead(lead);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      {isAnalyzing ? 'Analizando...' : 'Abrir ficha'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resultados en MAPA */}
      {!isLoading && filteredLeads.length > 0 && viewMode === 'map' && (
        <SearchMapView
          leads={filteredLeads}
          apiKey={mapsApiKey}
          onSelectLead={onSelectLead}
        />
      )}

      {/* Botón Cargar Más (hasta 60 resultados por búsqueda) */}
      {!isLoading && nextPageToken && leads.length < 60 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 shadow-2xs transition-colors cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                <span>Cargando siguientes 20 negocios...</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-slate-500" />
                <span>
                  Cargar más resultados ({leads.length} de máx. 60 cargados · página{' '}
                  {pagesLoaded + 1}/3)
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
