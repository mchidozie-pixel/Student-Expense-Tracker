import React from 'react';
import { X, Repeat } from 'lucide-react';
import { RecurringCluster } from '../types';
import { formatCurrency } from '../utils/storage';

interface RecurringDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: RecurringCluster[];
  currency: string;
  totalEstimatedMonthly: number;
}

export const RecurringDrawer: React.FC<RecurringDrawerProps> = ({
  isOpen,
  onClose,
  clusters,
  currency,
  totalEstimatedMonthly,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="modal-enter w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#fef8e7] text-[#b45309] flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                Recurring Commitments
              </h2>
              <p className="text-xs text-gray-500">
                FR 8.1: Detected repeating student living expenses
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Monthly Commitment Banner */}
          <div className="p-4 bg-[#fef8e7] border border-[#fde68a] rounded-2xl flex items-center justify-between">
            <div>
              <span className="font-bold text-[#b45309] block text-sm">
                Monthly Fixed Outflow
              </span>
              <span className="text-[#b45309]/80 text-[11px]">
                {clusters.length} active recurring commitments
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-[#b45309] tabular-nums">
                {formatCurrency(totalEstimatedMonthly, currency)}
              </span>
              <span className="text-[10px] text-[#b45309]/70 block font-mono">/ month</span>
            </div>
          </div>

          {/* Clusters List */}
          <div className="space-y-2.5">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="p-4 bg-gray-50/80 border border-gray-200/80 rounded-2xl space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">
                      {cluster.recipient || cluster.category}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      <span>{cluster.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize font-semibold text-[#0f4c3a]">{cluster.estimatedFrequency}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">Last: {cluster.lastDate}</span>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <span className="text-sm font-bold text-gray-900 block">
                      {formatCurrency(cluster.amount, currency)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      ~{formatCurrency(cluster.monthlyEstimate, currency)}/mo
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/60">
                  <span className="text-[10px] uppercase font-mono font-semibold text-gray-400 tracking-wider block mb-1">
                    Matched {cluster.occurrences} Records
                  </span>
                  <div className="space-y-1">
                    {cluster.transactions.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-[11px] text-gray-600 font-mono"
                      >
                        <span className="truncate pr-2">{t.date} · {t.note}</span>
                        <span className="font-bold text-gray-800 shrink-0">
                          {formatCurrency(t.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {clusters.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                No recurring patterns detected yet. As you record repeated transactions (like rent or weekly data bundles), they will be grouped here.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-pill-subtle px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
