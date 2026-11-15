export type CurrencyCode = 'RWF' | 'USD' | 'NGN' | 'KES' | 'UGX' | 'EUR' | 'GBP';

export interface Category {
  id: string;
  name: string;
  color: string;
  bgLight: string;
  iconName: string;
  keywords: string[];
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  note: string;
  recipient?: string;
  source: 'manual' | 'momo_sms';
  momoRef?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'irregular';
  createdAt: string;
  updatedAt: string;
}

export interface BudgetConfig {
  monthlyCap: number; // e.g. 150000 RWF
  cycleStartDay: number; // day of month (1-28)
  notifyThresholdPct: number; // default 80%
}

export interface UserProfile {
  name: string;
  email: string;
  studentId?: string;
  university: string;
  campus: string;
  currency: CurrencyCode;
  onboardingCompleted: boolean;
  avatarUrl?: string;
}

export interface RecurringCluster {
  id: string;
  category: string;
  amount: number;
  recipient?: string;
  occurrences: number;
  estimatedFrequency: 'weekly' | 'bi-weekly' | 'monthly';
  monthlyEstimate: number;
  transactions: Transaction[];
  lastDate: string;
}

export interface ParsedMoMoResult {
  success: boolean;
  amount?: number;
  currency?: string;
  recipient?: string;
  date?: string;
  time?: string;
  reference?: string;
  suggestedCategory?: string;
  rawText: string;
  confidence: number;
  error?: string;
}

export interface FilterOptions {
  searchQuery: string;
  category: string;
  dateRange: 'all' | 'today' | 'this_week' | 'this_month' | 'custom';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  source?: 'all' | 'manual' | 'momo_sms';
}

export interface UserAccount {
  uid?: string; // Firebase Authentication UID (source of truth for cloud data)
  email: string;
  password?: string; // Legacy local copies are stripped during migration; never returned by the server.
  name: string;
  studentId?: string;
  university?: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface UserStoreData {
  profile: UserProfile;
  budget: BudgetConfig;
  transactions: Transaction[];
  categories: Category[];
}
