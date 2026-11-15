import React from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';
import { VERSION_RELEASE_NOTES } from '../version';

interface WhatsNewModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
  isDark?: boolean;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  version,
  onClose,
  isDark = false,
}) => {
  if (!isOpen) return null;

  const notes = VERSION_RELEASE_NOTES[version] || [
    'Performance enhancements and stability updates.',
    'Security improvements and updated offline caching.',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl transition-all scale-100 ${
          isDark 
            ? 'bg-[#121620] border-[#222a3a] text-white' 
            : 'bg-white border-gray-200 text-gray-900 shadow-xl'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#1e2638]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-snug">
                What’s new in {version}
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Student Expense Tracker update
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          {notes.map((note, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{note}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-[#1e2638] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#0f4c3a] hover:bg-[#15674f] transition-all cursor-pointer shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
