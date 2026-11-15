import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Edit3, 
  Download, 
  FileText, 
  Repeat, 
  AlertCircle,
  X,
  Utensils,
  Bike,
  Wifi,
  GraduationCap,
  Home,
  Tag
} from 'lucide-react';
import { Transaction, Category } from '../types';
import { formatCurrency, downloadCSV, toLocalDateString } from '../utils/storage';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenRecurring: () => void;
  onOpenMoMoModal: () => void;
  onOpenExportModal: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  currency,
  onEdit,
  onDelete,
  onOpenRecurring,
  onOpenExportModal,
}) => {
  useScrollReveal([transactions.length]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'manual' | 'momo_sms'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Deletion safety confirmation state (Section 5.2)
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null);

  const getCategoryIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('food') || lower.includes('dining')) return Utensils;
    if (lower.includes('transport') || lower.includes('moto')) return Bike;
    if (lower.includes('data') || lower.includes('telecom') || lower.includes('airtime')) return Wifi;
    if (lower.includes('academic') || lower.includes('study')) return GraduationCap;
    if (lower.includes('housing') || lower.includes('living')) return Home;
    return Tag;
  };

  const getCategoryTheme = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('food')) return { bg: 'bg-[#e8f5f0]', text: 'text-[#0f4c3a]' };
    if (lower.includes('transport')) return { bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]' };
    if (lower.includes('data') || lower.includes('telecom')) return { bg: 'bg-[#ecfeff]', text: 'text-[#0e7490]' };
    if (lower.includes('academic')) return { bg: 'bg-[#f5f3ff]', text: 'text-[#6d28d9]' };
    if (lower.includes('housing')) return { bg: 'bg-[#fef3c7]', text: 'text-[#b45309]' };
    return { bg: 'bg-gray-100', text: 'text-gray-700' };
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const noteMatch = tx.note.toLowerCase().includes(q);
        const recipientMatch = tx.recipient?.toLowerCase().includes(q);
        const categoryMatch = tx.category.toLowerCase().includes(q);
        const momoMatch = tx.momoRef?.toLowerCase().includes(q);
        const amountMatch = tx.amount.toString().includes(q);
        if (!noteMatch && !recipientMatch && !categoryMatch && !momoMatch && !amountMatch) {
          return false;
        }
      }

      if (selectedCategory !== 'all' && tx.category !== selectedCategory) {
        return false;
      }

      if (selectedSource !== 'all' && tx.source !== selectedSource) {
        return false;
      }

      if (selectedDateRange !== 'all') {
        // Parse YYYY-MM-DD as a local calendar day so month/week boundaries
        // match what the student sees, not UTC.
        const [y, m, d] = (tx.date || '').split('-').map(Number);
        const txDate = y && m && d ? new Date(y, m - 1, d) : new Date(0);
        const now = new Date();
        const todayStr = toLocalDateString(now);

        if (selectedDateRange === 'today') {
          if (tx.date !== todayStr) return false;
        } else if (selectedDateRange === 'this_week') {
          const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          if (txDate < oneWeekAgo) return false;
        } else if (selectedDateRange === 'this_month') {
          if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) {
            return false;
          }
        }
      }

      return true;
    }).sort((a, b) => {
      const timeB = new Date((b.date || '') + ' ' + (b.time || '00:00')).getTime() || 0;
      const timeA = new Date((a.date || '') + ' ' + (a.time || '00:00')).getTime() || 0;
      if (sortBy === 'date_desc') {
        return timeB - timeA;
      }
      if (sortBy === 'date_asc') {
        return timeA - timeB;
      }
      if (sortBy === 'amount_desc') {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === 'amount_asc') {
        return (a.amount || 0) - (b.amount || 0);
      }
      return 0;
    });
  }, [transactions, searchQuery, selectedCategory, selectedSource, selectedDateRange, sortBy]);

  const totalFilteredAmount = filteredTransactions.reduce((acc, t) => acc + (Number(t?.amount) || 0), 0);

  return (
    <div className="space-y-5 pb-20 max-w-4xl mx-auto">
      
      {/* Action Strip - Clean, non-redundant layout without large title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">
            Total Records: <strong className="text-gray-900 font-bold">{transactions.length}</strong>
          </span>
        </div>

        {/* Buttons strip - no overflow */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadCSV(filteredTransactions, currency)}
            className="btn-pill-subtle inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold shadow-2xs"
            title="Download CSV for Excel or Google Sheets"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>CSV</span>
          </button>

          <button
            onClick={onOpenExportModal}
            className="btn-pill-subtle inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold shadow-2xs"
            title="Print or view formatted report"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span>Report</span>
          </button>

          <button
            onClick={onOpenRecurring}
            className="btn-pine inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
            title="See your recurring expenses"
          >
            <Repeat className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Recurring</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar - Full-width and responsive */}
      <div className="testora-card scroll-reveal-up p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          
          {/* Keyword Search (spans full on mobile) */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by note, merchant, MoMo TxId..."
              className="w-full text-xs pl-9 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c3a]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c3a]"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as typeof selectedDateRange)}
              aria-label="Filter by date"
              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c3a]"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">Last 7 Days</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as typeof selectedSource)}
              aria-label="Filter by entry source"
              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c3a]"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="momo_sms">MoMo SMS</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c3a]"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </div>
        </div>

        {/* Results summary line */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 font-mono tabular-nums">
          <span>
            <strong>{filteredTransactions.length}</strong> of {transactions.length} records
          </span>
          <span>
            Filtered: <strong className="text-gray-900 font-bold">{formatCurrency(totalFilteredAmount, currency)}</strong>
          </span>
        </div>
      </div>

      {/* Transaction List (Responsive: Cards on Mobile, Clean Table on Tablet/Desktop) */}
      <div className="testora-card scroll-reveal-up delay-1 overflow-hidden">
        
        {/* Mobile View: Card Rows */}
        <div className="divide-y divide-gray-100">
          {filteredTransactions.map((tx) => {
            const Icon = getCategoryIcon(tx.category);
            const theme = getCategoryTheme(tx.category);

            return (
              <div
                key={tx.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50/70 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className={`w-9 h-9 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        {tx.note}
                      </span>
                      {tx.source === 'momo_sms' && (
                        <span className="text-[9px] font-mono font-bold text-[#0f4c3a] bg-[#e8f5f0] px-1.5 py-0.2 rounded border border-[#c5e6d8]">
                          MoMo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                      <span className="font-medium text-gray-700">{tx.category}</span>
                      <span aria-hidden="true" className="text-gray-300">·</span>
                      <span className="font-mono text-gray-400">{tx.date}</span>
                      {tx.recipient && (
                        <>
                          <span aria-hidden="true" className="text-gray-300">·</span>
                          <span className="truncate max-w-[120px] text-gray-500">{tx.recipient}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-mono font-bold text-xs sm:text-sm text-gray-900 tabular-nums block">
                      -{formatCurrency(tx.amount, currency)}
                    </span>
                    {tx.time && (
                      <span className="text-[10px] text-gray-400 font-mono block">
                        {tx.time}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(tx)}
                      className="p-1.5 text-gray-400 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Edit transaction"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmTx(tx)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="py-12 text-center text-xs text-gray-400">
              No transactions match your search or filter criteria.
            </div>
          )}
        </div>
      </div>

      {/* Safety Deletion Modal (Section 5.2) */}
      {deleteConfirmTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div 
            className="modal-enter w-full max-w-md bg-white dark:bg-[#121620] rounded-3xl shadow-2xl border border-gray-200 dark:border-[#222a3a] p-6 space-y-4 text-gray-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                <AlertCircle className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                  Safety Confirmation
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Are you sure you want to delete this expense?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Per system business rules, deleted transactions cannot be recovered.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-[#0c0f16] rounded-xl border border-gray-200 dark:border-[#1a2130] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Item:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{deleteConfirmTx.note}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(deleteConfirmTx.amount, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date:</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{deleteConfirmTx.date}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTx(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2130] border border-gray-200 dark:border-[#252f44] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(deleteConfirmTx.id);
                  setDeleteConfirmTx(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors cursor-pointer"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
