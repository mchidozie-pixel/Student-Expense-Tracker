import { Transaction, BudgetConfig, UserProfile, Category, UserAccount, UserStoreData } from '../types';
import { DEFAULT_CATEGORIES } from './categorizer';

const STORAGE_KEYS = {
  TRANSACTIONS: 'alu_tracker_transactions_v1',
  BUDGET: 'alu_tracker_budget_v1',
  PROFILE: 'alu_tracker_profile_v1',
  CATEGORIES: 'alu_tracker_categories_v1',
};

export const INITIAL_USER_PROFILE: UserProfile = {
  name: 'Student User',
  email: '',
  studentId: 'ALU-KGL-2026',
  university: 'African Leadership University',
  campus: 'Kigali Innovation City, Rwanda',
  currency: 'RWF',
  onboardingCompleted: true,
};

export const INITIAL_BUDGET: BudgetConfig = {
  monthlyCap: 150000, // 150,000 RWF typical monthly budget cap
  cycleStartDay: 1,
  notifyThresholdPct: 80,
};

/**
 * Returns YYYY-MM-DD for the device's local calendar day.
 * Never use toISOString() for this: in Rwanda (UTC+2) it reports yesterday
 * between midnight and 2 AM, which would date new expenses wrongly.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Sample expenses are dated relative to today instead of a fixed month, so the
 * "Reset to Kigali seed data" action always lands inside the current budget
 * cycle (the dashboard and charts only read the active cycle).
 */
interface SampleTransactionTemplate {
  daysAgo: number;
  amount: number;
  category: string;
  time: string;
  note: string;
  recipient: string;
  source: 'manual' | 'momo_sms';
  momoRef?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly';
}

const SAMPLE_TRANSACTION_TEMPLATES: SampleTransactionTemplate[] = [
  {
    daysAgo: 14,
    amount: 45000,
    category: 'Housing & Living',
    time: '09:30',
    note: 'Student room contribution in Bumbogo',
    recipient: 'Kigali Student Housing',
    source: 'manual',
    isRecurring: true,
    recurringFrequency: 'monthly',
  },
  {
    daysAgo: 12,
    amount: 2500,
    category: 'Food & Dining',
    time: '12:45',
    note: 'ALU Cafeteria lunch buffet & drink',
    recipient: 'ALU Cafeteria Bumbogo',
    source: 'momo_sms',
    momoRef: '99182371',
  },
  {
    daysAgo: 10,
    amount: 1500,
    category: 'Transport',
    time: '08:15',
    note: 'Yego moto ride from Kimironko to ALU Campus',
    recipient: 'YEGO MOTO RA 492 B',
    source: 'momo_sms',
    momoRef: '882910245',
  },
  {
    daysAgo: 9,
    amount: 2000,
    category: 'Data & Airtime',
    time: '11:20',
    note: 'MTN 10GB Weekly Student Internet Pack',
    recipient: 'MTN Rwanda Data',
    source: 'momo_sms',
    momoRef: '7726182901',
    isRecurring: true,
    recurringFrequency: 'weekly',
  },
  {
    daysAgo: 8,
    amount: 3200,
    category: 'Academics & Study',
    time: '15:10',
    note: 'Software requirements documentation printing & spiral binding',
    recipient: 'Innovation City Print Shop',
    source: 'manual',
  },
  {
    daysAgo: 7,
    amount: 4500,
    category: 'Food & Dining',
    time: '18:40',
    note: 'Weekly essentials and milk at Simba Supermarket',
    recipient: 'SIMBA SUPERMARKET KIMIHURURA',
    source: 'momo_sms',
    momoRef: '1029381923',
  },
  {
    daysAgo: 6,
    amount: 5000,
    category: 'Housing & Living',
    time: '10:05',
    note: 'Shared apartment cashpower electricity units',
    recipient: 'REG CASHPOWER TOKEN',
    source: 'momo_sms',
    momoRef: '661928401',
  },
  {
    daysAgo: 5,
    amount: 2000,
    category: 'Data & Airtime',
    time: '11:25',
    note: 'MTN 10GB Weekly Student Internet Pack',
    recipient: 'MTN Rwanda Data',
    source: 'momo_sms',
    momoRef: '7729910211',
    isRecurring: true,
    recurringFrequency: 'weekly',
  },
  {
    daysAgo: 3,
    amount: 1500,
    category: 'Transport',
    time: '08:40',
    note: 'Yego moto ride to campus for group meeting',
    recipient: 'YEGO MOTO RA 492 B',
    source: 'manual',
  },
  {
    daysAgo: 1,
    amount: 2500,
    category: 'Food & Dining',
    time: '13:00',
    note: 'Campus lunch with study group',
    recipient: 'ALU Cafeteria Bumbogo',
    source: 'manual',
  },
  {
    daysAgo: 0,
    amount: 2000,
    category: 'Data & Airtime',
    time: '11:15',
    note: 'MTN 10GB Weekly Student Internet Pack',
    recipient: 'MTN Rwanda Data',
    source: 'momo_sms',
    momoRef: '7731992019',
    isRecurring: true,
    recurringFrequency: 'weekly',
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = SAMPLE_TRANSACTION_TEMPLATES.map((template, index) => {
  const day = new Date();
  day.setDate(day.getDate() - template.daysAgo);
  const date = toLocalDateString(day);
  return {
    id: `tx-${index + 1}`,
    amount: template.amount,
    category: template.category,
    date,
    time: template.time,
    note: template.note,
    recipient: template.recipient,
    source: template.source,
    momoRef: template.momoRef,
    isRecurring: template.isRecurring,
    recurringFrequency: template.recurringFrequency,
    createdAt: `${date}T${template.time}:00.000Z`,
    updatedAt: `${date}T${template.time}:00.000Z`,
  };
});

export function loadTransactions(): Transaction[] {
  try {
    const sessionEmail = getCurrentSession();
    if (sessionEmail) {
      const store = getUserStore(sessionEmail);
      return store.transactions;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) {
      saveTransactions(INITIAL_TRANSACTIONS);
      return INITIAL_TRANSACTIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load transactions from localStorage', e);
    return INITIAL_TRANSACTIONS;
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    const sessionEmail = getCurrentSession();
    if (sessionEmail) {
      const store = getUserStore(sessionEmail);
      store.transactions = transactions;
      saveUserStore(sessionEmail, store);
    }
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save transactions to localStorage', e);
  }
}

export function loadBudget(): BudgetConfig {
  try {
    const sessionEmail = getCurrentSession();
    if (sessionEmail) {
      const store = getUserStore(sessionEmail);
      return store.budget;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) return INITIAL_BUDGET;
    return JSON.parse(raw);
  } catch {
    return INITIAL_BUDGET;
  }
}

export function saveBudget(budget: BudgetConfig): void {
  const sessionEmail = getCurrentSession();
  if (sessionEmail) {
    const store = getUserStore(sessionEmail);
    store.budget = budget;
    saveUserStore(sessionEmail, store);
  }
  localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(budget));
}

export function loadProfile(): UserProfile {
  try {
    const sessionEmail = getCurrentSession();
    if (sessionEmail) {
      const store = getUserStore(sessionEmail);
      return store.profile;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) return INITIAL_USER_PROFILE;
    return JSON.parse(raw);
  } catch {
    return INITIAL_USER_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  const sessionEmail = getCurrentSession();
  if (sessionEmail) {
    const store = getUserStore(sessionEmail);
    store.profile = profile;
    saveUserStore(sessionEmail, store);
  }
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

export function loadCategories(): Category[] {
  try {
    const sessionEmail = getCurrentSession();
    if (sessionEmail) {
      const store = getUserStore(sessionEmail);
      return store.categories;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) return DEFAULT_CATEGORIES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategories(categories: Category[]): void {
  const sessionEmail = getCurrentSession();
  if (sessionEmail) {
    const store = getUserStore(sessionEmail);
    store.categories = categories;
    saveUserStore(sessionEmail, store);
  }
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
}

// ================= USER ACCOUNT & AUTH PERSISTENCE =================

const USERS_STORAGE_KEY = 'alu_registered_users_v2';
const SESSION_STORAGE_KEY = 'alu_active_session_v2';
const USER_STORE_PREFIX = 'alu_user_store_v2_';

export function getRegisteredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    // Older versions kept passwords in browser storage. Remove them from the saved cache.
    const users = stored
      .filter((u) => u && typeof u.email === 'string')
      .map(({ password: _password, ...user }) => user as UserAccount);
    if (JSON.stringify(users) !== raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
    return users;
  } catch {
    return [];
  }
}

export function findUser(email: string): UserAccount | undefined {
  const users = getRegisteredUsers();
  return users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
}

export function maskEmail(email: string): string {
  const clean = email.trim();
  if (!clean || !clean.includes('@')) return clean;
  const [name, domain] = clean.split('@');
  if (name.length <= 1) {
    return `${name}***@${domain}`;
  }
  return `${name[0]}***@${domain}`;
}

export function getCurrentSession(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentSession(email: string | null): void {
  try {
    if (email) {
      localStorage.setItem(SESSION_STORAGE_KEY, email.trim().toLowerCase());
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to set current session', e);
  }
}

export function getUserStore(email: string): UserStoreData {
  const cleanEmail = email.trim().toLowerCase();
  const key = `${USER_STORE_PREFIX}${cleanEmail}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading user store', e);
  }

  // If none exists, create fresh empty store
  const fresh: UserStoreData = {
    profile: {
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      studentId: `ALU-${Math.floor(1000 + Math.random() * 9000)}`,
      university: 'African Leadership University',
      campus: 'Kigali Innovation City, Rwanda',
      currency: 'RWF',
      onboardingCompleted: true,
    },
    budget: {
      monthlyCap: 150000,
      cycleStartDay: 1,
      notifyThresholdPct: 80,
    },
    transactions: [],
    categories: DEFAULT_CATEGORIES,
  };
  localStorage.setItem(key, JSON.stringify(fresh));
  return fresh;
}

export function saveUserStore(email: string, store: UserStoreData): void {
  const cleanEmail = email.trim().toLowerCase();
  const key = `${USER_STORE_PREFIX}${cleanEmail}`;
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save user store', e);
  }
}

export function updateUserAvatar(email: string, avatarUrl: string): void {
  const cleanEmail = email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (user) {
    user.avatarUrl = avatarUrl;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }
  const store = getUserStore(cleanEmail);
  store.profile.avatarUrl = avatarUrl;
  saveUserStore(cleanEmail, store);
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(store.profile));
}

/**
 * Format currency with tabular figures and chosen currency code.
 */
export function formatCurrency(amount: number, currency: string = 'RWF'): string {
  const formattedNumber = Math.round(amount).toLocaleString('en-US');
  if (currency === 'RWF') {
    return `${formattedNumber} RWF`;
  }
  if (currency === 'USD') return `$${formattedNumber}`;
  if (currency === 'EUR') return `€${formattedNumber}`;
  if (currency === 'GBP') return `£${formattedNumber}`;
  return `${currency} ${formattedNumber}`;
}

/**
 * Calculates current cycle's spending pace and alert metrics.
 * Respects the student's chosen cycle start day (Settings) so "Day X of Y"
 * and "days left" always match the budget cycle they actually selected.
 */
export function calculateBudgetPace(
  transactions: Transaction[],
  budgetCap: number,
  cycleStartDay: number = 1
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Cycle start days above 28 would not exist in every month; clamp safely.
  const startDay = Math.min(Math.max(Math.round(Number(cycleStartDay) || 1), 1), 28);

  // Current cycle began this month, or last month if the start day is ahead.
  let cycleStart = new Date(today.getFullYear(), today.getMonth(), startDay);
  if (today < cycleStart) {
    cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, startDay);
  }
  // Exclusive end boundary: the next cycle's start.
  const nextCycleStart = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, startDay);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const totalDaysInMonth = Math.round((nextCycleStart.getTime() - cycleStart.getTime()) / MS_PER_DAY);
  const elapsedDays = Math.round((today.getTime() - cycleStart.getTime()) / MS_PER_DAY) + 1;
  const currentDay = Math.min(Math.max(elapsedDays, 1), totalDaysInMonth);

  const parseLocalDate = (isoDate: string): Date | null => {
    const parts = (isoDate || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  // Transactions inside the selected budget cycle only.
  const currentMonthTransactions = (transactions || []).filter((t) => {
    const d = parseLocalDate(t?.date || '');
    return d !== null && d >= cycleStart && d < nextCycleStart;
  });

  const totalSpent = currentMonthTransactions.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  const remainingBudget = Math.max(0, budgetCap - totalSpent);
  const percentageSpent = budgetCap > 0 ? (totalSpent / budgetCap) * 100 : 0;

  // Percentage of the cycle elapsed
  const percentageMonthElapsed = (currentDay / totalDaysInMonth) * 100;
  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay);

  // Daily run rate
  const averageDailySpendSoFar = currentDay > 0 ? totalSpent / currentDay : 0;
  const recommendedDailyBudgetRemaining = remainingBudget / daysRemaining;

  // Pace status
  let paceStatus: 'safe' | 'caution' | 'danger' = 'safe';
  let paceMessage = '';

  if (totalSpent > budgetCap) {
    paceStatus = 'danger';
    const overspend = totalSpent - budgetCap;
    paceMessage = `Budget exceeded by ${Math.round(overspend).toLocaleString()}! You have 0 remaining with ${daysRemaining} days left.`;
  } else if (percentageSpent >= 90) {
    paceStatus = 'danger';
    paceMessage = `Critical: You've used ${percentageSpent.toFixed(0)}% of your monthly cap with ${daysRemaining} days remaining.`;
  } else if (percentageSpent > percentageMonthElapsed + 15) {
    paceStatus = 'caution';
    paceMessage = `Pacing Alert: You've spent ${percentageSpent.toFixed(0)}% of your budget, but only ${percentageMonthElapsed.toFixed(0)}% of the month has passed.`;
  } else {
    paceStatus = 'safe';
    paceMessage = `Healthy pace: Spending is on track. Suggested allowance: ${Math.round(recommendedDailyBudgetRemaining).toLocaleString()} / day.`;
  }

  return {
    totalSpent,
    budgetCap,
    remainingBudget,
    percentageSpent,
    percentageMonthElapsed,
    daysRemaining,
    totalDaysInMonth,
    currentDay,
    averageDailySpendSoFar,
    recommendedDailyBudgetRemaining,
    paceStatus,
    paceMessage,
    currentMonthTransactions,
  };
}

/**
 * Generates CSV string from transaction records. Meets FR 10.1.
 */
export function generateCSV(transactions: Transaction[], currency: string = 'RWF'): string {
  const headers = ['Transaction ID', 'Date', 'Time', 'Category', 'Amount', 'Currency', 'Recipient / Merchant', 'Note', 'Source', 'MoMo Reference'];
  
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.time || '',
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.amount,
    currency,
    `"${(t.recipient || '').replace(/"/g, '""')}"`,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    t.source,
    t.momoRef || '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Triggers browser download of CSV file.
 */
export function downloadCSV(transactions: Transaction[], currency: string = 'RWF', filename = 'alu-student-expenses.csv') {
  const csvContent = generateCSV(transactions, currency);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Data migration runner for version upgrades.
 * Ensures accounts, transactions, and budget settings are preserved without data loss.
 */
export function runDataMigrations(currentVersion: string = '1.1'): void {
  try {
    localStorage.removeItem('alu_reset_codes_vault_v1');
    const users = getRegisteredUsers();
    const storedSchemaVersion = localStorage.getItem('alu_schema_version');
    if (storedSchemaVersion === currentVersion) {
      return;
    }

    // 1. Retain cached profiles and stores; getRegisteredUsers removes legacy passwords.
    if (Array.isArray(users)) {
      // Ensure all user stores have complete schema
      users.forEach((u) => {
        if (u.email) {
          const store = getUserStore(u.email);
          if (store) {
            if (!Array.isArray(store.transactions)) store.transactions = [];
            if (!store.budget) store.budget = INITIAL_BUDGET;
            if (!store.profile) store.profile = INITIAL_USER_PROFILE;
            if (!Array.isArray(store.categories)) store.categories = DEFAULT_CATEGORIES;
            saveUserStore(u.email, store);
          }
        }
      });
    }

    // 2. Mark schema as updated
    localStorage.setItem('alu_schema_version', currentVersion);
  } catch (err) {
    console.error('Data migration notice:', err);
  }
}

