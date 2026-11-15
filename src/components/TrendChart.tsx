import React, { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Info, 
  Calendar, 
  ListOrdered, 
  Sparkles,
  ArrowUpRight,
  Receipt,
  Layers
} from 'lucide-react';
import { Transaction, Category } from '../types';
import { formatCurrency, toLocalDateString } from '../utils/storage';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface TrendChartProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  transactions,
  categories,
  currency,
}) => {
  useScrollReveal([transactions.length]);

  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const getCategoryColor = (name: string) => {
    const found = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return found?.color || '#0f4c3a';
  };

  // 1. Weekly grouping (last 7 days)
  const last7Days: { 
    dateStr: string; 
    fullLabel: string; 
    shortDay: string; 
    dayNum: string; 
    total: number; 
    count: number;
    items: Transaction[];
  }[] = [];

  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = toLocalDateString(d);
    const fullLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = String(d.getDate());
    
    const dayTransactions = (transactions || []).filter((t) => t && typeof t.date === 'string' && t.date === dateStr);
    const total = dayTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    last7Days.push({ 
      dateStr, 
      fullLabel, 
      shortDay, 
      dayNum, 
      total, 
      count: dayTransactions.length,
      items: dayTransactions
    });
  }

  // 2. Monthly grouping (last 6 months)
  const last6Months: { 
    monthKey: string; 
    fullLabel: string; 
    shortDay: string; 
    dayNum: string; 
    total: number; 
    count: number;
    items: Transaction[];
  }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const fullLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const shortDay = d.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = d.toLocaleDateString('en-US', { year: '2-digit' });

    const monthTransactions = (transactions || []).filter((t) => t && typeof t.date === 'string' && t.date.startsWith(monthKey));
    const total = monthTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    last6Months.push({ 
      monthKey, 
      fullLabel, 
      shortDay, 
      dayNum, 
      total, 
      count: monthTransactions.length,
      items: monthTransactions
    });
  }

  const activeData = period === 'weekly' ? last7Days : last6Months;
  const peakTotal = activeData.reduce((max, d) => Math.max(max, d.total), 0);
  // Minimum scale keeps empty days visible without reporting a fake peak.
  const maxTotal = Math.max(peakTotal, 1000);
  const periodTotal = activeData.reduce((acc, d) => acc + d.total, 0);
  const periodCount = activeData.reduce((acc, d) => acc + d.count, 0);
  const averageVelocity = activeData.length > 0 ? periodTotal / activeData.length : 0;

  // Selected item fallback to latest day with transactions or current day
  const effectiveSelectedIndex = selectedDayIndex !== null && selectedDayIndex >= 0 && selectedDayIndex < activeData.length
    ? selectedDayIndex
    : activeData.length - 1;
  const selectedItem = activeData[effectiveSelectedIndex];

  // Category breakdown
  const categoryTotals: { [key: string]: number } = {};
  for (const t of (transactions || [])) {
    if (!t) continue;
    const cat = t.category || 'General';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
  }

  const grandTotal = (transactions || []).reduce((s, tx) => s + (Number(tx?.amount) || 0), 0);

  const sortedCategories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
      color: getCategoryColor(name),
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-5 pb-24 md:pb-12 max-w-4xl mx-auto w-full px-1">
      
      {/* Period Switcher Bar - Clean layout without redundant large title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          Spending velocity, pacing burn-rate, and category breakdown
        </p>

        {/* Responsive Segmented Period Control */}
        <div className="flex items-center p-1 rounded-full bg-white dark:bg-[#121620] border border-[#e5e9e7] dark:border-[#222a3a] shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setPeriod('weekly');
              setSelectedDayIndex(null);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              period === 'weekly'
                ? 'bg-[#0f4c3a] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => {
              setPeriod('monthly');
              setSelectedDayIndex(null);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              period === 'monthly'
                ? 'bg-[#0f4c3a] text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Last 6 Months
          </button>
        </div>
      </div>

      {/* KPI Velocity Snapshot Cards (Objects coming together from left, center, right) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
        <div className="testora-card scroll-reveal-left p-3 sm:p-4 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            {period === 'weekly' ? '7-Day Total' : '6-Month Total'}
          </span>
          <div className="text-sm sm:text-lg font-bold font-mono text-gray-900 dark:text-white mt-1 tabular-nums truncate">
            {formatCurrency(periodTotal, currency)}
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-0.5">
            {periodCount} transactions recorded
          </span>
        </div>

        <div className="testora-card scroll-reveal-up delay-1 p-3 sm:p-4 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            {period === 'weekly' ? 'Daily Velocity' : 'Monthly Avg'}
          </span>
          <div className="text-sm sm:text-lg font-bold font-mono text-[#0f4c3a] dark:text-emerald-400 mt-1 tabular-nums truncate">
            {formatCurrency(averageVelocity, currency)}
            <span className="text-[10px] font-normal text-gray-400 ml-1">/ {period === 'weekly' ? 'day' : 'mo'}</span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-0.5">
            Pacing baseline burn rate
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 testora-card scroll-reveal-right delay-2 p-3 sm:p-4 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            Peak Outflow
          </span>
          <div className="text-sm sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 tabular-nums truncate">
            {formatCurrency(peakTotal, currency)}
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-0.5 truncate">
            Highest logged cycle single period
          </span>
        </div>
      </div>

      {/* Main Velocity Chart & Inspection Card */}
      <div className="testora-card scroll-reveal-up delay-1 p-4 sm:p-6 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm">
        
        {/* Header with Title and Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100 dark:border-[#1e2638]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#e8f5f0] dark:bg-emerald-950/60 text-[#0f4c3a] dark:text-emerald-300 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                {period === 'weekly' ? 'Daily Spending Velocity' : 'Monthly Spending Volume'}
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Tap any column to inspect date, amount, and items
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex rounded-lg p-0.5 bg-gray-100 dark:bg-[#161c28] border border-gray-200 dark:border-[#222a3a] text-xs">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'chart'
                    ? 'bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Bars</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode: BAR CHART VIEW */}
        {viewMode === 'chart' && (
          <div className="pt-4">
            {/* The Visual Chart Canvas: 100% Mobile Fluid, Non-Clipping */}
            <div className="h-52 sm:h-60 flex items-end gap-1.5 sm:gap-4 md:gap-6 pt-4 pb-1 border-b border-gray-100 dark:border-[#1e2638] select-none">
              {activeData.map((item, idx) => {
                const heightPct = Math.max(6, (item.total / maxTotal) * 100);
                const isSelected = idx === effectiveSelectedIndex;
                const hasSpend = item.total > 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none min-w-0"
                    title={`${item.fullLabel}: ${formatCurrency(item.total, currency)}`}
                  >
                    {/* Amount indicator tag (Always visible if selected, or on hover for desktop) */}
                    <div 
                      className={`text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mb-1 transition-all tabular-nums text-center max-w-full truncate ${
                        isSelected
                          ? 'bg-[#0f4c3a] dark:bg-emerald-600 text-white shadow-xs opacity-100 scale-105'
                          : 'opacity-0 sm:group-hover:opacity-100 bg-gray-900/90 text-white'
                      }`}
                    >
                      {item.total > 0 ? formatCurrency(item.total, currency) : '0'}
                    </div>

                    {/* Bar Pillar */}
                    <div className="w-full flex justify-center h-full items-end">
                      <div
                        className={`w-full max-w-[28px] sm:max-w-[40px] rounded-t-lg sm:rounded-t-xl transition-all duration-300 ${
                          isSelected
                            ? 'bg-[#0f4c3a] dark:bg-emerald-500 ring-2 ring-[#0f4c3a]/40 dark:ring-emerald-400/40 shadow-sm'
                            : hasSpend
                            ? 'bg-[#0f4c3a]/80 dark:bg-emerald-700/80 hover:bg-[#0f4c3a] dark:hover:bg-emerald-600'
                            : 'bg-gray-200/80 dark:bg-gray-800/80'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* Responsive X-Axis Day Label (Never Truncates on Phone Screens) */}
                    <div className="mt-2 text-center w-full min-w-0">
                      <span 
                        className={`block text-[10px] sm:text-xs font-semibold leading-tight ${
                          isSelected 
                            ? 'text-[#0f4c3a] dark:text-emerald-400 font-bold' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {item.shortDay}
                      </span>
                      <span className="block text-[9px] text-gray-400 dark:text-gray-500 font-mono -mt-0.5">
                        {item.dayNum}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tap-to-Inspect Details Banner (Designed for mobile touch interaction) */}
            {selectedItem && (
              <div className="mt-4 p-3 sm:p-3.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#0f4c3a]/10 dark:bg-emerald-950 text-[#0f4c3a] dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                      {selectedItem.fullLabel}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate">
                      {selectedItem.count > 0 
                        ? `${selectedItem.count} transaction${selectedItem.count > 1 ? 's' : ''} logged` 
                        : 'No expenses logged on this day'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-800">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 sm:hidden">Total Spend:</span>
                  <div className="text-right">
                    <span className="text-sm sm:text-base font-extrabold font-mono text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedItem.total, currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Mode: LIST VIEW (Superb accessibility for mobile users) */}
        {viewMode === 'list' && (
          <div className="pt-3 divide-y divide-gray-100 dark:divide-[#1e2638] max-h-72 overflow-y-auto">
            {activeData.map((item, idx) => (
              <div 
                key={idx} 
                className="py-2.5 px-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#161c28] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#1a2130] flex flex-col items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                    <span className="text-[9px] uppercase font-bold text-gray-500 dark:text-gray-400">{item.shortDay}</span>
                    <span className="text-xs font-mono font-bold -mt-1">{item.dayNum}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                      {item.fullLabel}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                      {item.count > 0 ? `${item.count} items recorded` : 'Zero spend day'}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-xs sm:text-sm text-gray-900 dark:text-white tabular-nums shrink-0 pl-2">
                  {formatCurrency(item.total, currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Breakdown & Insights (Mobile-responsive 1-col to 2-col) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Category List */}
        <div className="testora-card scroll-reveal-left delay-1 p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl">
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-gray-100 dark:border-[#1e2638]">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#0f4c3a] dark:text-emerald-400" />
              <span>Category Allocation</span>
            </h2>
            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
              {sortedCategories.length} Categories
            </span>
          </div>

          <div className="space-y-3">
            {sortedCategories.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 truncate min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <div className="font-mono text-gray-900 dark:text-white tabular-nums shrink-0 text-right">
                    <span className="font-bold">{formatCurrency(cat.amount, currency)}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-1 text-[11px]">({cat.percentage.toFixed(0)}%)</span>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, cat.percentage)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}

            {sortedCategories.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                No expense records available to plot.
              </div>
            )}
          </div>
        </div>

        {/* Financial Insights Card */}
        <div className="testora-card scroll-reveal-right delay-2 p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-[#1e2638]">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Spending Velocity Observations
              </h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-[#0c0f16] rounded-xl border border-gray-200 dark:border-[#222a3a] flex items-start gap-2.5">
                <Info className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <strong className="font-bold text-gray-900 dark:text-white block">Total Outflow</strong>
                  <span className="text-gray-600 dark:text-gray-300">
                    Logged <span className="font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(grandTotal, currency)}</span> across {transactions.length} transactions this trimester.
                  </span>
                </div>
              </div>

              {sortedCategories.length > 0 && (
                <div className="p-3 bg-[#e8f5f0] dark:bg-emerald-950/40 rounded-xl border border-[#c5e6d8] dark:border-emerald-800/40 flex items-start gap-2.5">
                  <TrendingUp className="w-4 h-4 text-[#0f4c3a] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <strong className="font-bold text-[#0f4c3a] dark:text-emerald-400 block">Top Spend Driver</strong>
                    <span className="text-gray-700 dark:text-gray-300">
                      Largest outflow is <strong className="font-semibold text-[#0f4c3a] dark:text-emerald-400">{sortedCategories[0]?.name}</strong> ({sortedCategories[0]?.percentage.toFixed(0)}% of expenses).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#1e2638] text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Pacing Tip: Logging daily moto and cafeteria expenses gives 99% accurate runway predictions.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
