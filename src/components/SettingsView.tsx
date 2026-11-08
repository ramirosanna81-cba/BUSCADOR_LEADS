import React, { useState } from 'react';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  UserCheck,
  BarChart3,
  Trash2,
  Loader2,
} from 'lucide-react';
import { AppSettings, TONE_OPTIONS, ToneOption } from '../types';
import { dbRepository } from '../services/db';
import { testGoogleCloudKey } from '../services/api';

interface SettingsViewProps {
  settings: AppSettings;
  hasServerCloudKey: boolean;
  onSaveSettings: (newSettings: AppSettings) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  hasServerCloudKey,
  onSaveSettings,
}) => {
  const [googleCloudApiKey, setGoogleCloudApiKey] = useState(
    settings.googleCloudApiKey || ''
  );
  const [sellerName, setSellerName] = useState(settings.sellerProfile.name);
  const [servicesOffered, setServicesOffered] = useState(
    settings.sellerProfile.servicesOffered
  );
  const [valueProposition, setValueProposition] = useState(
    settings.sellerProfile.valueProposition
  );
  const [defaultTone, setDefaultTone] = useState<ToneOption>(
    settings.sellerProfile.defaultTone
  );
  const [monthlyPlacesLimit, setMonthlyPlacesLimit] = useState<number>(
    settings.monthlyPlacesLimit || 1000
  );

  const [savedNotice, setSavedNotice] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);

  const currentMonthKey = dbRepository.getCurrentMonthKey();
  const currentMonthCalls = settings.placesUsageByMonth[currentMonthKey] || 0;
  const warningThreshold = Math.round(monthlyPlacesLimit * 0.8); // 800 cuando el límite es 1000
  const isNearLimit = currentMonthCalls >= warningThreshold;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      googleCloudApiKey: googleCloudApiKey.trim(),
      monthlyPlacesLimit: Math.max(1, monthlyPlacesLimit),
      sellerProfile: {
        name: sellerName.trim(),
        servicesOffered: servicesOffered.trim(),
        valueProposition: valueProposition.trim(),
        defaultTone,
      },
    };
    await onSaveSettings(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setKeyTestResult(null);
    try {
      const res = await testGoogleCloudKey(googleCloudApiKey);
      setKeyTestResult({ ok: true, message: res.message });
    } catch (err) {
      setKeyTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo validar la clave de Google Cloud.',
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleResetMonthCounter = async () => {
    const updated: AppSettings = {
      ...settings,
      placesUsageByMonth: {
        ...settings.placesUsageByMonth,
        [currentMonthKey]: 0,
      },
    };
    await onSaveSettings(updated);
  };

  const handleClearSearchCache = async () => {
    await dbRepository.clearSearchCache();
    setCacheClearedNotice(true);
    setTimeout(() => setCacheClearedNotice(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Perfil de Vendedor */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <UserCheck className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Mi Perfil de Vendedor
              </h2>
              <p className="text-xs text-slate-500">
                Estos datos se inyectan en Gemini para redactar a medida el guion de llamada, el WhatsApp y el correo de cada negocio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tu nombre o nombre de tu estudio / agencia
              </label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Ej. Ramiro Sanna"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tono preferido por defecto para los borradores
              </label>
              <select
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value as ToneOption)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ¿Qué servicios vendés?
              </label>
              <textarea
                rows={2}
                value={servicesOffered}
                onChange={(e) => setServicesOffered(e.target.value)}
                placeholder="Ej. Páginas web rápidas adaptadas a celulares, agentes de IA para WhatsApp que responden 24/7 y sistemas automáticos para sacar turnos online."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tu propuesta de valor y diferencial
              </label>
              <textarea
                rows={2}
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                placeholder="Ej. Entregamos la página web o el agente de WhatsApp funcionando en 10 días, enfocados 100% en que el celu suene y entren turnos o consultas de clientes de la zona."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* 2. Contador de llamadas a Places API y Caché */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Control de Llamadas a Places API ({currentMonthKey})
                </h2>
                <p className="text-xs text-slate-500">
                  Aviso automático al llegar a {warningThreshold} llamadas (80% de tu límite mensual configurado).
                </p>
              </div>
            </div>

            <div className="text-right font-mono tabular-nums">
              <span
                className={`text-2xl font-bold ${
                  isNearLimit ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {currentMonthCalls}
              </span>
              <span className="text-xs text-slate-500">
                {' '}
                / {monthlyPlacesLimit} llamadas este mes
              </span>
            </div>
          </div>

          {isNearLimit && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  Aviso de cuota mensual alcanzado:
                </span>{' '}
                Has realizado {currentMonthCalls} llamadas a Places este mes (superando el umbral de aviso de {warningThreshold} sobre {monthlyPlacesLimit} gratuitas).
              </div>
            </div>
          )}

          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                currentMonthCalls >= monthlyPlacesLimit
                  ? 'bg-red-600'
                  : isNearLimit
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round((currentMonthCalls / Math.max(1, monthlyPlacesLimit)) * 100)
                )}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Límite mensual de llamadas gratuitas a Places (editable)
              </label>
              <input
                type="number"
                min={10}
                step={50}
                value={monthlyPlacesLimit}
                onChange={(e) => setMonthlyPlacesLimit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetMonthCounter}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              >
                Reiniciar contador del mes
              </button>

              <button
                type="button"
                onClick={handleClearSearchCache}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar caché de búsquedas</span>
              </button>
            </div>
          </div>

          {cacheClearedNotice && (
            <p className="text-xs text-emerald-700 font-medium">
              Caché de búsquedas vaciada correctamente.
            </p>
          )}
        </div>

        {/* 3. Clave de Google Cloud (Places y PageSpeed) */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <KeyRound className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Clave de Google Cloud (Places API y PageSpeed Insights)
              </h2>
              <p className="text-xs text-slate-500">
                Gemini utiliza automáticamente la clave del entorno. Para Places API (New) y PageSpeed Insights v5 se usa una única clave de Google Cloud.
              </p>
            </div>
          </div>

          <div className="text-xs">
            {hasServerCloudKey && !googleCloudApiKey.trim() ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  El entorno ya tiene una clave de Google Cloud activa. Opcionalmente puedes escribir aquí tu propia clave personal de Google Cloud (se guardará únicamente en este navegador).
                </span>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-md p-3">
                Introduce tu clave de Google Cloud con <strong>Places API (New)</strong> y{' '}
                <strong>PageSpeed Insights API</strong> habilitadas. Se guarda exclusivamente en IndexedDB de este navegador y nunca se escribe en el código.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={googleCloudApiKey}
              onChange={(e) => setGoogleCloudApiKey(e.target.value)}
              placeholder={
                hasServerCloudKey
                  ? 'Usando clave del entorno (escribe aquí si prefieres usar otra clave propia)...'
                  : 'AIzaSy...'
              }
              className="flex-1 px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
            <button
              type="button"
              disabled={testingKey}
              onClick={handleTestKey}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {testingKey ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Probando...</span>
                </>
              ) : (
                <span>Probar conexión Places</span>
              )}
            </button>
          </div>

          {keyTestResult && (
            <div
              className={`p-3 rounded-md border text-xs ${
                keyTestResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {keyTestResult.message}
            </div>
          )}
        </div>

        {/* Botón Guardar Ajustes */}
        <div className="flex items-center justify-between">
          <div>
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ajustes guardados en este navegador</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar ajustes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
