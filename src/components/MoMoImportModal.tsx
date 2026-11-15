import React, { useState } from 'react';
import { X, Smartphone, ArrowRight, Check, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { Category, Transaction } from '../types';
import { parseMoMoMessage, SAMPLE_MOMO_MESSAGES } from '../utils/momoParser';
import { toLocalDateString } from '../utils/storage';

interface MoMoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currency: string;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const MoMoImportModal: React.FC<MoMoImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  currency,
  onSaveTransaction,
}) => {
  const [pastedText, setPastedText] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parseMoMoMessage> | null>(null);

  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setParsed(null);
      setErrorMsg('');
      return;
    }

    const result = parseMoMoMessage(text, categories);
    setParsed(result);

    if (result.success && result.amount) {
      setAmount(result.amount.toString());
      setRecipient(result.recipient || '');
      setCategory(result.suggestedCategory || categories[0]?.name || 'General / Other');
      setDate(result.date || toLocalDateString());
      setNote(`${result.recipient || 'MoMo payment'}${result.reference ? ` (TxId: ${result.reference})` : ''}`);
      setErrorMsg('');
    } else {
      setErrorMsg(result.error || 'Could not parse amount from this text.');
    }
  };

  const handleApplySample = (sms: string) => {
    handleParse(sms);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    try {
      localStorage.setItem('alu_momo_first_trial_done', 'true');
    } catch {}

    onSaveTransaction({
      amount: numAmount,
      category: category || categories[0]?.name || 'General / Other',
      date: date || toLocalDateString(),
      note: note.trim() || recipient || 'Mobile Money expense',
      recipient: recipient.trim(),
      source: 'momo_sms',
      momoRef: parsed?.reference,
    });

    setPastedText('');
    setParsed(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="modal-enter w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#e8f5f0] text-[#0f4c3a] flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                MoMo SMS Parser
              </h2>
              <p className="text-xs text-gray-500">
                MTN MoMo & Airtel Rwanda Local Extractor
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

        {/* Navigation Quick-Tip Banner */}
        <div className="bg-[#f0fdf4] dark:bg-[#0f4c3a]/20 border-b border-emerald-100 dark:border-[#1c5d49] px-6 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <span className="font-bold text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 rounded-md">Tip</span>
          <span>Copy any MTN MoMo or Airtel SMS and paste it below. You can also open this anytime from the <strong>MoMo</strong> button in the navigation bar!</span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Quick-test Presets */}
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tap a real ALU Kigali student SMS to test:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_MOMO_MESSAGES.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplySample(s.sms)}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-[#e8f5f0] text-gray-700 hover:text-[#0f4c3a] transition-all font-medium"
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Paste Input Area */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Paste MoMo SMS Message Text
            </label>
            <textarea
              rows={3}
              value={pastedText}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="e.g. You have paid 4,500 RWF to SIMBA SUPERMARKET KIMIHURURA on 2026-10-28 18:45:10. TxId: 1029381923..."
              className="w-full text-xs font-mono p-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] transition-all"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Result Preview & Edit Form */}
          {parsed && parsed.success && (
            <div className="p-4 bg-[#f8faf9] border border-[#d2ded8] rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5ece8] pb-2">
                <span className="text-xs font-bold text-[#0f4c3a] flex items-center gap-1.5 font-mono">
                  <Check className="w-4 h-4 text-[#0f4c3a]" />
                  <span>Parsed (Confidence: {Math.round(parsed.confidence * 100)}%)</span>
                </span>
                {parsed.reference && (
                  <span className="text-[11px] font-mono text-[#0f4c3a] bg-[#e8f5f0] px-2 py-0.5 rounded-full font-semibold">
                    TxId: {parsed.reference}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl font-mono font-bold text-[#0f4c3a] text-sm focus:ring-2 focus:ring-[#0f4c3a] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-gray-900 font-mono focus:ring-2 focus:ring-[#0f4c3a] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Merchant / Recipient
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-[#0f4c3a] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Category (Auto-Suggested)
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-[#0f4c3a] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Note / Description
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-[#0f4c3a] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="btn-pill-subtle px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!parsed || !parsed.success}
            onClick={handleSave}
            className={`btn-pine px-5 py-2 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ${
              parsed && parsed.success
                ? 'opacity-100'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <span>Confirm & Record</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
