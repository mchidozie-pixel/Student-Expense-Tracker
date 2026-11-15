import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Calendar, Clock, DollarSign, Tag, User } from 'lucide-react';
import { Transaction, Category } from '../types';
import { suggestCategory } from '../utils/categorizer';
import { toLocalDateString } from '../utils/storage';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currency: string;
  initialTransaction?: Transaction | null;
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  categories,
  currency,
  initialTransaction,
  onSave,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('monthly');

  const [suggestedCat, setSuggestedCat] = useState<string | null>(null);
  const [autoApplied, setAutoApplied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [keyboardMaxHeight, setKeyboardMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (initialTransaction) {
      setAmount(initialTransaction.amount.toString());
      setCategory(initialTransaction.category);
      setDate(initialTransaction.date);
      setTime(initialTransaction.time || '12:00');
      setNote(initialTransaction.note || '');
      setRecipient(initialTransaction.recipient || '');
      setIsRecurring(!!initialTransaction.isRecurring);
      setRecurringFrequency(initialTransaction.recurringFrequency === 'weekly' ? 'weekly' : 'monthly');
      setSuggestedCat(null);
      setAutoApplied(false);
    } else {
      const today = toLocalDateString();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      setAmount('');
      setCategory(categories[0]?.name || 'Food & Dining');
      setDate(today);
      setTime(timeStr);
      setNote('');
      setRecipient('');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setSuggestedCat(null);
      setAutoApplied(false);
    }
    setErrorMsg('');
  }, [initialTransaction, isOpen, categories]);

  // Keyword-based category prediction
  useEffect(() => {
    if (initialTransaction) return;
    const combined = `${note} ${recipient}`.trim();
    if (combined.length >= 3) {
      const res = suggestCategory(combined, categories);
      if (res.confidence > 0.3) {
        setSuggestedCat(res.categoryName);
        if (!autoApplied && res.categoryName !== category) {
          setCategory(res.categoryName);
          setAutoApplied(true);
        }
      }
    }
  }, [note, recipient, categories, initialTransaction, autoApplied, category]);

  // Keep the card inside the part of the screen the on-screen keyboard leaves
  // visible, so the Record / Save button can always be tapped.
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardMaxHeight(Math.max(320, Math.round(vv.height - 24)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKeyboardMaxHeight(null);
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Numbers typed with thousands separators ("2,500") must not be rejected
    // or silently turned into 2 by the browser.
    const cleaned = String(amount).replace(/[,\s]/g, '');
    const numAmount = parseFloat(cleaned);
    if (!cleaned || isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Enter an amount greater than 0 (for example 2500).');
      return;
    }
    if (!note.trim() && !recipient.trim()) {
      setErrorMsg('Add a short note or description for this expense.');
      return;
    }
    setErrorMsg('');

    onSave(
      {
        amount: numAmount,
        category: category || categories[0]?.name || 'General / Other',
        date: date || toLocalDateString(),
        time: time || '12:00',
        note: note.trim() || recipient || 'Student expense',
        recipient: recipient.trim(),
        source: initialTransaction?.source || 'manual',
        momoRef: initialTransaction?.momoRef,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
      },
      initialTransaction?.id
    );

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      {/* Viewport-constrained card: max-h-[85vh], flex flex-col */}
      <div 
        className="modal-enter w-full max-w-md max-h-[86dvh] bg-white dark:bg-[#121620] text-gray-900 dark:text-gray-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-[#222a3a] flex flex-col overflow-hidden my-auto"
        style={keyboardMaxHeight ? { maxHeight: `${keyboardMaxHeight}px` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-gray-100 dark:border-[#222a3a] flex items-center justify-between shrink-0 bg-white dark:bg-[#121620]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight">
              {initialTransaction ? 'Edit Expense Record' : 'Record Student Expense'}
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Live categorization &amp; instant budget pacing update
            </p>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0">
            
            {/* Amount input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Amount ({currency}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full text-xl sm:text-2xl font-bold font-mono py-2.5 px-3 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 tabular-nums transition-all"
                />
              </div>
            </div>

            {/* Note & Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Note / Item Description *
                </label>
                {suggestedCat && (
                  <span className="text-[10px] text-[#0f4c3a] dark:text-emerald-400 font-semibold flex items-center gap-1 bg-[#e8f5f0] dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5 text-[#0f4c3a] dark:text-emerald-400" />
                    <span>Auto-matched: {suggestedCat}</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Lunch at ALU Cafeteria, Yego moto to Kimironko..."
                className="w-full text-base sm:text-xs py-2 px-3 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Recipient / Merchant */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Recipient / Merchant (Optional)
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. SIMBA SUPERMARKET, YEGO MOTO, MTN Rwanda"
                className="w-full text-xs py-2 px-3 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {categories.map((c) => {
                  const isSelected = category === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategory(c.name);
                        setAutoApplied(true);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0f4c3a] dark:bg-emerald-600 text-white border-[#0f4c3a] dark:border-emerald-600 font-bold shadow-2xs'
                          : 'bg-gray-50 dark:bg-[#0c0f16] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#222a3a] hover:bg-gray-100 dark:hover:bg-[#161c27] font-medium'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-base sm:text-xs py-1.5 px-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-base sm:text-xs py-1.5 px-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Recurring toggle */}
            <div className="pt-2 border-t border-gray-100 dark:border-[#222a3a]">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded text-[#0f4c3a] focus:ring-[#0f4c3a] w-4 h-4 cursor-pointer"
                />
                <span>Mark as recurring expense (rent, weekly bundle)</span>
              </label>

              {isRecurring && (
                <div className="mt-2 pl-6 flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Frequency:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRecurringFrequency('weekly')}
                      className={`text-xs px-2.5 py-0.5 rounded-full border cursor-pointer ${
                        recurringFrequency === 'weekly'
                          ? 'bg-[#e8f5f0] dark:bg-emerald-950/60 border-[#c5e6d8] dark:border-emerald-700 text-[#0f4c3a] dark:text-emerald-300 font-bold'
                          : 'bg-white dark:bg-[#0c0f16] border-gray-200 dark:border-[#222a3a] text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecurringFrequency('monthly')}
                      className={`text-xs px-2.5 py-0.5 rounded-full border cursor-pointer ${
                        recurringFrequency === 'monthly'
                          ? 'bg-[#e8f5f0] dark:bg-emerald-950/60 border-[#c5e6d8] dark:border-emerald-700 text-[#0f4c3a] dark:text-emerald-300 font-bold'
                          : 'bg-white dark:bg-[#0c0f16] border-gray-200 dark:border-[#222a3a] text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Sticky Visible Footer with Clear Cancel and Save buttons */}
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
              className="btn-pine px-5 py-2 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{initialTransaction ? 'Save Changes' : 'Record Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
