import React, { useState, useRef, useEffect } from 'react';
import { 
  Wallet, 
  ReceiptText, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Smartphone, 
  Repeat,
  Camera,
  HelpCircle,
  Sun,
  Moon,
  RotateCcw,
  LogOut,
  ChevronDown,
  Download
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NavbarProps {
  activeTab: 'dashboard' | 'records' | 'trends' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'records' | 'trends' | 'settings') => void;
  onOpenAddModal: () => void;
  onOpenMoMoModal: () => void;
  onOpenRecurring: () => void;
  onOpenHelp: () => void;
  recurringCount: number;
  currency: string;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
  onUpdateAvatar?: (url: string) => void;
  onOpenPhotoModal?: () => void;
  onRequestRemoveAvatar?: () => void;
  onRequestLogout?: () => void;
  onRequestClearTrimester?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenMoMoModal,
  onOpenRecurring,
  onOpenHelp,
  recurringCount,
  userName,
  userEmail,
  avatarUrl,
  onUpdateAvatar,
  onOpenPhotoModal,
  onRequestRemoveAvatar,
  onRequestLogout,
  onRequestClearTrimester,
  isDark = false,
  onToggleTheme,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isInstalled } = usePWAInstall();

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Primary 3 core tabs: Home, Expenses, Analytics
  // (Settings is accessed cleanly via the Profile button in the top right)
  const navTabs = [
    { id: 'dashboard', label: 'Home', icon: Wallet },
    { id: 'records', label: 'Expenses', icon: ReceiptText },
    { id: 'trends', label: 'Analytics', icon: TrendingUp },
  ] as const;

  // Image compressor & reader for profile upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const displayName = userName || 'ALU Scholar';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Top Header - Zero horizontal overflow on any device */}
      <header className="sticky top-0 z-30 animate-assemble-down bg-[#f5f7f6] dark:bg-[#0b0d11] border-b border-[#e5e9e7] dark:border-[#1e2638] transition-colors">
        <div className="max-w-5xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-16 gap-2">
            
            {/* Left: Brand Identity with Custom Logo - Locked with shrink-0 so it NEVER shrinks or gets covered */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div 
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl app-logo-badge border p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8e5' }}
              >
                <img 
                  src="/assets/aistudio/logo1_4461ccd3.png" 
                  alt="Student Expense Tracker Logo" 
                  className="w-full h-full object-contain select-none"
                  style={{ filter: 'none' }}
                />
              </div>
              <div className="shrink-0">
                <div>
                  <span className="font-extrabold text-base sm:text-[15px] lg:text-base tracking-tight text-gray-900 dark:text-white shrink-0 block leading-tight">
                    Student Tracker
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium -mt-0.5 shrink-0 hidden sm:block">
                  Kigali Campus · Rwanda
                </span>
              </div>
            </div>

            {/* Desktop & Tablet Navigation Tabs (Home, Expenses, Analytics) */}
            <nav className="hidden md:flex items-center p-0.5 lg:p-1 rounded-full bg-white dark:bg-[#121620] border border-[#e5e9e7] dark:border-[#222a3a] shadow-xs shrink-0 mx-auto">
              {navTabs.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1 lg:gap-1.5 px-3 lg:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#0f4c3a] text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#1a202c]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Header Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              
              {/* Recurring Badge */}
              {recurringCount > 0 && (
                <button
                  onClick={onOpenRecurring}
                  className="hidden sm:flex items-center gap-1 px-2 lg:px-2.5 py-1 rounded-full text-[11px] lg:text-xs font-semibold bg-[#fef8e7] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 border border-[#fde68a] dark:border-amber-800 hover:bg-[#fef3c7] transition-colors cursor-pointer shrink-0"
                  title="View recurring expenses"
                >
                  <Repeat className="w-3 h-3 text-[#b45309] dark:text-amber-300 shrink-0" />
                  <span>{recurringCount}</span>
                </button>
              )}

              {/* Desktop MoMo Pill */}
              <button
                onClick={onOpenMoMoModal}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#0f4c3a] dark:text-emerald-300 bg-[#e8f5f0] dark:bg-[#0f4c3a]/30 hover:bg-[#d6ede4] dark:hover:bg-[#0f4c3a]/50 border border-[#c5e6d8] dark:border-[#1c5d49] transition-colors cursor-pointer shrink-0"
                title="Paste MoMo SMS"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>MoMo</span>
              </button>

              {/* Tablet MoMo Icon Button */}
              <button
                onClick={onOpenMoMoModal}
                className="hidden md:flex lg:hidden w-8 h-8 rounded-full text-[#0f4c3a] dark:text-emerald-300 bg-[#e8f5f0] dark:bg-[#0f4c3a]/30 hover:bg-[#d6ede4] dark:hover:bg-[#0f4c3a]/50 border border-[#c5e6d8] dark:border-[#1c5d49] items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs"
                title="Paste MoMo SMS"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>



              {/* Student Profile Avatar & Dropdown Menu */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className={`flex items-center gap-1 p-0.5 rounded-full transition-all cursor-pointer shrink-0 ${
                    activeTab === 'settings' 
                      ? 'ring-2 ring-[#0f4c3a] dark:ring-emerald-400' 
                      : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-700'
                  }`}
                  title={`Signed in as ${displayName}. Click to manage profile & settings.`}
                >
                  <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-full ring-1 ring-black/10 dark:ring-white/10 overflow-hidden bg-white dark:bg-[#151a24] flex items-center justify-center shadow-xs">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt={displayName} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#0f4c3a] to-[#083327] text-white font-bold text-sm flex items-center justify-center">
                        {initial}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform hidden sm:block ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile & Settings Dropdown Popover */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#121620] border border-[#e5e9e7] dark:border-[#222a3a] shadow-xl p-3 z-50 modal-enter">
                    
                    {/* Header Card with Photo Upload */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-[#171d29] border border-gray-100 dark:border-[#1f2738]">
                      <div className="relative group shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#0f4c3a]/30 bg-[#0f4c3a] text-white font-bold flex items-center justify-center text-base">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            initial
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            onOpenPhotoModal?.();
                          }}
                          className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#0f4c3a] text-white hover:bg-[#155d47] shadow-sm cursor-pointer transition-transform hover:scale-110"
                          title="Upload, center or change profile picture"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {userEmail || 'student@alustudent.com'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              onOpenPhotoModal?.();
                            }}
                            className="text-[11px] font-semibold text-[#0f4c3a] dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {avatarUrl ? 'Change or center' : 'Add picture'}
                          </button>
                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                onRequestRemoveAvatar?.();
                              }}
                              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Navigation Links inside Profile */}
                    <div className="mt-2.5 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('settings');
                          setIsProfileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                          activeTab === 'settings'
                            ? 'bg-[#e8f5f0] text-[#0f4c3a] dark:bg-[#0f4c3a]/30 dark:text-emerald-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333]'
                        }`}
                      >
                        <SettingsIcon className="w-4 h-4 text-[#0f4c3a] dark:text-emerald-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold">Profile &amp; Settings</p>
                          <p className="text-[10px] text-gray-400">Budget cap, trimester, preferences</p>
                        </div>
                      </button>

                      {onToggleTheme && (
                        <button
                          type="button"
                          onClick={() => onToggleTheme()}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {isDark ? <Moon className="w-4 h-4 text-emerald-400 shrink-0" /> : <Sun className="w-4 h-4 text-amber-500 shrink-0" />}
                            <span>Appearance</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {isDark ? 'Dark Mode' : 'Light Mode'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onOpenHelp();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition-colors cursor-pointer text-left"
                      >
                        <HelpCircle className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold">Help &amp; Student Guide</p>
                          <p className="text-[10px] text-gray-400">ALU financial tips, SMS formats</p>
                        </div>
                      </button>

                      {onRequestClearTrimester && (
                        <button
                          type="button"
                          onClick={() => {
                            onRequestClearTrimester();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer text-left"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold">Start New Trimester</p>
                            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">Wipe ledger to 0000</p>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Sign Out Action */}
                    {onRequestLogout && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-[#1e2638]">
                        <button
                          type="button"
                          onClick={() => {
                            onRequestLogout();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Pinned Mobile Bottom Navigation Bar: Home, Expenses, Analytics + MoMo */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 animate-assemble-up bg-white dark:bg-[#10141d] border-t border-[#e5e9e7] dark:border-[#1e2638] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-3 py-1.5 transition-colors" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-[#0f4c3a] dark:text-emerald-400 font-bold scale-105'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium'
                }`}
              >
                <div className={`p-1 rounded-full ${isActive ? 'bg-[#e8f5f0] dark:bg-[#0f4c3a]/40' : ''}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* Quick MoMo shortcut on bottom nav */}
          <button
            onClick={onOpenMoMoModal}
            className="flex flex-col items-center gap-0.5 py-1 px-3 text-[#0f4c3a] dark:text-emerald-400 font-medium cursor-pointer"
          >
            <div className="p-1 rounded-full bg-[#e8f5f0] dark:bg-[#0f4c3a]/40">
              <Smartphone className="w-4 h-4 text-[#0f4c3a] dark:text-emerald-400" />
            </div>
            <span className="text-[10px] font-semibold text-[#0f4c3a] dark:text-emerald-400">MoMo</span>
          </button>
        </div>
      </nav>
    </>
  );
};
