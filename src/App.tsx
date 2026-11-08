import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Building2,
  Compass,
  Briefcase,
  Settings as SettingsIcon,
  AlertTriangle,
  Menu,
  X,
} from 'lucide-react';
import {
  AnalysisQueueStatus,
  AppSettings,
  BusinessLead,
  ToneOption,
} from './types';
import { DEFAULT_SETTINGS, dbRepository } from './services/db';
import {
  analysisQueue,
  analyzeSingleBusinessLead,
  fetchServerConfigStatus,
  regenerateOutreachDrafts,
  searchPlacesByZoneAndNiche,
} from './services/api';
import { SearchView } from './components/SearchView';
import { BusinessDetailView } from './components/BusinessDetailView';
import { NicheRadarView } from './components/NicheRadarView';
import { MyLeadsView } from './components/MyLeadsView';
import { SettingsView } from './components/SettingsView';

type ScreenId = 'search' | 'detail' | 'radar' | 'leads' | 'settings';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('search');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Estado de configuración y claves
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasServerCloudKey, setHasServerCloudKey] = useState(false);
  const [serverMapsKey, setServerMapsKey] = useState('');

  // Estado de búsqueda actual (por defecto Córdoba Capital)
  const [zone, setZone] = useState('Córdoba Capital');
  const [niche, setNiche] = useState('talleres mecánicos');
  const [searchResults, setSearchResults] = useState<BusinessLead[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(
    undefined
  );
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Ficha activa y cartera de Mis Leads
  const [selectedLead, setSelectedLead] = useState<BusinessLead | null>(null);
  const [savedLeads, setSavedLeads] = useState<BusinessLead[]>([]);
  const [isAnalyzingSingle, setIsAnalyzingSingle] = useState(false);

  // Estado de la cola concurrente (máximo 2 análisis a la vez)
  const [queueStatus, setQueueStatus] = useState<AnalysisQueueStatus>({
    activeIds: [],
    queuedIds: [],
    completedCount: 0,
    totalCount: 0,
    currentNames: [],
  });

  // Listener global de cuota de Google Maps Platform
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const refreshSavedLeadsAndSettings = useCallback(async () => {
    const [loadedSettings, saved] = await Promise.all([
      dbRepository.getSettings(),
      dbRepository.getSavedLeads(),
    ]);
    setSettings(loadedSettings);
    setSavedLeads(saved);
  }, []);

  // Carga inicial desde IndexedDB y servidor
  useEffect(() => {
    refreshSavedLeadsAndSettings();
    fetchServerConfigStatus().then((st) => {
      setHasServerCloudKey(st.hasServerCloudKey);
      setServerMapsKey(st.mapsJsApiKey);
    });
    // Si ya hay caché para la búsqueda inicial en Córdoba Capital, cargarla sin gastar llamadas
    dbRepository
      .getSearchCache('Córdoba Capital', 'talleres mecánicos')
      .then((cached) => {
        if (cached && cached.places.length > 0) {
          setSearchResults(cached.places);
          setNextPageToken(cached.nextPageToken);
          setPagesLoaded(cached.pagesLoaded);
          setFromCache(true);
        }
      });
  }, [refreshSavedLeadsAndSettings]);

  // Suscripción a la cola de análisis (máx. 2 simultáneos)
  useEffect(() => {
    return analysisQueue.subscribe((status, updatedLead) => {
      setQueueStatus(status);
      if (updatedLead) {
        setSearchResults((prev) =>
          prev.map((item) => (item.id === updatedLead.id ? updatedLead : item))
        );
        setSelectedLead((prev) =>
          prev && prev.id === updatedLead.id ? updatedLead : prev
        );
        refreshSavedLeadsAndSettings();
      }
    });
  }, [refreshSavedLeadsAndSettings]);

  const handleRunSearch = async (
    forceRefresh = false,
    overrideZone?: string,
    overrideNiche?: string
  ) => {
    const targetZone = (overrideZone ?? zone).trim();
    const targetNiche = (overrideNiche ?? niche).trim();
    if (!targetZone || !targetNiche) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await searchPlacesByZoneAndNiche({
        zone: targetZone,
        niche: targetNiche,
        forceRefresh,
      });
      setSearchResults(result.leads);
      setNextPageToken(result.nextPageToken);
      setPagesLoaded(result.pagesLoaded);
      setFromCache(result.fromCache);
      await refreshSavedLeadsAndSettings();
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Error al buscar negocios en Places API.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || searchResults.length >= 60) return;
    setIsLoadingMore(true);
    setSearchError(null);
    try {
      const result = await searchPlacesByZoneAndNiche({
        zone,
        niche,
        pageToken: nextPageToken,
      });
      setSearchResults(result.leads);
      setNextPageToken(result.nextPageToken);
      setPagesLoaded(result.pagesLoaded);
      setFromCache(false);
      await refreshSavedLeadsAndSettings();
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Error al cargar más resultados de Places API.'
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleOpenLeadDetail = (lead: BusinessLead) => {
    setSelectedLead(lead);
    setActiveScreen('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateLead = async (updated: BusinessLead) => {
    await dbRepository.upsertLead(updated);
    setSelectedLead((prev) => (prev && prev.id === updated.id ? updated : prev));
    setSearchResults((prev) =>
      prev.map((l) => (l.id === updated.id ? updated : l))
    );
    await refreshSavedLeadsAndSettings();
  };

  const handleSaveSelectedLeads = async (leadsToSave: BusinessLead[]) => {
    const now = new Date().toISOString();
    const updatedBatch = leadsToSave.map((l) => ({
      ...l,
      isSavedLead: true,
      savedAt: l.savedAt || now,
      updatedAt: now,
    }));
    await dbRepository.upsertManyLeads(updatedBatch);
    const updatedById: Record<string, BusinessLead> = {};
    for (const item of updatedBatch) {
      updatedById[item.id] = item;
    }
    setSearchResults((prev) => prev.map((l) => updatedById[l.id] || l));
    await refreshSavedLeadsAndSettings();
  };

  const handleAnalyzeSelectedLeads = (leadsToAnalyze: BusinessLead[]) => {
    analysisQueue.enqueue(leadsToAnalyze);
  };

  const handleAnalyzeSingleLead = async (lead: BusinessLead) => {
    setIsAnalyzingSingle(true);
    try {
      const updated = await analyzeSingleBusinessLead(lead);
      setSelectedLead(updated);
      setSearchResults((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      );
      await refreshSavedLeadsAndSettings();
    } finally {
      setIsAnalyzingSingle(false);
    }
  };

  const handleRegenerateDrafts = async (
    lead: BusinessLead,
    tone: ToneOption
  ) => {
    const updated = await regenerateOutreachDrafts(
      lead,
      tone,
      settings.sellerProfile
    );
    setSelectedLead(updated);
    setSearchResults((prev) =>
      prev.map((l) => (l.id === updated.id ? updated : l))
    );
    await refreshSavedLeadsAndSettings();
  };

  const handleRemoveFromSaved = async (lead: BusinessLead) => {
    const updated: BusinessLead = {
      ...lead,
      isSavedLead: false,
    };
    await handleUpdateLead(updated);
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await dbRepository.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleOpenNicheFromRadar = (radarZone: string, radarNiche: string) => {
    setZone(radarZone);
    setNiche(radarNiche);
    setActiveScreen('search');
    handleRunSearch(false, radarZone, radarNiche);
  };

  const currentMonthKey = dbRepository.getCurrentMonthKey();
  const currentMonthCalls = settings.placesUsageByMonth[currentMonthKey] || 0;
  const monthlyLimit = settings.monthlyPlacesLimit || 1000;
  const warningThreshold = Math.round(monthlyLimit * 0.8);
  const isNearQuotaLimit = currentMonthCalls >= warningThreshold;

  const effectiveMapsApiKey =
    settings.googleCloudApiKey.trim() ||
    serverMapsKey ||
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    '';

  const navItems: Array<{
    id: ScreenId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    count?: number;
  }> = [
    { id: 'search', label: 'Buscar', icon: Search, iconColor: 'text-sky-400' },
    { id: 'detail', label: 'Ficha del negocio', icon: Building2, iconColor: 'text-amber-400' },
    { id: 'radar', label: 'Radar de nichos', icon: Compass, iconColor: 'text-emerald-400' },
    {
      id: 'leads',
      label: 'Mis leads',
      icon: Briefcase,
      iconColor: 'text-rose-400',
      count: savedLeads.length,
    },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon, iconColor: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/90 text-slate-900">
      {/* Aviso superior de cuota de Google Maps Platform */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm no-print">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Menú Lateral Fijo (Escritorio) con diseño moderno y profundo */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0b1329] text-slate-300 border-r border-slate-800/80 shadow-lg no-print">
          <div className="px-5 py-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white font-display flex items-center gap-1.5">
                <span>Radar de Clientes</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Córdoba Capital</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-white/20'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.iconColor}`} />
                    <span>{item.label}</span>
                  </div>
                  {typeof item.count === 'number' && (
                    <span
                      className={`font-mono tabular-nums text-xs px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Resumen mensual de llamadas a Places en barra lateral */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 m-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center gap-1">
                <span>Places API</span>
                <span className="text-[10px] text-slate-400 font-mono">({currentMonthKey})</span>
              </span>
              <span
                className={`font-mono tabular-nums font-bold ${
                  isNearQuotaLimit ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {currentMonthCalls} / {monthlyLimit}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className={`h-full rounded-full transition-all ${
                  currentMonthCalls >= monthlyLimit
                    ? 'bg-red-500'
                    : isNearQuotaLimit
                    ? 'bg-amber-400'
                    : 'bg-gradient-to-r from-emerald-400 to-blue-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((currentMonthCalls / monthlyLimit) * 100)
                  )}%`,
                }}
              />
            </div>
            {isNearQuotaLimit && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-300 pt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Has superado las {warningThreshold} llamadas del mes.
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Cabecera Móvil */}
        <header className="lg:hidden bg-[#0b1329] text-white border-b border-slate-800 px-4 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white">
              <Compass className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold tracking-tight text-white font-display">
              Radar de Clientes
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </header>

        {mobileMenuOpen && (
          <nav className="lg:hidden bg-[#0b1329] border-b border-slate-800 px-4 py-3 space-y-1.5 no-print">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveScreen(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${item.iconColor}`} />
                    <span>{item.label}</span>
                  </div>
                  {typeof item.count === 'number' && (
                    <span className="font-mono tabular-nums text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Área de Contenido Principal */}
        <main className="flex-1 lg:pl-64">
          {/* Barra superior contextual */}
          <div className="bg-white border-b border-slate-200/90 shadow-2xs px-6 py-3.5 flex items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500">Radar</span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                {navItems.find((n) => n.id === activeScreen)?.label}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 ml-1">
                📍 {zone}
              </span>
              {activeScreen === 'detail' && selectedLead && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-700 font-medium truncate max-w-xs">
                    {selectedLead.displayName}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveScreen('leads')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                <Briefcase className="w-3.5 h-3.5 text-rose-500" />
                <span>Mis leads ({savedLeads.length})</span>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
            {activeScreen === 'search' && (
              <SearchView
                zone={zone}
                niche={niche}
                onZoneChange={setZone}
                onNicheChange={setNiche}
                leads={searchResults}
                nextPageToken={nextPageToken}
                pagesLoaded={pagesLoaded}
                fromCache={fromCache}
                isLoading={isSearching}
                isLoadingMore={isLoadingMore}
                error={searchError}
                onSearch={(force) => handleRunSearch(force)}
                onLoadMore={handleLoadMore}
                onSelectLead={handleOpenLeadDetail}
                onSaveSelectedLeads={handleSaveSelectedLeads}
                onAnalyzeSelectedLeads={handleAnalyzeSelectedLeads}
                queueStatus={queueStatus}
                mapsApiKey={effectiveMapsApiKey}
              />
            )}

            {activeScreen === 'detail' &&
              (selectedLead ? (
                <BusinessDetailView
                  lead={selectedLead}
                  onBack={() => setActiveScreen('search')}
                  onUpdateLead={handleUpdateLead}
                  onAnalyzeLead={handleAnalyzeSingleLead}
                  onRegenerateDrafts={handleRegenerateDrafts}
                  isAnalyzing={
                    isAnalyzingSingle ||
                    queueStatus.activeIds.includes(selectedLead.id) ||
                    queueStatus.queuedIds.includes(selectedLead.id)
                  }
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Ningún negocio seleccionado
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Selecciona cualquier negocio desde la pantalla «Buscar» o desde «Mis leads» para ver su ficha detallada, analizar su página web y generar los borradores de primer contacto.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveScreen('search')}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Ir a Buscar negocios
                    </button>
                    {savedLeads.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveScreen('leads')}
                        className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-md cursor-pointer"
                      >
                        Ver Mis leads ({savedLeads.length})
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {activeScreen === 'radar' && (
              <NicheRadarView
                initialZone={zone}
                sellerProfile={settings.sellerProfile}
                onOpenNicheInSearch={handleOpenNicheFromRadar}
                onUsageUpdated={refreshSavedLeadsAndSettings}
              />
            )}

            {activeScreen === 'leads' && (
              <MyLeadsView
                savedLeads={savedLeads}
                onSelectLead={handleOpenLeadDetail}
                onUpdateLead={handleUpdateLead}
                onRemoveFromSaved={handleRemoveFromSaved}
              />
            )}

            {activeScreen === 'settings' && (
              <SettingsView
                settings={settings}
                hasServerCloudKey={hasServerCloudKey}
                onSaveSettings={handleSaveSettings}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
