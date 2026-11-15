import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Tags, 
  Database, 
  HelpCircle, 
  Check, 
  Plus, 
  Trash2, 
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Eraser,
  CalendarDays,
  GraduationCap,
  KeyRound,
  IdCard,
  Sliders,
  Camera,
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
  AlertCircle,
  Bug,
  Send
} from 'lucide-react';
import { UserProfile, BudgetConfig, Category, CurrencyCode, UserAccount } from '../types';
import { sendBugReport } from '../lib/bugReport';
import { formatCurrency } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APP_VERSION, compareVersions } from '../version';

interface SettingsViewProps {
  profile: UserProfile;
  budget: BudgetConfig;
  categories: Category[];
  currency: string;
  transactionsCount: number;
  onUpdateProfile: (p: UserProfile) => void;
  onUpdateBudget: (b: BudgetConfig) => void;
  onUpdateCategories: (cats: Category[]) => void;
  onResetData: () => void;
  onClearAllRecords: () => void;
  onOpenHelp: () => void;
  onOpenOnboarding: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  userAccount?: UserAccount | null;
  onLogout?: () => void;
  onBackToDashboard?: () => void;
  onUpdateAvatar?: (url: string) => void;
  onOpenPhotoModal?: () => void;
  onRequestRemoveAvatar?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  budget,
  categories,
  currency,
  transactionsCount,
  onUpdateProfile,
  onUpdateBudget,
  onUpdateCategories,
  onResetData,
  onClearAllRecords,
  onOpenHelp,
  onOpenOnboarding,
  isDark = false,
  onToggleTheme,
  userAccount,
  onLogout,
  onBackToDashboard,
  onUpdateAvatar,
  onOpenPhotoModal,
  onRequestRemoveAvatar,
}) => {
  useScrollReveal([transactionsCount, categories.length]);

  const [name, setName] = useState(profile.name || userAccount?.name || '');
  const [email, setEmail] = useState(profile.email || userAccount?.email || '');
  const [studentId, setStudentId] = useState(profile.studentId || userAccount?.studentId || 'ALU-KGL-2026');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(profile.currency || 'RWF');
  const [monthlyCap, setMonthlyCap] = useState((budget.monthlyCap || 150000).toString());
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state whenever profile or userAccount props change
  useEffect(() => {
    setName(profile.name || userAccount?.name || '');
    setEmail(profile.email || userAccount?.email || '');
    setStudentId(profile.studentId || userAccount?.studentId || 'ALU-KGL-2026');
    setSelectedCurrency(profile.currency || 'RWF');
  }, [profile, userAccount]);

  useEffect(() => {
    if (budget?.monthlyCap) {
      setMonthlyCap(budget.monthlyCap.toString());
    }
  }, [budget?.monthlyCap]);

  // Modals for "Are you sure?" confirmation
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isWipeTrimesterConfirmOpen, setIsWipeTrimesterConfirmOpen] = useState(false);
  const [isResetSeedConfirmOpen, setIsResetSeedConfirmOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#0f4c3a');
  const [newCatKeywords, setNewCatKeywords] = useState('');

  // Check for new updates state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    checked: boolean;
    hasUpdate: boolean;
    version?: string;
    notes?: string[];
    error?: string;
    lastChecked?: string;
  } | null>(null);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  // Report a bug state
  const [bugMessage, setBugMessage] = useState('');
  const [bugSending, setBugSending] = useState(false);
  const [bugSent, setBugSent] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateResult(null);
    const stamp = () =>
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const [res] = await Promise.all([
        fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' }),
        new Promise((r) => setTimeout(r, 650)),
      ]);

      // Also ask the service worker to look for a freshly published build.
      let swWaiting = false;
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update().catch(() => {});
            swWaiting = Boolean(reg.waiting);
          }
        }
      } catch {}

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('json')) {
        const data = await res.json();
        const serverVer = typeof data.version === 'string' ? data.version.trim() : '';
        const serverNotes = Array.isArray(data.releaseNotes) ? data.releaseNotes : [];
        const hasNewVersion = Boolean(serverVer) && compareVersions(serverVer, APP_VERSION) > 0;

        setUpdateResult({
          checked: true,
          hasUpdate: hasNewVersion || swWaiting,
          version: hasNewVersion ? serverVer : APP_VERSION,
          notes: serverNotes,
          lastChecked: stamp(),
        });
        return;
      }

      // version.json is unavailable (e.g., running in dev). Fall back to the
      // service worker's own update detection.
      setUpdateResult({
        checked: true,
        hasUpdate: swWaiting,
        version: APP_VERSION,
        notes: [],
        lastChecked: stamp(),
      });
    } catch {
      setUpdateResult({
        checked: true,
        hasUpdate: false,
        error: 'Unable to reach the update server. Please check your network connection.',
        lastChecked: stamp(),
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdatingApp(true);
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 1500);
            navigator.serviceWorker.addEventListener(
              'controllerchange',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true }
            );
            registration.waiting!.postMessage({ type: 'SKIP_WAITING' });
          });
        } else if (registration) {
          await registration.update().catch(() => {});
        }
      }
      // App reads this from localStorage to show the "What's New" notes once.
      localStorage.setItem('alu_show_whats_new', updateResult?.version || APP_VERSION);
    } catch {}

    window.location.reload();
  };

  const handleSubmitBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBugError(null);
    setBugSent(false);

    const message = bugMessage.trim();
    if (message.length < 5) {
      setBugError('Please describe the problem in a sentence or two.');
      return;
    }

    setBugSending(true);
    try {
      const { emailed, stored } = await sendBugReport(userAccount?.uid || '', {
        message,
        email: userAccount?.email || profile.email || '',
        name: userAccount?.name || profile.name || '',
      });
      if (!emailed && !stored) {
        setBugError('Could not send your report right now. Please try again.');
        return;
      }
      setBugSent(true);
      setBugMessage('');
    } catch (err: any) {
      console.warn('[Bug report]', err?.code || err?.message || err);
      setBugError('Could not send your report right now. Please try again.');
    } finally {
      setBugSending(false);
    }
  };

  const currencies: { code: CurrencyCode; label: string }[] = [
    { code: 'RWF', label: 'Rwandan Franc (RWF / FRW)' },
    { code: 'USD', label: 'US Dollar ($ USD)' },
    { code: 'NGN', label: 'Nigerian Naira (₦ NGN)' },
    { code: 'KES', label: 'Kenyan Shilling (KES)' },
    { code: 'UGX', label: 'Ugandan Shilling (UGX)' },
    { code: 'EUR', label: 'Euro (€ EUR)' },
    { code: 'GBP', label: 'British Pound (£ GBP)' },
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const capNum = parseFloat(monthlyCap) || 150000;

    const updatedProfile: UserProfile = {
      ...profile,
      name: name.trim() || profile.name || userAccount?.name || 'ALU Scholar',
      email: userAccount?.email || profile.email || '',
      studentId: studentId.trim() || profile.studentId || 'ALU-KGL-2026',
      currency: selectedCurrency,
    };

    onUpdateProfile(updatedProfile);

    onUpdateBudget({
      ...budget,
      monthlyCap: capNum,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const keywordsList = newCatKeywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    const newCategory: Category = {
      id: `custom-${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
      bgLight: '#f8faf9',
      iconName: 'Tag',
      keywords: keywordsList.length > 0 ? keywordsList : [newCatName.toLowerCase()],
    };

    onUpdateCategories([...categories, newCategory]);
    setNewCatName('');
    setNewCatKeywords('');
  };

  const handleDeleteCategory = (catId: string) => {
    if (categories.length <= 1) return;
    onUpdateCategories(categories.filter((c) => c.id !== catId));
  };

  const heroFileInputRef = useRef<HTMLInputElement>(null);

  const handleHeroPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 256;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            onUpdateAvatar?.(compressed);
          } else {
            onUpdateAvatar?.(result);
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const studentDisplayName = userAccount?.name || profile.name || 'ALU Scholar';
  const studentDisplayEmail = userAccount?.email || profile.email || 'student@alustudent.com';
  const studentDisplayId = profile.studentId || userAccount?.studentId || 'ALU-KGL-2026';

  return (
    <div className="space-y-5 pb-24 md:pb-12 max-w-4xl mx-auto w-full px-1">
      
      {/* Back to Dashboard Navigation Link */}
      {onBackToDashboard && (
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c3a] dark:text-emerald-400 hover:text-[#155d47] dark:hover:text-emerald-300 transition-colors cursor-pointer bg-white dark:bg-[#121620] px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-[#222a3a] shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a2333] px-2.5 py-1 rounded-full">
            Student Profile &amp; Settings
          </span>
        </div>
      )}

      {/* 1. STUDENT IDENTITY HERO CARD (Positioned right at the top with Photo Upload) */}
      <div className="testora-card scroll-reveal-up p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Student Profile Identity Lockup with interactive Picture Upload */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-14 h-14 rounded-2xl ring-2 ring-[#0f4c3a]/30 dark:ring-emerald-500/30 overflow-hidden bg-[#0f4c3a] text-white font-bold flex items-center justify-center text-lg shadow-sm">
                {(profile.avatarUrl || userAccount?.avatarUrl) ? (
                  <img 
                    src={profile.avatarUrl || userAccount?.avatarUrl} 
                    alt={studentDisplayName} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  studentDisplayName.charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenPhotoModal?.()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#0f4c3a] text-white hover:bg-[#155d47] shadow-md cursor-pointer transition-transform hover:scale-110"
                title="Upload, center or change profile picture"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                  {studentDisplayName}
                </h2>
                <span className="text-[10px] font-mono font-semibold bg-gray-100 dark:bg-[#1c2333] text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 shrink-0">
                  {studentDisplayId}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {studentDisplayEmail}
              </p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onOpenPhotoModal?.()}
                  className="text-[11px] font-semibold text-[#0f4c3a] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  <span>{(profile.avatarUrl || userAccount?.avatarUrl) ? 'Center or Change Photo' : 'Upload Profile Picture'}</span>
                </button>
                {(profile.avatarUrl || userAccount?.avatarUrl) && (
                  <button
                    type="button"
                    onClick={() => onRequestRemoveAvatar?.()}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions (Log out & records count) */}
          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-[#1e2638] self-stretch sm:self-auto justify-between sm:justify-end">
            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
              {transactionsCount} records logged
            </span>
            {onLogout && (
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. SECTION TITLE: Settings & Preferences */}
      <div className="pt-1">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#0f4c3a] dark:text-emerald-400" />
          <span>Settings &amp; Preferences</span>
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
          Customize theme appearance, currency display, budget ceiling, and custom categories
        </p>
      </div>

      {/* 3. APPEARANCE & THEME MODE */}
      <div className="testora-card scroll-reveal-left delay-1 p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-[#1e2638]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#e8f5f0] dark:bg-emerald-950/60 text-[#0f4c3a] dark:text-emerald-300 flex items-center justify-center shrink-0">
              {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Appearance &amp; Theme Mode
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Choose between porcelain clean light theme or deep obsidian dark mode
              </p>
            </div>
          </div>
          
          <span className="text-[11px] font-semibold text-[#0f4c3a] dark:text-emerald-400 bg-[#e8f5f0] dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40 self-start sm:self-auto shrink-0">
            Active: {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
        </div>

        {/* Responsive Theme Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mt-3.5">
          <button
            type="button"
            onClick={() => {
              if (isDark && onToggleTheme) onToggleTheme();
            }}
            className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              !isDark
                ? 'border-[#0f4c3a] bg-emerald-50/50 ring-2 ring-[#0f4c3a]/20 shadow-xs'
                : 'border-gray-200 dark:border-[#222a3a] bg-gray-50 dark:bg-[#0c0f16] hover:border-gray-300'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-900 dark:text-white">Light Porcelain</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Crisp high-contrast day theme</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isDark && onToggleTheme) onToggleTheme();
            }}
            className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              isDark
                ? 'border-emerald-500 bg-emerald-950/30 ring-2 ring-emerald-500/20 shadow-xs'
                : 'border-gray-200 dark:border-[#222a3a] bg-gray-50 dark:bg-[#0c0f16] hover:border-gray-300'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-950 text-indigo-300 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-900 dark:text-white">Obsidian Dark</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">OLED-friendly nighttime theme</div>
            </div>
          </button>
        </div>
      </div>

      {/* 4. STUDENT PROFILE & CURRENCY DISPLAY FORM */}
      <div className="testora-card scroll-reveal-right delay-2 p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm">
        <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-gray-100 dark:border-[#1e2638]">
          <div className="w-7 h-7 rounded-xl bg-[#e8f5f0] dark:bg-emerald-950/60 text-[#0f4c3a] dark:text-emerald-300 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Student Profile &amp; Currency Preferences
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Student Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
                title="Your sign-in email is managed by Firebase Authentication."
                className="w-full p-2.5 bg-gray-100 dark:bg-[#0c0f16]/60 border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                This is your sign-in email and cannot be edited here.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Student ID / Matric
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white font-mono focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 transition-all"
              />
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                Example placeholder generated for your account. Replace it with your real ALU matric number; it appears on exported statements.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Display Currency
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
                className="w-full p-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 transition-all"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code} className="bg-white dark:bg-[#121620] text-gray-900 dark:text-white">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Monthly Spending Ceiling ({selectedCurrency})
              </label>
              <input
                type="number"
                min="1"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl font-mono font-bold text-gray-900 dark:text-white text-sm focus:bg-white dark:focus:bg-[#0e121a] focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 tabular-nums transition-all"
              />
              <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">
                Calculates daily spending runway and triggers pace warnings if burn-rate is too fast.
              </span>
            </div>
          </div>

          <div className="pt-2.5 flex items-center justify-between border-t border-gray-100 dark:border-[#1e2638]">
            {savedSuccess ? (
              <span className="text-xs font-semibold text-[#0f4c3a] dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                <Check className="w-4 h-4 text-[#0f4c3a] dark:text-emerald-400" />
                <span>Saved successfully!</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="btn-pine px-4 sm:px-5 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>

      {/* 5. CUSTOM CATEGORIES & KEYWORD RULES */}
      <div className="testora-card scroll-reveal-left delay-1 p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 dark:border-[#1e2638]">
          <div className="w-7 h-7 rounded-xl bg-[#e8f5f0] dark:bg-emerald-950/60 text-[#0f4c3a] dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Tags className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Categories &amp; Auto-Matcher Keywords
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Keywords automatically trigger category matching during manual entry and MoMo SMS parsing
            </p>
          </div>
        </div>

        {/* Existing Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-3 bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] rounded-xl flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{cat.name}</span>
                </div>
                {categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(cat)}
                    className="text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    title={`Delete category ${cat.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                <strong>Keywords:</strong> {cat.keywords.slice(0, 5).join(', ')}...
              </div>
            </div>
          ))}
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="p-3 sm:p-3.5 bg-gray-50 dark:bg-[#0c0f16] rounded-xl border border-gray-200 dark:border-[#222a3a] space-y-2.5">
          <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[#0f4c3a] dark:text-emerald-400" />
            <span>Add New Category</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Category Name
              </label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Gym & Fitness"
                className="w-full p-2 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Color Accent
              </label>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-full h-8 p-1 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Keywords (comma separated)
              </label>
              <input
                type="text"
                value={newCatKeywords}
                onChange={(e) => setNewCatKeywords(e.target.value)}
                placeholder="gym, workout, fitness"
                className="w-full p-2 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="btn-pine inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>
        </form>
      </div>

      {/* 6. HELP & SUPPORT: REPORT A BUG */}
      <div className="testora-card scroll-reveal-up p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 dark:border-[#1e2638]">
          <div className="w-7 h-7 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Bug className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Help &amp; Support
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Something not working? Send a report straight to the app owner.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitBugReport} className="space-y-2.5">
          <textarea
            value={bugMessage}
            onChange={(e) => {
              setBugMessage(e.target.value);
              setBugError(null);
              setBugSent(false);
            }}
            rows={3}
            maxLength={2000}
            placeholder="Describe what happened, and what you were doing when it happened…"
            className="w-full p-3 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0f4c3a] dark:focus:ring-emerald-500 resize-y"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {bugError ? (
              <p className="text-[10px] leading-relaxed text-rose-600 dark:text-rose-400">{bugError}</p>
            ) : bugSent ? (
              <p className="text-[10px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                Thank you — your report was sent to the app owner.
              </p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={bugSending}
              className="btn-pine inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{bugSending ? 'Sending…' : 'Send Report'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 7. TRIMESTER WIPE (0000 FRESH SLATE) & SAMPLE DATA RESTORE */}
      <div className="testora-card scroll-reveal-up delay-2 p-4 sm:p-5 bg-white dark:bg-[#121620] border border-gray-200 dark:border-[#222a3a] rounded-2xl sm:rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 dark:border-[#1e2638]">
          <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Academic Trimester Wipe &amp; Data Maintenance
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Clear all records for a new trimester or reload verified Kigali demo records
            </p>
          </div>
        </div>

        {/* Trimester Wipe Card */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <Eraser className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-950 dark:text-rose-300">
                Wipe Ledger &amp; Start Fresh Trimester (0000)
              </div>
              <div className="text-[11px] text-rose-700/80 dark:text-rose-400 mt-0.5 leading-relaxed">
                {transactionsCount === 0
                  ? 'Your ledger is already empty. There is nothing to wipe yet.'
                  : `Permanently wipes all ${transactionsCount} recorded expenses and resets your dashboard to 0000 so you can start a fresh trimester. Your student profile and login are preserved.`}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={transactionsCount === 0}
            onClick={() => setIsWipeTrimesterConfirmOpen(true)}
            className="self-start sm:self-auto px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-full shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600"
          >
            {transactionsCount === 0 ? 'Nothing to Clear' : 'Clear Everything (0000)'}
          </button>
        </div>

        {/* Sample Data Reload */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-gray-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-[#222a3a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center shrink-0 mt-0.5">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 dark:text-white">
                Load Authentic Kigali Sample Dataset
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Loads 28 authentic Rwandan student expenses (Simba Supermarket, Bumbogo moto taxi, MTN data bundles) for testing.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsResetSeedConfirmOpen(true)}
            className="self-start sm:self-auto px-4 py-2 text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#161c28] transition-colors cursor-pointer shrink-0"
          >
            Reset to Kigali Seed Data
          </button>
        </div>

        {/* App Version & Interactive Update Checker */}
        <div className="pt-4 border-t border-gray-100 dark:border-[#1e2638] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Version {APP_VERSION}
                </span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full font-mono">
                  Current Release
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                African Leadership University · Kigali Innovation City
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate || isUpdatingApp}
              className="self-start sm:self-auto btn-pine inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Checking for Updates...' : 'Check for New Updates'}</span>
            </button>
          </div>

          {/* Update Check Results */}
          {updateResult && (
            <div className="animate-in fade-in duration-200">
              {updateResult.hasUpdate ? (
                <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>New Update Available: v{updateResult.version}</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      Checked {updateResult.lastChecked}
                    </span>
                  </div>

                  {updateResult.notes && updateResult.notes.length > 0 && (
                    <ul className="text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1 pl-4 list-disc">
                      {updateResult.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={handleApplyUpdate}
                    disabled={isUpdatingApp}
                    className="w-full sm:w-auto btn-pine px-4 py-2 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 ${isUpdatingApp ? 'animate-bounce' : ''}`} />
                    <span>{isUpdatingApp ? 'Applying Update & Refreshing...' : `Update to v${updateResult.version} Now`}</span>
                  </button>
                </div>
              ) : updateResult.error ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{updateResult.error}</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>You're on the latest version (v{APP_VERSION}) · All systems up to date.</span>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                    Checked {updateResult.lastChecked}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modals (Every destructive action and logout asks "Are you sure?") */}
      
      {/* 1. Category Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title="Delete Category?"
        message={`Are you sure you want to remove "${categoryToDelete?.name}"? Any previously recorded transactions in this category will keep their label.`}
        confirmLabel="Yes, Delete Category"
        isDestructive={true}
        iconType="delete"
        onConfirm={() => {
          if (categoryToDelete) {
            handleDeleteCategory(categoryToDelete.id);
            setCategoryToDelete(null);
          }
        }}
        onCancel={() => setCategoryToDelete(null)}
      />

      {/* 2. Trimester Wipe Confirmation */}
      <ConfirmModal
        isOpen={isWipeTrimesterConfirmOpen}
        title="Wipe Ledger & Start New Trimester?"
        message={`Are you sure you want to clear your records entirely? This will permanently wipe all ${transactionsCount} recorded expenses and reset your dashboard metrics to 0000 so you can start a fresh trimester. This cannot be undone.`}
        confirmLabel="Yes, Clear Everything (0000)"
        isDestructive={true}
        iconType="reset"
        onConfirm={() => {
          onClearAllRecords();
          setIsWipeTrimesterConfirmOpen(false);
        }}
        onCancel={() => setIsWipeTrimesterConfirmOpen(false)}
      />

      {/* 3. Reset Seed Confirmation */}
      <ConfirmModal
        isOpen={isResetSeedConfirmOpen}
        title="Reset to Kigali Sample Dataset?"
        message="Are you sure you want to reload the sample data? This will replace your current transactions with 28 authentic ALU Kigali student expenses (Simba Supermarket, Bumbogo moto taxi, MTN Airtime, etc.)."
        confirmLabel="Yes, Load Sample Data"
        isDestructive={true}
        iconType="warning"
        onConfirm={() => {
          onResetData();
          setIsResetSeedConfirmOpen(false);
        }}
        onCancel={() => setIsResetSeedConfirmOpen(false)}
      />

      {/* 4. Logout Confirmation */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        title="Log Out of Your Account?"
        message={`Are you sure you want to log out of ${studentDisplayEmail}? All your transactions, budget caps, and settings are saved securely and will be available whenever you log back in.`}
        confirmLabel="Yes, Log Out"
        isDestructive={false}
        iconType="logout"
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          if (onLogout) onLogout();
        }}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />
    </div>
  );
};
