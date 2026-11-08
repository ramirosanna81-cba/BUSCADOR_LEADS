import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Table as TableIcon,
  Columns3,
  Phone,
  Globe,
  Trash2,
  Calendar,
} from 'lucide-react';
import { BusinessLead, LEAD_STATUSES, LeadStatus } from '../types';
import { ScoreBadge } from './ScoreBadge';

interface MyLeadsViewProps {
  savedLeads: BusinessLead[];
  onSelectLead: (lead: BusinessLead) => void;
  onUpdateLead: (lead: BusinessLead) => Promise<void>;
  onRemoveFromSaved: (lead: BusinessLead) => Promise<void>;
}

export const MyLeadsView: React.FC<MyLeadsViewProps> = ({
  savedLeads,
  onSelectLead,
  onUpdateLead,
  onRemoveFromSaved,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [nicheFilter, setNicheFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const uniqueNiches = useMemo(() => {
    const s = new Set<string>();
    for (const l of savedLeads) {
      if (l.nicheTag) s.add(l.nicheTag);
    }
    return Array.from(s).sort();
  }, [savedLeads]);

  const uniqueZones = useMemo(() => {
    const s = new Set<string>();
    for (const l of savedLeads) {
      if (l.zoneTag) s.add(l.zoneTag);
    }
    return Array.from(s).sort();
  }, [savedLeads]);

  const filteredLeads = useMemo(() => {
    return savedLeads
      .filter((lead) => {
        if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;
        if (nicheFilter !== 'ALL' && lead.nicheTag !== nicheFilter) return false;
        if (zoneFilter !== 'ALL' && lead.zoneTag !== zoneFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = lead.displayName.toLowerCase().includes(q);
          const matchAddress = lead.formattedAddress.toLowerCase().includes(q);
          const matchNotes = (lead.notes || '').toLowerCase().includes(q);
          const matchPhone = (lead.nationalPhoneNumber || '').includes(q);
          if (!matchName && !matchAddress && !matchNotes && !matchPhone) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.opportunityScore.total - a.opportunityScore.total);
  }, [savedLeads, statusFilter, nicheFilter, zoneFilter, searchQuery]);

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      'Nombre',
      'Actividad',
      'Estado',
      'Puntuación Oportunidad',
      'Situación Web',
      'Web / Enlace',
      'Teléfono',
      'Dirección',
      'Zona',
      'Nicho',
      'Valoración',
      'Reseñas',
      'PageSpeed Móvil Rendimiento',
      'PageSpeed SEO',
      'Servicio Recomendado',
      'Correos Extraídos',
      'Próxima Acción',
      'Notas',
      'Google Maps URL',
    ];

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredLeads.map((l) => [
      l.displayName,
      l.primaryTypeDisplayName,
      l.status,
      l.opportunityScore.total,
      l.webClassification === 'no_website'
        ? 'Sin web'
        : l.webClassification === 'social_or_directory'
        ? `Sin web propia (${l.detectedPlatform || 'Externo'})`
        : 'Con web propia',
      l.websiteUri || '',
      l.nationalPhoneNumber || l.internationalPhoneNumber || '',
      l.formattedAddress,
      l.zoneTag,
      l.nicheTag,
      l.rating ?? '',
      l.userRatingCount,
      l.pageSpeed?.performance ?? '',
      l.pageSpeed?.seo ?? '',
      l.geminiAnalysis?.recommendedService?.service ?? '',
      (l.geminiAnalysis?.emails || []).join('; '),
      l.nextActionDate || '',
      l.notes || '',
      l.googleMapsUri || '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mis_leads_radar_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Barra de filtros y acciones */}
      <div className="bg-white border-t-4 border-t-emerald-600 border-x border-b border-slate-200/90 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Mis Leads Guardados</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {filteredLeads.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestiona tu embudo comercial por estados, programa próximas acciones y exporta tu cartera a CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={filteredLeads.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-300 rounded text-xs font-medium text-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar a CSV ({filteredLeads.length})</span>
            </button>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Tablero</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabla</span>
              </button>
            </div>
          </div>
        </div>

        {/* Controles de filtrado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o notas..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
          >
            <option value="ALL">Todos los estados</option>
            {LEAD_STATUSES.map((st) => (
              <option key={st} value={st}>
                Estado: {st}
              </option>
            ))}
          </select>

          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
          >
            <option value="ALL">Todos los nichos</option>
            {uniqueNiches.map((n) => (
              <option key={n} value={n}>
                Nicho: {n}
              </option>
            ))}
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
          >
            <option value="ALL">Todas las zonas</option>
            {uniqueZones.map((z) => (
              <option key={z} value={z}>
                Zona: {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado vacío */}
      {filteredLeads.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <h3 className="text-base font-semibold text-slate-900">
            {savedLeads.length === 0
              ? 'Todavía no has guardado ningún lead'
              : 'Ningún lead coincide con los filtros seleccionados'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {savedLeads.length === 0
              ? 'Ve a la pantalla «Buscar», selecciona los negocios que te interesen y pulsa en «Guardar en mis leads» para organizar tu seguimiento comercial aquí.'
              : 'Cambia los filtros de estado, nicho o zona para ver el resto de tu cartera.'}
          </p>
        </div>
      )}

      {/* Vista TABLERO KANBAN por los 7 estados */}
      {filteredLeads.length > 0 && viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-3">
          <div className="grid grid-cols-7 gap-3 min-w-[1360px]">
            {LEAD_STATUSES.map((status) => {
              const columnLeads = filteredLeads.filter(
                (l) => l.status === status
              );

              const colTheme = {
                'Nuevo': {
                  bg: 'bg-sky-50/70',
                  border: 'border-sky-200',
                  badge: 'bg-sky-600 text-white',
                  title: 'text-sky-950',
                  topStripe: 'border-t-4 border-t-sky-500',
                },
                'Analizado': {
                  bg: 'bg-indigo-50/70',
                  border: 'border-indigo-200',
                  badge: 'bg-indigo-600 text-white',
                  title: 'text-indigo-950',
                  topStripe: 'border-t-4 border-t-indigo-500',
                },
                'Contactado': {
                  bg: 'bg-amber-50/70',
                  border: 'border-amber-200',
                  badge: 'bg-amber-600 text-white',
                  title: 'text-amber-950',
                  topStripe: 'border-t-4 border-t-amber-500',
                },
                'Respondió': {
                  bg: 'bg-purple-50/70',
                  border: 'border-purple-200',
                  badge: 'bg-purple-600 text-white',
                  title: 'text-purple-950',
                  topStripe: 'border-t-4 border-t-purple-500',
                },
                'Reunión': {
                  bg: 'bg-teal-50/70',
                  border: 'border-teal-200',
                  badge: 'bg-teal-600 text-white',
                  title: 'text-teal-950',
                  topStripe: 'border-t-4 border-t-teal-500',
                },
                'Cliente': {
                  bg: 'bg-emerald-50/80',
                  border: 'border-emerald-300',
                  badge: 'bg-emerald-600 text-white',
                  title: 'text-emerald-950',
                  topStripe: 'border-t-4 border-t-emerald-600',
                },
                'Descartado': {
                  bg: 'bg-slate-100/70',
                  border: 'border-slate-300',
                  badge: 'bg-slate-500 text-white',
                  title: 'text-slate-700',
                  topStripe: 'border-t-4 border-t-slate-400',
                },
              }[status];

              return (
                <div
                  key={status}
                  className={`${colTheme.bg} ${colTheme.border} ${colTheme.topStripe} border rounded-xl p-3 flex flex-col min-h-[480px] shadow-xs`}
                >
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/80">
                    <span className={`text-xs font-bold ${colTheme.title}`}>
                      {status}
                    </span>
                    <span className={`font-mono tabular-nums text-xs font-bold px-2 py-0.5 rounded-full ${colTheme.badge}`}>
                      {columnLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {columnLeads.map((lead) => {
                      const phone =
                        lead.nationalPhoneNumber ||
                        lead.internationalPhoneNumber;

                      return (
                        <div
                          key={lead.id}
                          onClick={() => onSelectLead(lead)}
                          className="bg-white border border-slate-200/90 hover:border-blue-400 rounded-lg p-3 cursor-pointer transition-all duration-150 shadow-xs hover:shadow-sm space-y-2"
                        >
                          <div className="font-bold text-xs text-slate-900 leading-snug">
                            {lead.displayName}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                            <span className="truncate">{lead.nicheTag || lead.primaryTypeDisplayName}</span>
                            <span>·</span>
                            <span className="shrink-0">{lead.zoneTag}</span>
                          </div>

                          <div className="text-[11px]">
                            {lead.webClassification === 'no_website' ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Sin web
                              </span>
                            ) : lead.webClassification ===
                              'social_or_directory' ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                Sin web propia ({lead.detectedPlatform || 'Externo'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Con web propia
                              </span>
                            )}
                          </div>

                          <div onClick={(e) => e.stopPropagation()}>
                            <ScoreBadge
                              score={lead.opportunityScore}
                              showBreakdownButton={false}
                            />
                          </div>

                          {lead.nextActionDate && (
                            <div className="flex items-center gap-1 text-[11px] text-blue-800 font-mono bg-blue-50/80 px-2 py-1 rounded border border-blue-200/60">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              <span className="font-semibold">Próx.: {lead.nextActionDate}</span>
                            </div>
                          )}

                          {lead.notes && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                              {lead.notes}
                            </p>
                          )}

                          <div
                            className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {phone ? (
                              <a
                                href={`tel:${phone.replace(/\s+/g, '')}`}
                                className="text-[11px] font-mono text-blue-700 hover:underline flex items-center gap-0.5"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                <span>{phone}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Sin tel.
                              </span>
                            )}

                            <select
                              value={lead.status}
                              onChange={(e) =>
                                onUpdateLead({
                                  ...lead,
                                  status: e.target.value as LeadStatus,
                                })
                              }
                              className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-medium"
                            >
                              {LEAD_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista TABLA */}
      {filteredLeads.length > 0 && viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Negocio</th>
                  <th className="py-2.5 px-3">Nicho / Zona</th>
                  <th className="py-2.5 px-3">Teléfono</th>
                  <th className="py-2.5 px-3">Situación Web</th>
                  <th className="py-2.5 px-3">Oportunidad</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Próxima acción</th>
                  <th className="py-2.5 px-3">Notas</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredLeads.map((lead) => {
                  const phone =
                    lead.nationalPhoneNumber || lead.internationalPhoneNumber;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {lead.displayName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {lead.nicheTag || lead.primaryTypeDisplayName} ·{' '}
                        {lead.zoneTag}
                      </td>
                      <td
                        className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {phone ? (
                          <a
                            href={`tel:${phone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.webClassification === 'no_website' ? (
                          <span className="font-semibold text-red-700">
                            Sin web
                          </span>
                        ) : lead.webClassification === 'social_or_directory' ? (
                          <span className="font-semibold text-amber-800">
                            Sin web propia ({lead.detectedPlatform})
                          </span>
                        ) : (
                          <a
                            href={lead.websiteUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline truncate max-w-[160px]"
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {lead.websiteUri?.replace(/^https?:\/\/(www\.)?/, '')}
                            </span>
                          </a>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ScoreBadge score={lead.opportunityScore} />
                      </td>
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            onUpdateLead({
                              ...lead,
                              status: e.target.value as LeadStatus,
                            })
                          }
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                        >
                          {LEAD_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                        {lead.nextActionDate || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                        {lead.notes || '—'}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded cursor-pointer"
                          >
                            Ficha
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFromSaved(lead)}
                            title="Quitar de mis leads"
                            className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
