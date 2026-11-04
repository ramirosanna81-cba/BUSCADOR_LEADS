import React, { useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { ExternalLink, Phone, Eye } from 'lucide-react';
import { BusinessLead } from '../types';

interface SearchMapViewProps {
  leads: BusinessLead[];
  apiKey: string;
  onSelectLead: (lead: BusinessLead) => void;
}

export const SearchMapView: React.FC<SearchMapViewProps> = ({
  leads,
  apiKey,
  onSelectLead,
}) => {
  const [selectedLead, setSelectedLead] = useState<BusinessLead | null>(null);

  const leadsWithCoords = leads.filter(
    (l) =>
      l.location &&
      typeof l.location.latitude === 'number' &&
      typeof l.location.longitude === 'number'
  );

  if (!apiKey) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-sm font-medium text-slate-800">
          Para visualizar el mapa interactivo, asegúrate de tener configurada tu clave de Google Cloud en Ajustes.
        </p>
      </div>
    );
  }

  if (leadsWithCoords.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-sm text-slate-600">
          No hay coordenadas geográficas en los resultados filtrados para mostrar en el mapa.
        </p>
      </div>
    );
  }

  const centerLat =
    leadsWithCoords.reduce((acc, l) => acc + (l.location?.latitude || 0), 0) /
    leadsWithCoords.length;
  const centerLng =
    leadsWithCoords.reduce((acc, l) => acc + (l.location?.longitude || 0), 0) /
    leadsWithCoords.length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span>
          Mostrando <strong className="font-mono tabular-nums">{leadsWithCoords.length}</strong> negocios ubicados en la zona
        </span>
        <div className="flex items-center gap-4">
          <span>Verde: Oportunidad Alta (≥70)</span>
          <span>·</span>
          <span>Ámbar: Media (45–69)</span>
          <span>·</span>
          <span>Rojo: Baja (&lt;45)</span>
        </div>
      </div>

      <div className="w-full h-[540px]">
        <APIProvider apiKey={apiKey} language="es" region="ES">
          <GoogleMap
            defaultCenter={{ lat: centerLat, lng: centerLng }}
            defaultZoom={13}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="greedy"
            className="w-full h-full"
          >
            {leadsWithCoords.map((lead) => {
              const score = lead.opportunityScore.total;
              const bgClass =
                score >= 70
                  ? 'bg-emerald-600 border-emerald-800'
                  : score >= 45
                  ? 'bg-amber-500 border-amber-700'
                  : 'bg-red-600 border-red-800';

              return (
                <AdvancedMarker
                  key={lead.id}
                  position={{
                    lat: lead.location!.latitude,
                    lng: lead.location!.longitude,
                  }}
                  onClick={() => setSelectedLead(lead)}
                >
                  <div
                    className={`px-2 py-1 rounded text-white font-mono tabular-nums text-xs font-bold border shadow-sm cursor-pointer ${bgClass}`}
                    title={`${lead.displayName} (${score}/100)`}
                  >
                    {score}
                  </div>
                </AdvancedMarker>
              );
            })}

            {selectedLead && selectedLead.location && (
              <InfoWindow
                position={{
                  lat: selectedLead.location.latitude,
                  lng: selectedLead.location.longitude,
                }}
                onCloseClick={() => setSelectedLead(null)}
              >
                <div className="p-1 max-w-xs text-slate-900">
                  <div className="font-semibold text-sm">
                    {selectedLead.displayName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedLead.primaryTypeDisplayName} · Oportunidad{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedLead.opportunityScore.total}/100
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {selectedLead.formattedAddress}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {selectedLead.nationalPhoneNumber && (
                      <a
                        href={`tel:${selectedLead.nationalPhoneNumber}`}
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline font-mono"
                      >
                        <Phone className="w-3 h-3" />
                        {selectedLead.nationalPhoneNumber}
                      </a>
                    )}
                    {selectedLead.googleMapsUri && (
                      <a
                        href={selectedLead.googleMapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Maps
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectLead(selectedLead)}
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Abrir ficha del negocio
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
};
