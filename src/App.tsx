/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { TransactionModal } from './components/TransactionModal';
import { MoMoImportModal } from './components/MoMoImportModal';
import { BudgetModal } from './components/BudgetModal';
import { RecurringDrawer } from './components/RecurringDrawer';
import { ExportModal } from './components/ExportModal';
import { OnboardingModal } from './components/OnboardingModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { AuthScreen } from './components/AuthScreen';
import { ConfirmModal } from './components/ConfirmModal';
import { ProfilePhotoModal } from './components/ProfilePhotoModal';
import { WhatsNewModal } from './components/WhatsNewModal';
import { APP_VERSION } from './version';

// Heavy, rarely-first views load on demand so sign-in stays fast.
const TrendChart = React.lazy(() =>
  import('./components/TrendChart').then((m) => ({ default: m.TrendChart }))
);
const SettingsView = React.lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);

import { Transaction, BudgetConfig, UserProfile, Category, UserAccount } from './types';
import { 
  loadTransactions, 
  saveTransactions, 
  loadBudget, 
  saveBudget, 
  loadProfile, 
  saveProfile, 
  loadCategories, 
  saveCategories,
  setCurrentSession,
  getUserStore,
  saveUserStore,
  updateUserAvatar,
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGET,
  INITIAL_USER_PROFILE,
  runDataMigrations
} from './utils/storage';
import { 
  syncUserStoreToFirestore, 
  subscribeUserStoreFromFirestore, 
  migrateLocalStoreToFirestore, 
  uploadAvatarToStorage,
  addTransactionToFirestore,
  removeTransactionFromFirestore,
  markTransactionDeletedInFirestore
} from './lib/firestoreSync';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { auth as clientAuth } from './lib/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { shrinkAvatarDataUrl } from './lib/avatar';
import { detectRecurringExpenses } from './utils/recurringDetector';
import { DEFAULT_CATEGORIES } from './utils/categorizer';

/**
 * Detects a password-reset link once, at module load, before AuthScreen strips
 * the one-time code from the address bar. The flag is held in a ref so a later
 * re-render cannot kick a signed-in student out of the reset screen mid-flow.
 */
function detectResetRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.pathname.startsWith('/reset') ||
    params.has('token') ||
    params.has('reset_token') ||
    params.get('mode') === 'resetPassword' ||
    params.has('oobCode')
  );
}

/**
 * Outbox for records that could not reach the account (offline phone, flaky
 * data). They are already stored on this device and are retried automatically
 * instead of being reported as "saved" and then lost on another device.
 */
const PENDING_TX_KEY = 'alu_pending_tx_v1';

function loadPendingTransactions(): Transaction[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_TX_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((t: any) => t && t.id) : [];
  } catch {
    return [];
  }
}

function writePendingTransactions(list: Transaction[]): void {
  try {
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(list));
  } catch {}
}

function queuePendingTransaction(tx: Transaction): void {
  const list = loadPendingTransactions();
  if (list.some((t) => t.id === tx.id)) {
    writePendingTransactions(list.map((t) => (t.id === tx.id ? tx : t)));
  } else {
    writePendingTransactions([...list, tx]);
  }
}

function dropPendingTransaction(id: string): void {
  writePendingTransactions(loadPendingTransactions().filter((t) => t.id !== id));
}

export default function App() {
  // Theme Mode State (Dark / Light)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('alu_theme_mode');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Apply dark class to <html> element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('alu_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('alu_theme_mode', 'light');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  // Authentication State: Firebase Auth is the single source of truth.
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const hydratedUidRef = useRef<string | null>(null);
  // True while the signed-in account's cloud data is still being merged in.
  // Background sync must stay paused during this window so fresh local/sample
  // data can never overwrite the student's real Firestore records.
  const isHydratingRef = useRef(false);
  // Transactions created on this device that have not reached Firestore yet.
  // Only these may survive a remote snapshot; anything else missing remotely
  // was genuinely deleted (possibly on another phone) and must not come back.
  const pendingTxIdsRef = useRef<Set<string>>(new Set());
  // Records deleted on this device. Kept until the cloud copy drops them so a
  // stale snapshot cannot bring a deleted record back.
  const deletedTxIdsRef = useRef<Set<string>>(new Set());
  // Locked at load: a reset link keeps the reset screen visible even if a
  // session is restored or a state update re-renders the app.
  const isResetRouteRef = useRef<boolean>(detectResetRoute());

  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'trends' | 'settings'>('dashboard');

  // Application Data State
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());
  const [budget, setBudget] = useState<BudgetConfig>(() => loadBudget());
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  // Mirrors the latest profile so async handlers (avatar upload) never write
  // back a stale name/email snapshot taken before an await.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  // While a new photo is being saved, ignore stale cloud snapshots so a slow
  // phone connection cannot flip the header back to the previous picture.
  const avatarSavedAtRef = useRef(0);
  const [categories, setCategories] = useState<Category[]>(() => loadCategories());

  // Modals & Drawers State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isMoMoModalOpen, setIsMoMoModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isRemovePhotoConfirmOpen, setIsRemovePhotoConfirmOpen] = useState(false);


  // What's New Modal State (shown once after an update is completed)
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem('alu_show_whats_new');
    } catch {
      return null;
    }
  });

  const handleCloseWhatsNew = () => {
    try {
      localStorage.removeItem('alu_show_whats_new');
    } catch {}
    setWhatsNewVersion(null);
  };

  // Run data migrations on app startup (preserves all accounts, transactions, and budget settings)
  useEffect(() => {
    runDataMigrations(APP_VERSION);
  }, []);

  // Firebase restores the signed-in student automatically (onAuthStateChanged below).


  // Automatically scroll to the very top whenever the navigation tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToastMessage(null);
    }, 3000);
  };

  // Clear any pending toast timer when the app unmounts
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Avatar upload handler: instant local preview + Firebase Storage + Firestore sync
  const handleUpdateAvatar = async (incomingAvatarUrl: string) => {
    if (!incomingAvatarUrl) {
      const updated = { ...profileRef.current, avatarUrl: '' };
      setProfile(updated);
      saveProfile(updated);
      if (currentUser) {
        setCurrentUser((prev) => prev ? { ...prev, avatarUrl: '' } : prev);
        updateUserAvatar(currentUser.email, '');
        if (currentUser.uid) {
          syncUserStoreToFirestore(currentUser.uid, {
            profile: updated,
            budget,
            transactions,
            categories,
          }, { ...currentUser, avatarUrl: '' }, { includeTransactions: false }).catch(() => {});
        }
      }
      showToast('Profile picture removed.');
      return;
    }

    // 0. Phone photos can be huge or in a format the browser cannot re-encode.
    // Shrink first so the picture always fits the profile document, and say so
    // plainly instead of showing success and quietly keeping the old photo.
    let newAvatarUrl = incomingAvatarUrl;
    if (newAvatarUrl.startsWith('data:image/') && newAvatarUrl.length > 110000) {
      const shrunk = await shrinkAvatarDataUrl(newAvatarUrl);
      if (!shrunk) {
        showToast('This photo could not be prepared on this device. Choose a JPG or PNG picture.');
        return;
      }
      newAvatarUrl = shrunk;
    }

    // 1. Instantly update UI so student sees picture immediately
    const previousProfile = profileRef.current;
    avatarSavedAtRef.current = Date.now();
    const immediateProfile = { ...previousProfile, avatarUrl: newAvatarUrl };
    setProfile(immediateProfile);
    saveProfile(immediateProfile);
    if (currentUser) {
      setCurrentUser((prev) => prev ? { ...prev, avatarUrl: newAvatarUrl } : prev);
      updateUserAvatar(currentUser.email, newAvatarUrl);
    }
    showToast('Saving profile picture...');

    let finalUrl = newAvatarUrl;

    if (currentUser?.uid) {
      // 2. Upload the image to Firebase Storage (fully online, no server disk)
      if (newAvatarUrl.startsWith('data:image/')) {
        try {
          const cloudUrl = await uploadAvatarToStorage(currentUser.uid, newAvatarUrl);
          if (!cloudUrl || !cloudUrl.startsWith('https://')) {
            throw new Error('Storage is not reachable');
          }
          finalUrl = cloudUrl;
          // Re-read the latest profile instead of the closure snapshot so a
          // name/email edit made during the upload is not reverted.
          const cloudProfile = { ...profileRef.current, avatarUrl: finalUrl };
          setProfile(cloudProfile);
          saveProfile(cloudProfile);
          setCurrentUser((prev) => prev ? { ...prev, avatarUrl: finalUrl } : prev);
          updateUserAvatar(currentUser.email, finalUrl);
        } catch (e) {
          console.warn('Firebase Storage upload notice', e);
          // No cloud photo bucket on this project yet: keep the small inline
          // photo in the profile document (already shrunk above to ~15-40 KB).
        }
      }

      // 3. Sync final URL to Firebase Firestore and confirm it really landed.
      let savedInCloud = false;
      try {
        await syncUserStoreToFirestore(currentUser.uid, {
          profile: { ...profileRef.current, avatarUrl: finalUrl },
          budget,
          transactions,
          categories,
        }, { ...currentUser, avatarUrl: finalUrl }, { includeTransactions: false });
        const snap = await getDoc(doc(db, 'users', currentUser.uid, 'data', 'store'));
        const stored = snap.data()?.profile?.avatarUrl;
        savedInCloud = typeof stored === 'string' && stored === finalUrl;
      } catch (err) {
        console.warn('Firestore avatar sync notice', err);
      }
      avatarSavedAtRef.current = Date.now();

      if (!savedInCloud) {
        showToast('Picture saved on this device, but your account copy did not update. Check your connection and try again.');
        return;
      }

      showToast('Profile picture saved & synced to your account!');
      return;
    }

    showToast('Profile picture saved on this device. Sign in to sync it to your account.');
  };

  // Loads the signed-in student's local cache, then merges it with Firebase Firestore.
  const applyUser = useCallback(async (user: UserAccount, welcome: boolean) => {
    if (user.uid) hydratedUidRef.current = user.uid;
    isHydratingRef.current = true;
    pendingTxIdsRef.current.clear();
    try {
      localStorage.setItem('alu_active_user_v2', JSON.stringify(user));
      localStorage.setItem('alu_session_email_v2', user.email);
      localStorage.removeItem('alu_auth_token_v2'); // legacy server token is no longer used
    } catch {}
    setCurrentUser(user);
    setCurrentSession(user.email);
    const localStore = getUserStore(user.email);
    setTransactions(localStore.transactions);
    setBudget(localStore.budget);
    setProfile(localStore.profile);
    setCategories(localStore.categories);
    setActiveTab('dashboard');
    if (welcome) showToast(`Welcome back, ${user.name}!`);

    if (!user.uid) {
      isHydratingRef.current = false;
      return;
    }

    // Migrate/sync local store to the Firebase UID document (preserves existing records)
    try {
      const merged = await migrateLocalStoreToFirestore(user.uid, user, localStore);
      if (merged) {
        const storedName = (merged.profile?.name || '').trim();
        // The merged name is already resolved remote-first, so it is the most
        // current choice. Falling back to the auth display name only when the
        // merged name is empty keeps a renamed profile from reverting.
        const preferredName = storedName || user.name || '';
        const finalStore = {
          ...merged,
          profile: merged.profile ? { ...merged.profile, name: preferredName } : merged.profile,
        };

        saveUserStore(user.email, finalStore);
        if (finalStore.profile) {
          setProfile(finalStore.profile);
          if (finalStore.profile.avatarUrl) {
            setCurrentUser((prev) => prev ? { ...prev, avatarUrl: finalStore.profile.avatarUrl } : prev);
          }
        }
        if (finalStore.transactions) setTransactions(finalStore.transactions);
        if (finalStore.budget) setBudget(finalStore.budget);
        if (finalStore.categories) setCategories(finalStore.categories);

        // Persist the corrected display name / merged store back to Firestore.
        // Transactions are handled record by record during the merge above.
        syncUserStoreToFirestore(user.uid, finalStore, {
          ...user,
          name: preferredName || user.name,
        }, { includeTransactions: false }).catch(() => {});
      }
    } catch (err) {
      console.warn('Firestore initial sync notice', err);
    } finally {
      isHydratingRef.current = false;
    }
  }, []);

  // Called by AuthScreen immediately after Firebase sign-in/sign-up.
  const handleLoginSuccess = (user: UserAccount) => {
    // Completing a reset signs the student in; leave the reset screen for good.
    isResetRouteRef.current = false;
    setIsCheckingSession(false);
    void applyUser(user, true);
  };

  // Firebase restores or clears the session automatically on every page load.
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      if (!active) return;

      if (!firebaseUser) {
        hydratedUidRef.current = null;
        pendingTxIdsRef.current.clear();
        isHydratingRef.current = false;
        setCurrentUser(null);
        setCurrentSession(null);
        try {
          localStorage.removeItem('alu_active_user_v2');
          localStorage.removeItem('alu_session_email_v2');
          localStorage.removeItem('alu_auth_token_v2');
        } catch {}
        setIsCheckingSession(false);
        return;
      }

      if (hydratedUidRef.current === firebaseUser.uid) {
        setIsCheckingSession(false);
        return;
      }

      // Phase 1 (instant): restore the student from the device cache and show
      // the app immediately. Phase 2 (background): applyUser merges the cloud
      // copy in without blocking the screen.
      const resolvedEmail = firebaseUser.email || '';
      const cached = resolvedEmail ? getUserStore(resolvedEmail) : null;
      const user: UserAccount = {
        uid: firebaseUser.uid,
        email: resolvedEmail,
        name:
          firebaseUser.displayName ||
          cached?.profile?.name ||
          (resolvedEmail ? resolvedEmail.split('@')[0] : 'Student'),
        studentId: cached?.profile?.studentId || undefined,
        university: cached?.profile?.university || undefined,
        createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
        avatarUrl: firebaseUser.photoURL || cached?.profile?.avatarUrl || undefined,
      };
      setIsCheckingSession(false);
      void applyUser(user, false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyUser]);

  // Real-time Firestore subscription: safely merges remote changes without deleting local data
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = subscribeUserStoreFromFirestore(currentUser.uid, (remoteStore) => {
      if (!remoteStore) return;
      // Safely update profile. A slow snapshot from just before a photo save
      // must not flip the header back to the previous picture.
      if (remoteStore.profile) {
        const photoJustChanged = Date.now() - avatarSavedAtRef.current < 20000;
        setProfile((prev) => {
          const next = { ...prev, ...remoteStore.profile };
          if (photoJustChanged && prev.avatarUrl) next.avatarUrl = prev.avatarUrl;
          return next;
        });
        if (remoteStore.profile.name) {
          setCurrentUser((prev) => prev ? { ...prev, name: remoteStore.profile!.name } : prev);
        }
        if (remoteStore.profile.avatarUrl && !photoJustChanged) {
          setCurrentUser((prev) => prev ? { ...prev, avatarUrl: remoteStore.profile.avatarUrl } : prev);
        }
      }
      // Merge transactions without ever losing a record this device just
      // added or edited, and without resurrecting one just deleted.
      if (Array.isArray(remoteStore.transactions)) {
        // Deletion tombstones travel with the account so a deleted record
        // cannot come back from another device's older copy.
        const remoteDeleted = (remoteStore as any).deletedTransactionIds;
        setTransactions((current) => {
          const remote = remoteStore.transactions as Transaction[];
          const remoteIds = new Set(remote.map((t) => t.id));
          // Drop ids from the pending set once Firestore has them.
          pendingTxIdsRef.current.forEach((id) => {
            if (remoteIds.has(id)) pendingTxIdsRef.current.delete(id);
          });
          // Forget a local deletion once the cloud copy no longer has it.
          deletedTxIdsRef.current.forEach((id) => {
            if (!remoteIds.has(id)) deletedTxIdsRef.current.delete(id);
          });
          // Then honour the account-wide tombstones.
          if (Array.isArray(remoteDeleted)) {
            remoteDeleted.forEach((id: string) => deletedTxIdsRef.current.add(id));
          }

          const byId = new Map<string, Transaction>();
          remote.forEach((r) => {
            if (deletedTxIdsRef.current.has(r.id)) return;
            const local = current.find((t) => t.id === r.id);
            // Newest write wins, so a stale snapshot cannot undo an edit.
            const winner = local && String(local.updatedAt || '') > String(r.updatedAt || '') ? local : r;
            byId.set(r.id, winner);
          });

          const localOnly = current.filter(
            (t) => !remoteIds.has(t.id) && !deletedTxIdsRef.current.has(t.id) && !byId.has(t.id)
          );
          localOnly.forEach((t) => byId.set(t.id, t));

          return Array.from(byId.values());
        });
      }
      if (remoteStore.budget) {
        setBudget(remoteStore.budget);
      }
      if (Array.isArray(remoteStore.categories) && remoteStore.categories.length > 0) {
        setCategories(remoteStore.categories);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Retry records that never reached the account (offline or weak phone
  // connection) as soon as the device is back online.
  useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;
    let cancelled = false;
    const flush = async () => {
      const pending = loadPendingTransactions();
      if (pending.length === 0) return;
      for (const tx of pending) {
        if (cancelled) return;
        const ok = await addTransactionToFirestore(uid, tx);
        if (ok) dropPendingTransaction(tx.id);
      }
    };
    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => {
      if (navigator.onLine) void flush();
    }, 20000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [currentUser?.uid]);

  // Debounced background sync to Firestore whenever profile, budget, or transactions change
  useEffect(() => {
    // Never push placeholder/local data over the cloud document while the
    // sign-in merge is still in flight.
    if (currentUser?.uid && !isHydratingRef.current) {
      const timeoutId = setTimeout(() => {
        if (isHydratingRef.current) return;
        const storePayload = {
          profile,
          budget,
          transactions,
          categories,
        };

        // 1. Sync to Firebase Firestore (UID document). Transactions are
        // written record by record elsewhere, so this never rewrites the list.
        syncUserStoreToFirestore(currentUser.uid!, storePayload, currentUser, { includeTransactions: false })
          .catch((err) => console.warn('Firestore background sync notice', err));

        // 2. Keep localStorage as device cache
        saveUserStore(currentUser.email, storePayload);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [currentUser?.uid, profile, budget, transactions, categories]);

  // Logout handler: the UI clears instantly; the final cloud sync is sent in
  // the background so signing out never waits on the network.
  const handleLogout = () => {
    const signedInUser = currentUser;
    if (signedInUser) {
      saveUserStore(signedInUser.email, {
        profile,
        budget,
        transactions,
        categories,
      });
      if (signedInUser.uid) {
        void syncUserStoreToFirestore(signedInUser.uid, {
          profile,
          budget,
          transactions,
          categories,
        }, signedInUser, { includeTransactions: false }).catch(() => {});
      }
    }
    hydratedUidRef.current = null;
    pendingTxIdsRef.current.clear();
    isHydratingRef.current = false;
    try {
      localStorage.removeItem('alu_active_user_v2');
      localStorage.removeItem('alu_session_email_v2');
      localStorage.removeItem('alu_auth_token_v2');
    } catch {}
    setCurrentSession(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
    showToast('Logged out securely.');
    void signOut(clientAuth).catch(() => {});
  };

  // Trimester wipe handler: cleans transactions to 0000 while preserving account
  const handleClearAllRecords = () => {
    deletedTxIdsRef.current.clear();
    pendingTxIdsRef.current.clear();
    setTransactions([]);
    if (currentUser) {
      const store = getUserStore(currentUser.email);
      store.transactions = [];
      saveUserStore(currentUser.email, store);
      // Mirror the wipe to Firestore right away so a live snapshot cannot
      // bring the old records back into the list.
      if (currentUser.uid) {
        syncUserStoreToFirestore(currentUser.uid, { ...store, transactions: [] }, currentUser, { clearTombstones: true }).catch(() => {});
      }
    }
    showToast('Ledger wiped. All records reset to 0000 for new trimester!');
  };

  // High-performance unified storage sync: updates local stores in a single batched pass
  useEffect(() => {
    saveTransactions(transactions);
    saveBudget(budget);
    saveProfile(profile);
    saveCategories(categories);
    if (currentUser?.email) {
      saveUserStore(currentUser.email, {
        transactions,
        budget,
        profile,
        categories,
      });
    }
  }, [transactions, budget, profile, categories, currentUser?.email]);

  // Detected Recurring Expenses (FR 8.1)
  const recurringAnalysis = useMemo(() => {
    return detectRecurringExpenses(transactions);
  }, [transactions]);

  // Handle Add / Edit Transaction
  const handleSaveTransaction = (
    data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string
  ) => {
    const nowISO = new Date().toISOString();
    let updatedTxList: Transaction[] = [];
    let previousTx: Transaction | undefined;
    let savedTx: Transaction | undefined;

    if (editId) {
      previousTx = transactions.find((t) => t.id === editId);
      updatedTxList = transactions.map((t) =>
        t.id === editId
          ? { ...t, ...data, updatedAt: nowISO }
          : t
      );
      savedTx = updatedTxList.find((t) => t.id === editId);
      setTransactions(updatedTxList);
      showToast('Transaction updated successfully.');
    } else {
      const newTx: Transaction = {
        ...data,
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      updatedTxList = [newTx, ...transactions];
      pendingTxIdsRef.current.add(newTx.id);
      savedTx = newTx;
      setTransactions(updatedTxList);
      if (data.source === 'momo_sms') {
        try {
          localStorage.setItem('alu_momo_first_trial_done', 'true');
        } catch {}
        showToast('MoMo payment imported! You can now use the "MoMo" button in the navigation bar anytime.');
      } else {
        showToast('Expense recorded successfully.');
      }
    }

    // Save locally and sync only what changed. The transaction itself is
    // appended/replaced record by record so another device holding an older
    // list can never erase it.
    if (currentUser) {
      const store = getUserStore(currentUser.email);
      store.transactions = updatedTxList;
      saveUserStore(currentUser.email, store);
      if (currentUser.uid && savedTx) {
        const uid = currentUser.uid;
        const record = savedTx;
        const persist = async () => {
          if (!navigator.onLine) {
            queuePendingTransaction(record);
            showToast('Saved on this phone. It will sync to your account when you are back online.');
            return;
          }
          const ok = await addTransactionToFirestore(uid, record);
          if (ok) {
            dropPendingTransaction(record.id);
          } else {
            queuePendingTransaction(record);
            showToast('Saved on this phone, but your account was not reachable. It will sync automatically.');
          }
        };
        void syncUserStoreToFirestore(uid, store, currentUser, { includeTransactions: false })
          .catch(() => {});
        if (editId && previousTx) {
          void (async () => {
            await removeTransactionFromFirestore(uid, previousTx);
            await persist();
          })();
        } else {
          void persist();
        }
      }
    }
    setEditingTransaction(null);
  };

  // Handle Profile Update
  const handleUpdateProfile = (p: UserProfile) => {
    setProfile(p);
    if (currentUser) {
      const updatedUser: UserAccount = {
        ...currentUser,
        name: p.name || currentUser.name,
        email: p.email || currentUser.email,
        studentId: p.studentId || currentUser.studentId,
      };
      setCurrentUser(updatedUser);
      // Keep the Firebase Auth display name in sync so the new name survives
      // a reload / new sign-in instead of reverting to the old one.
      if (clientAuth.currentUser && p.name && p.name !== clientAuth.currentUser.displayName) {
        updateProfile(clientAuth.currentUser, { displayName: p.name }).catch(() => {});
      }
      const store = getUserStore(currentUser.email);
      store.profile = p;
      saveUserStore(currentUser.email, store);
      if (currentUser.uid) {
        syncUserStoreToFirestore(currentUser.uid, store, updatedUser, { includeTransactions: false }).catch(() => {});
      }
    }
    showToast('Profile updated successfully.');
  };

  // Handle Budget Cap Update
  const handleUpdateBudget = (b: BudgetConfig) => {
    setBudget(b);
    if (currentUser) {
      const store = getUserStore(currentUser.email);
      store.budget = b;
      saveUserStore(currentUser.email, store);
      if (currentUser.uid) {
        syncUserStoreToFirestore(currentUser.uid, store, currentUser, { includeTransactions: false }).catch(() => {});
      }
    }
    showToast('Budget cap updated.');
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = (id: string) => {
    const target = transactions.find((t) => t.id === id);
    pendingTxIdsRef.current.delete(id);
    deletedTxIdsRef.current.add(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    // Remove exactly this record from the account and leave a tombstone so no
    // other device can bring it back; everything else stays untouched.
    if (currentUser?.uid) {
      if (target) removeTransactionFromFirestore(currentUser.uid, target).catch(() => {});
      markTransactionDeletedInFirestore(currentUser.uid, id).catch(() => {});
    }
    showToast('Transaction deleted.');
  };

  // Reset to Kigali Sample Data
  const handleResetData = () => {
    // Keep the signed-in student's identity; only the demo financials reset.
    const current = profileRef.current;
    const resetProfile: UserProfile = {
      ...INITIAL_USER_PROFILE,
      name: current.name || INITIAL_USER_PROFILE.name,
      email: current.email || INITIAL_USER_PROFILE.email,
      studentId: current.studentId,
      university: current.university || INITIAL_USER_PROFILE.university,
      campus: current.campus || INITIAL_USER_PROFILE.campus,
      currency: current.currency || INITIAL_USER_PROFILE.currency,
      avatarUrl: current.avatarUrl,
      onboardingCompleted: current.onboardingCompleted,
    };
    setTransactions(INITIAL_TRANSACTIONS);
    deletedTxIdsRef.current.clear();
    pendingTxIdsRef.current.clear();
    setBudget(INITIAL_BUDGET);
    setProfile(resetProfile);
    setCategories(DEFAULT_CATEGORIES);
    if (currentUser?.uid) {
      syncUserStoreToFirestore(currentUser.uid, {
        profile: resetProfile,
        budget: INITIAL_BUDGET,
        transactions: INITIAL_TRANSACTIONS,
        categories: DEFAULT_CATEGORIES,
      }, { ...currentUser, name: resetProfile.name }, { clearTombstones: true }).catch(() => {});
    }
    showToast('Reset to authentic ALU Kigali sample dataset.');
  };

  const isResetRoute = isResetRouteRef.current;

  // IF RESTORING SESSION, SHOW A BRIEF LOADING STATE
  if (isCheckingSession && !isResetRoute) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Checking your sign-in…</div>;
  }

  // IF NOT LOGGED IN OR ACCESSING RESET LINK, DISPLAY AUTH SCREEN
  if (!currentUser || isResetRoute) {
    return (
      <div className="relative min-h-screen">
        <AuthScreen 
          onLoginSuccess={handleLoginSuccess}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
        <WhatsNewModal
          isOpen={Boolean(whatsNewVersion)}
          version={whatsNewVersion || APP_VERSION}
          onClose={handleCloseWhatsNew}
          isDark={isDark}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-[#0f4c3a]/15 selection:text-[#0f4c3a] antialiased transition-colors duration-200 relative overflow-x-hidden ${
      isDark ? 'bg-[#0b0d11] text-gray-100' : 'bg-[#f5f7f6] text-gray-900'
    }`}>
      {/* Top Header - Clean un-cluttered header with dark theme support */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => {
          setEditingTransaction(null);
          setIsAddModalOpen(true);
        }}
        onOpenMoMoModal={() => setIsMoMoModalOpen(true)}
        onOpenRecurring={() => setIsRecurringOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        recurringCount={recurringAnalysis.clusters.length}
        currency={profile.currency}
        userName={currentUser.name}
        userEmail={currentUser.email}
        avatarUrl={profile.avatarUrl || currentUser.avatarUrl}
        onUpdateAvatar={handleUpdateAvatar}
        onRequestRemoveAvatar={() => setIsRemovePhotoConfirmOpen(true)}
        onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
        onRequestLogout={() => setIsLogoutConfirmOpen(true)}
        onRequestClearTrimester={() => setIsWipeConfirmOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area: Spacious bottom padding on mobile so content clears the fixed bottom nav */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-28 md:pb-12">
        
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 modal-enter bg-[#0f4c3a] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-[#165b47] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Tab Content: remounts on tab change so the entrance animation replays */}
        <div key={activeTab} className="animate-fade-in">
        {activeTab === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            budget={budget}
            categories={categories}
            currency={profile.currency}
            recurringClusters={recurringAnalysis.clusters}
            userName={currentUser.name}
            onOpenAddModal={() => {
              setEditingTransaction(null);
              setIsAddModalOpen(true);
            }}
            onOpenMoMoModal={() => setIsMoMoModalOpen(true)}
            onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
            onOpenRecurring={() => setIsRecurringOpen(true)}
            onViewAllExpenses={() => setActiveTab('records')}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsAddModalOpen(true);
            }}
            onDeleteTransaction={(tx) => handleDeleteTransaction(tx.id)}
          />
        )}

        {activeTab === 'records' && (
          <TransactionList
            transactions={transactions}
            categories={categories}
            currency={profile.currency}
            onEdit={(tx) => {
              setEditingTransaction(tx);
              setIsAddModalOpen(true);
            }}
            onDelete={handleDeleteTransaction}
            onOpenAddModal={() => {
              setEditingTransaction(null);
              setIsAddModalOpen(true);
            }}
            onOpenRecurring={() => setIsRecurringOpen(true)}
            onOpenMoMoModal={() => setIsMoMoModalOpen(true)}
            onOpenExportModal={() => setIsExportOpen(true)}
          />
        )}

        {activeTab === 'trends' && (
          <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">Loading analytics…</div>}>
            <TrendChart
              transactions={transactions}
              categories={categories}
              currency={profile.currency}
            />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">Loading settings…</div>}>
          <SettingsView
            profile={profile}
            budget={budget}
            categories={categories}
            currency={profile.currency}
            transactionsCount={transactions.length}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            userAccount={currentUser}
            onLogout={() => setIsLogoutConfirmOpen(true)}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onUpdateAvatar={handleUpdateAvatar}
            onRequestRemoveAvatar={() => setIsRemovePhotoConfirmOpen(true)}
            onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
            onUpdateProfile={handleUpdateProfile}
            onUpdateBudget={handleUpdateBudget}
            onUpdateCategories={(cats) => {
              setCategories(cats);
              showToast('Categories updated.');
            }}
            onResetData={handleResetData}
            onClearAllRecords={handleClearAllRecords}
            onOpenHelp={() => setIsHelpOpen(true)}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
          />
          </Suspense>
        )}
        </div>
      </main>

      {/* Modals & Dialogs */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        categories={categories}
        currency={profile.currency}
        initialTransaction={editingTransaction}
        onSave={handleSaveTransaction}
      />

      <MoMoImportModal
        isOpen={isMoMoModalOpen}
        onClose={() => setIsMoMoModalOpen(false)}
        categories={categories}
        currency={profile.currency}
        onSaveTransaction={handleSaveTransaction}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        budget={budget}
        currency={profile.currency}
        onSave={handleUpdateBudget}
      />

      <RecurringDrawer
        isOpen={isRecurringOpen}
        onClose={() => setIsRecurringOpen(false)}
        clusters={recurringAnalysis.clusters}
        currency={profile.currency}
        totalEstimatedMonthly={recurringAnalysis.totalEstimatedMonthly}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        transactions={transactions}
        profile={profile}
        budget={budget}
        currency={profile.currency}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <HelpGuideModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Global Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        title="Log Out of Your Account?"
        message={`Are you sure you want to log out of ${currentUser.email}? All your expense transactions, budget settings, and custom categories will remain safely saved in your account.`}
        confirmLabel="Yes, Log Out"
        isDestructive={false}
        iconType="logout"
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          handleLogout();
        }}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />

      {/* Global Trimester Wipe Confirmation Modal */}
      <ConfirmModal
        isOpen={isWipeConfirmOpen}
        title="Start Fresh Trimester?"
        message="Are you sure you want to wipe all records? All transactions will be cleared to 0000 so you can start a fresh trimester. Your profile, account credentials, and custom categories will remain safely preserved."
        confirmLabel="Yes, Start Fresh Trimester"
        isDestructive={true}
        iconType="delete"
        onConfirm={() => {
          setIsWipeConfirmOpen(false);
          handleClearAllRecords();
        }}
        onCancel={() => setIsWipeConfirmOpen(false)}
      />

      {/* Global Remove Profile Picture Confirmation Modal */}
      <ConfirmModal
        isOpen={isRemovePhotoConfirmOpen}
        title="Remove Profile Picture?"
        message="Are you sure you want to remove your profile picture? Your profile will revert to displaying your initials until you choose or center a new photo."
        confirmLabel="Yes, Remove Picture"
        isDestructive={true}
        iconType="delete"
        onConfirm={() => {
          setIsRemovePhotoConfirmOpen(false);
          handleUpdateAvatar('');
        }}
        onCancel={() => setIsRemovePhotoConfirmOpen(false)}
      />

      {/* Profile Picture Source & Crop/Center Modal */}
      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        currentAvatarUrl={profile.avatarUrl || currentUser?.avatarUrl}
        userName={currentUser?.name}
        onSaveAvatar={handleUpdateAvatar}
        onRemoveAvatar={() => {
          setIsPhotoModalOpen(false);
          setIsRemovePhotoConfirmOpen(true);
        }}
      />

      {/* Desktop Clean Footer */}
      <footer className={`hidden md:block border-t py-5 mt-auto transition-colors ${
        isDark ? 'bg-[#0e1118] border-[#1e2638] text-gray-400' : 'bg-white border-[#e5e9e7] text-gray-500'
      }`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-gray-200">Student Expense Tracker</span>
            <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">·</span>
            <span>African Leadership University (ALU), Kigali</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              Guide
            </button>
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              Walkthrough
            </button>
            <span className="font-mono text-gray-400 dark:text-gray-600">v{APP_VERSION}</span>
          </div>
        </div>
      </footer>
      {/* What's New Release Notes Modal (shows once after update) */}
      <WhatsNewModal
        isOpen={Boolean(whatsNewVersion)}
        version={whatsNewVersion || APP_VERSION}
        onClose={handleCloseWhatsNew}
        isDark={isDark}
      />
    </div>
  );
}
