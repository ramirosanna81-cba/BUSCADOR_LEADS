import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { OpportunityScore } from '../types';

interface ScoreBadgeProps {
  score: OpportunityScore;
  showBreakdownButton?: boolean;
}

export function getScoreColorClasses(value: number, isOpportunity = true): {
  text: string;
  bg: string;
  border: string;
  bar: string;
  label: string;
} {
  if (isOpportunity) {
    if (value >= 70) {
      return {
        text: 'text-emerald-800',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        bar: 'bg-emerald-600',
        label: 'Alta',
      };
    }
    if (value >= 45) {
      return {
        text: 'text-amber-800',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        bar: 'bg-amber-500',
        label: 'Media',
      };
    }
    return {
      text: 'text-red-800',
      bg: 'bg-red-50',
      border: 'border-red-300',
      bar: 'bg-red-600',
      label: 'Baja',
    };
  } else {
    // PageSpeed: 90-100 verde, 50-89 ámbar, 0-49 rojo
    if (value >= 90) {
      return {
        text: 'text-emerald-800',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        bar: 'bg-emerald-600',
        label: 'Óptimo',
      };
    }
    if (value >= 50) {
      return {
        text: 'text-amber-800',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        bar: 'bg-amber-500',
        label: 'Mejorable',
      };
    }
    return {
      text: 'text-red-800',
      bg: 'bg-red-50',
      border: 'border-red-300',
      bar: 'bg-red-600',
      label: 'Deficiente',
    };
  }
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  showBreakdownButton = true,
}) => {
  const [open, setOpen] = useState(false);
  const colors = getScoreColorClasses(score.total, true);

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono tabular-nums text-sm font-semibold ${colors.text}`}
        >
          {score.total}/100
        </span>
        <span className="text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className={`text-xs font-medium ${colors.text}`}>
          {colors.label}
          {score.isProvisional ? ' (prov.)' : ''}
        </span>
      </div>

      {showBreakdownButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          title="Ver desglose de la puntuación de oportunidad"
          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 shadow-lg text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Desglose de Puntuación de Oportunidad
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {score.isProvisional
                    ? 'Cálculo provisional con datos de Places API'
                    : 'Cálculo definitivo tras analizar la página web'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {score.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-b-0"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-900">
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.reason}
                    </div>
                  </div>
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold shrink-0 ${
                      item.points >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {item.points >= 0 ? `+${item.points}` : item.points} ptos
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Puntuación total (acotada 0–100)
              </span>
              <span className={`font-mono tabular-nums text-sm font-bold ${colors.text}`}>
                {score.total} / 100 ({colors.label})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
