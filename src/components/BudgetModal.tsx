import React, { useEffect, useState } from 'react';
import { X, Target } from 'lucide-react';
import { BudgetConfig } from '../types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: BudgetConfig;
  currency: string;
  onSave: (b: BudgetConfig) => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budget,
  currency,
  onSave,
}) => {
  const [monthlyCap, setMonthlyCap] = useState(budget.monthlyCap.toString());
  const [cycleStartDay, setCycleStartDay] = useState(budget.cycleStartDay.toString());
  const [notifyThresholdPct, setNotifyThresholdPct] = useState(budget.notifyThresholdPct.toString());
  const [errorMsg, setErrorMsg] = useState('');

  // Re-sync the fields every time the modal opens so it always shows the
  // budget that is actually saved (e.g. after an edit in Settings).
  useEffect(() => {
    if (isOpen) {
      setMonthlyCap(budget.monthlyCap.toString());
      setCycleStartDay(budget.cycleStartDay.toString());
      setNotifyThresholdPct(budget.notifyThresholdPct.toString());
      setErrorMsg('');
    }
  }, [isOpen, budget]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseFloat(monthlyCap);
    const startDay = parseInt(cycleStartDay, 10);
    const threshold = parseInt(notifyThresholdPct, 10);

    if (isNaN(cap) || cap <= 0) {
      setErrorMsg('Monthly budget cap must be a positive number greater than 0.');
      return;
    }

    onSave({
      monthlyCap: cap,
      cycleStartDay: isNaN(startDay) ? 1 : Math.min(28, Math.max(1, startDay)),
      notifyThresholdPct: isNaN(threshold) ? 80 : Math.min(100, Math.max(50, threshold)),
    });

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="modal-enter w-full max-w-md max-h-[86vh] bg-white dark:bg-[#121620] text-gray-900 dark:text-gray-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-[#222a3a] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-3.5 border-b border-gray-100 dark:border-[#222a3a] flex items-center justify-between shrink-0 bg-white dark:bg-[#121620]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#e8f5f0] dark:bg-emerald-950/60 text-[#0f4c3a] dark:text-emerald-300 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight">
              Monthly Budget Cap
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1c2230] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Monthly Spending Cap ({currency}) *
              </label>
              <input
                type="number"
                min="1"
                required
                autoFocus
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                placeholder="e.g. 150000"
                className="w-full text-xl sm:text-2xl font-bold font-mono py-2.5 px-3 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 tabular-nums transition-all"
              />
              <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">
                Recommended for ALU Kigali students: 100,000 - 200,000 RWF / month.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Cycle Start Day (1-28)
                </label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={cycleStartDay}
                  onChange={(e) => setCycleStartDay(e.target.value)}
                  className="w-full py-2 px-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={notifyThresholdPct}
                  onChange={(e) => setNotifyThresholdPct(e.target.value)}
                  className="w-full py-2 px-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {errorMsg}
              </p>
            )}
          </div>

          <div className="px-5 sm:px-6 py-3 bg-gray-50/90 dark:bg-[#0c0f16]/95 border-t border-gray-100 dark:border-[#222a3a] flex items-center justify-between shrink-0 sticky bottom-0 z-10 backdrop-blur-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a202c] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-pine px-5 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
            >
              Update Budget Cap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
