import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Smartphone, 
  Repeat, 
  ArrowUpRight, 
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Zap,
  X,
  Plus,
  ArrowRight,
  Clock,
  Utensils,
  Bike,
  Wifi,
  GraduationCap,
  Home,
  Tag,
  ReceiptText
} from 'lucide-react';
import { Transaction, BudgetConfig, Category, RecurringCluster } from '../types';
import { formatCurrency, calculateBudgetPace } from '../utils/storage';
import { formatGreeting } from '../utils/greeting';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface DashboardProps {
  transactions: Transaction[];
  budget: BudgetConfig;
  categories: Category[];
  currency: string;
  recurringClusters: RecurringCluster[];
  userName?: string;
  onOpenAddModal: () => void;
  onOpenMoMoModal: () => void;
  onOpenBudgetModal: () => void;
  onOpenRecurring: () => void;
  onViewAllExpenses: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  budget,
  categories,
  currency,
  recurringClusters,
  userName = 'Scholar',
  onOpenAddModal,
  onOpenMoMoModal,
  onOpenBudgetModal,
  onOpenRecurring,
  onViewAllExpenses,
  onEditTransaction,
}) => {
  // Trigger scroll-reveal on mount and when underlying data updates
  useScrollReveal([transactions.length, budget.monthlyCap]);

  // Live clock so the greeting changes from morning to afternoon to evening
  // without a refresh (checked once a minute, including across midnight).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // MoMo SMS First-Trial Tutorial:
  // Shows first-time instruction on how to paste MoMo SMS.
  // Once the student pastes their first MoMo SMS (or dismisses the tutorial),
  // this card disappears completely from the home page.
  const hasMoMoTx = useMemo(() => {
    return transactions.some((t) => t.source === 'momo_sms');
  }, [transactions]);

  const [dismissedMoMoCard, setDismissedMoMoCard] = useState<boolean>(() => {
    try {
      return localStorage.getItem('alu_momo_first_trial_done') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissMoMoCard = () => {
    try {
      localStorage.setItem('alu_momo_first_trial_done', 'true');
    } catch {}
    setDismissedMoMoCard(true);
  };

  const showMoMoCard = !hasMoMoTx && !dismissedMoMoCard;

  const pace = useMemo(() => {
    return calculateBudgetPace(transactions, budget.monthlyCap, budget.cycleStartDay);
  }, [transactions, budget.monthlyCap, budget.cycleStartDay]);

  // Top spending category
  const { topCategoryName, topCategoryAmount, topCategoryPct } = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};
    for (const tx of pace.currentMonthTransactions) {
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
    }

    let name = 'None';
    let amount = 0;
    for (const [catName, catAmount] of Object.entries(categoryTotals)) {
      if (catAmount > amount) {
        amount = catAmount;
        name = catName;
      }
    }

    const pct = pace.totalSpent > 0 ? (amount / pace.totalSpent) * 100 : 0;
    return { topCategoryName: name, topCategoryAmount: amount, topCategoryPct: pct };
  }, [pace]);

  // Recent transactions sorted newest first
  const recentTransactions = useMemo(() => {
    return (transactions || [])
      .filter((t) => t && t.id)
      .sort((a, b) => {
        const timeB = new Date((b.date || '') + ' ' + (b.time || '00:00')).getTime() || 0;
        const timeA = new Date((a.date || '') + ' ' + (a.time || '00:00')).getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [transactions]);

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
    if (lower.includes('food')) return { bg: 'bg-[#e8f5f0]', text: 'text-[#0f4c3a]', dot: '#0f4c3a' };
    if (lower.includes('transport')) return { bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]', dot: '#0284c7' };
    if (lower.includes('data') || lower.includes('telecom')) return { bg: 'bg-[#ecfeff]', text: 'text-[#0e7490]', dot: '#0891b2' };
    if (lower.includes('academic')) return { bg: 'bg-[#f5f3ff]', text: 'text-[#6d28d9]', dot: '#7c3aed' };
    if (lower.includes('housing')) return { bg: 'bg-[#fef3c7]', text: 'text-[#b45309]', dot: '#d97706' };
    return { bg: 'bg-[#f3f4f6]', text: 'text-[#374151]', dot: '#6b7280' };
  };

  const firstName = userName.split(' ')[0] || 'Scholar';

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      
      {/* 1. Header & Greeting matching reference image */}
      <div className="space-y-3 animate-assemble-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {formatGreeting(firstName, now)}
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} · ALU Kigali Student Ledger
            </p>
          </div>

          <button
            onClick={onOpenAddModal}
            className="btn-pine self-start sm:self-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs text-white shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record New Expense</span>
          </button>
        </div>
      </div>

      {/* 2. Top Quick Stat Cards (like "Ongoing Exam / Overall Enroll" in reference image) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Stat 1: Budget Cap */}
        <div className="testora-card animate-assemble-left p-4 sm:p-5 flex flex-col justify-between" style={{ animationDelay: '70ms' }}>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium">Monthly Cap</span>
            <span className="w-2 h-2 rounded-full bg-[#0f4c3a]" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-extrabold text-gray-900 font-mono tabular-nums tracking-tight">
            {formatCurrency(budget.monthlyCap, currency)}
          </div>
          <div className="mt-1">
            <span className="inline-block text-[10px] font-semibold text-[#0f4c3a] bg-[#e8f5f0] px-2 py-0.5 rounded-full">
              Day {pace.currentDay} of {pace.totalDaysInMonth}
            </span>
          </div>
          <p className="mt-1 text-[9px] text-gray-400 leading-tight">
            Example default · edit below
          </p>
        </div>

        {/* Stat 2: Total Spent */}
        <div className="testora-card animate-assemble-up p-4 sm:p-5 flex flex-col justify-between" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium">Total Outflow</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-extrabold text-gray-900 font-mono tabular-nums tracking-tight">
            {formatCurrency(pace.totalSpent, currency)}
          </div>
          <div className="mt-1">
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              pace.paceStatus === 'danger'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {pace.percentageSpent.toFixed(0)}% of cap
            </span>
          </div>
        </div>

        {/* Stat 3: Remaining (spans 2 cols on mobile, 1 on sm) */}
        <div className="testora-card animate-assemble-right p-4 sm:p-5 col-span-2 sm:col-span-1 flex flex-col justify-between" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium">Remaining Funds</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-extrabold text-[#0f4c3a] font-mono tabular-nums tracking-tight">
            {formatCurrency(pace.remainingBudget, currency)}
          </div>
          <div className="mt-1">
            <span className="inline-block text-[10px] font-semibold text-emerald-800 bg-[#e8f5f0] px-2 py-0.5 rounded-full">
              {pace.daysRemaining} days left in cycle
            </span>
          </div>
        </div>
      </div>

      {/* 3. Featured Deep Pine Banner (matching "Manage Exams Like a Pro" in reference image) */}
      <div className="pine-hero-card animate-assemble-up p-6 sm:p-7" style={{ animationDelay: '250ms' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-medium border border-white/15">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>FR 6.3 Spending Pace Engine</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {pace.paceStatus === 'danger'
                ? 'Over Budget Alert'
                : pace.paceStatus === 'caution'
                ? 'Pacing Caution: Burning Fast'
                : 'Spending Pace is on Track'}
            </h2>

            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {pace.paceMessage}
            </p>

            <div className="pt-2">
              <button
                onClick={onOpenBudgetModal}
                className="btn-pill-subtle inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#0f4c3a] shadow-sm hover:bg-emerald-50 transition-all"
              >
                <span>Adjust Monthly Budget Cap</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <p className="mt-1.5 text-[10px] text-emerald-200/80 leading-relaxed">
                This figure is only an example. Set your own cap above, and change the cycle start day in Settings.
              </p>
            </div>
          </div>

          {/* Radial Donut Gauge (matching circular "43 min left" / "Total Enroll 249" in reference image) */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center bg-white/5 rounded-full border border-white/10">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#34d399"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min(1, pace.percentageSpent / 100))}`}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-base sm:text-lg font-bold font-mono text-white tabular-nums">
                {pace.percentageSpent.toFixed(0)}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-emerald-200">
                Spent
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MoMo SMS First-Time Tutorial Card (disappears after first trial / MoMo import) */}
      {showMoMoCard && (
        <div className="testora-card scroll-reveal-left p-5 sm:p-6 relative overflow-hidden border border-emerald-100 dark:border-emerald-900/50 bg-gradient-to-br from-white via-white to-emerald-50/40 dark:from-[#151a24] dark:to-[#17221e]">
          <button
            onClick={handleDismissMoMoCard}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Dismiss tutorial"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#e8f5f0] dark:bg-[#0f4c3a]/40 text-[#0f4c3a] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    First-Time Tutorial
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                  Mobile Money Rwanda SMS Import
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
                  <strong>How to use:</strong> Whenever you pay via MTN MoMo (*182#) or Airtel Money (Yego moto, campus canteen, groceries), copy the confirmation SMS and paste it here.
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  💡 Once you paste your first SMS, this card disappears and you can paste anytime using the <strong>MoMo</strong> button in the navigation bar!
                </p>
              </div>
            </div>

            <button
              onClick={onOpenMoMoModal}
              className="btn-pine w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-white shrink-0 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Paste First MoMo SMS</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Recurring Commitments & Fixed Outflows (FR 8) */}
      {recurringClusters.length > 0 && (
        <div className="testora-card scroll-reveal-right p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#fef8e7] text-[#b45309] flex items-center justify-center">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-gray-900">
                Detected Recurring Commitments (FR 8.1)
              </h3>
            </div>
            <button
              onClick={onOpenRecurring}
              className="text-xs font-semibold text-[#0f4c3a] hover:underline"
            >
              View all ({recurringClusters.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recurringClusters.slice(0, 2).map((cluster) => (
              <div
                key={cluster.id}
                className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between text-xs"
              >
                <div className="truncate mr-2">
                  <span className="font-semibold text-gray-900 block truncate">
                    {cluster.recipient || cluster.category}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {cluster.occurrences}x · {cluster.estimatedFrequency}
                  </span>
                </div>
                <span className="font-mono font-bold text-gray-900 tabular-nums shrink-0">
                  {formatCurrency(cluster.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Recent Expenditures List (matching clean white rows with rounded corners from reference) */}
      <div className="testora-card scroll-reveal-up overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-gray-900">
              Recent Transactions
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest items logged manually or extracted from SMS
            </p>
          </div>

          <button
            onClick={onViewAllExpenses}
            className="text-xs font-semibold text-[#0f4c3a] hover:underline flex items-center gap-1"
          >
            <span>See All ({transactions.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {recentTransactions.map((tx) => {
            const Icon = getCategoryIcon(tx.category);
            const theme = getCategoryTheme(tx.category);

            return (
              <div
                key={tx.id}
                onClick={() => onEditTransaction(tx)}
                className="p-4 flex items-center justify-between hover:bg-gray-50/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className={`w-9 h-9 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-[#0f4c3a] transition-colors">
                        {tx.note || tx.recipient || 'Expense'}
                      </span>
                      {tx.source === 'momo_sms' && (
                        <span className="text-[9px] font-mono font-bold text-[#0f4c3a] bg-[#e8f5f0] px-1.5 py-0.2 rounded border border-[#c5e6d8]">
                          MoMo
                        </span>
                      )}
                    </div>
                    {/* Zero-Pill unboxed metadata */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                      <span>{tx.category}</span>
                      <span aria-hidden="true" className="text-gray-300">·</span>
                      <span>{tx.date}</span>
                      {tx.recipient && (
                        <>
                          <span aria-hidden="true" className="text-gray-300">·</span>
                          <span className="truncate max-w-[120px] text-gray-600">{tx.recipient}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-xs sm:text-sm text-gray-900 tabular-nums block">
                    -{formatCurrency(tx.amount, currency)}
                  </span>
                  <span className="text-[10px] text-gray-400 group-hover:text-gray-600">
                    Edit →
                  </span>
                </div>
              </div>
            );
          })}

          {recentTransactions.length === 0 && (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#e8f5f0] text-[#0f4c3a] flex items-center justify-center mb-3 shadow-2xs">
                <ReceiptText className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-gray-900">Your expense ledger is fresh (0000)</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                You're starting with a clean slate. Tap "Record New Expense" or paste an MTN MoMo SMS to log your first transaction!
              </p>
              <button
                onClick={onOpenAddModal}
                className="mt-4 btn-pine inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Record First Expense</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
