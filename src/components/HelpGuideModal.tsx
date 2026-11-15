import React from 'react';
import { X, BookOpen, Smartphone, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="modal-enter w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#e8f5f0] text-[#0f4c3a] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Student Expense Tracker Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs text-gray-600">
          
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#0f4c3a]" />
              <span>Mobile Money (MoMo) SMS Parsing</span>
            </h3>
            <p className="leading-relaxed">
              Whenever you pay for a Yego moto, campus canteen meal, or groceries via MTN MoMo or Airtel Money, copy the SMS and paste it in the "MoMo" tab.
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-700">
              Sample MTN MoMo text:<br />
              "You have paid 4,500 RWF to SIMBA SUPERMARKET on 2026-10-28 18:45:10. TxId: 1029381923."
            </div>
            <p className="leading-relaxed text-gray-500">
              All text is parsed strictly inside your browser (zero external API calls), ensuring total student privacy (NFR 2).
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0f4c3a]" />
              <span>Spending Pace & Alerts (FR 6.2 & 6.3)</span>
            </h3>
            <p className="leading-relaxed">
              Traditional budgets only warn you after you run out of money. Our pacing engine monitors your daily burn rate against the remaining days of the academic month. If your spending pace is too aggressive, you receive an early pace alert with an exact daily spending target to help stretch your remaining funds.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Keyword Auto-Categorization (FR 2)</span>
            </h3>
            <p className="leading-relaxed">
              Keywords like <em>"moto", "yego"</em> map to Transport; <em>"simba", "canteen", "lunch"</em> map to Food & Dining; <em>"mtn", "bundle"</em> map to Data & Airtime; and <em>"printing", "books"</em> map to Academics. You can customize these keywords anytime in Settings.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Offline-Ready (FR 11, NFR 4)</span>
            </h3>
            <p className="leading-relaxed">
              Transactions are saved to your private account in Firebase and cached on this device, so you can record expenses even when campus Wi-Fi or cellular networks are intermittent. Everything syncs automatically when you are back online.</p>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-pine px-4 py-1.5 text-xs font-semibold text-white shadow-2xs"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
