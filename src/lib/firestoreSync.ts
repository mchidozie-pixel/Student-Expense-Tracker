import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  addDoc,
  collection,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage, OperationType, handleFirestoreError } from './firebase';
import { UserStoreData, UserAccount, Transaction } from '../types';
import { APP_VERSION } from '../version';

/**
 * Creates a clean, safe, valid document ID from an email address.
 */
export function toUserDocId(email: string): string {
  const clean = (email || '').trim().toLowerCase();
  return clean.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Uploads a profile picture (data URL or Blob) to Firebase Storage
 * and returns the public download URL.
 */
export async function uploadAvatarToStorage(userId: string, imageDataUrl: string): Promise<string> {
  if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
    return imageDataUrl; // Already a remote URL
  }

  const storageRef = ref(storage, `profile_pictures/${userId}/avatar_${Date.now()}.jpg`);

  // Convert data URL to Blob
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();

  // Upload to Firebase Storage with a timeout so it never hangs
  const uploadPromise = uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000',
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Firebase Storage upload timeout')), 10000);
  });

  try {
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
    // Obtain download URL
    return await getDownloadURL(snapshot.ref);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Reads the Firebase user profile document (name, studentId, avatar, etc.).
 * Returns null when the profile has not been created yet.
 */
export async function fetchUserProfileFromFirestore(userId: string): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.warn('[Firestore Profile Read Notice]:', error);
    return null;
  }
}

/**
 * Recursively drops `undefined` values (Firestore rejects them) and removes
 * inline base64 avatars (they can exceed the 1 MiB document limit). A base64
 * avatar is replaced by an empty string so the rest of the store still syncs.
 */
function sanitizeForFirestore<T>(value: T, key?: string): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = sanitizeForFirestore(v, k);
    }
    return out as T;
  }
  if (key === 'avatarUrl' && typeof value === 'string' && value.startsWith('data:')) {
    // Keep small cropped photos (256px JPEG, normally 15-40 KB) inline when
    // cloud Storage is unavailable; only drop oversized base64 blobs.
    return (value.length <= 120000 ? value : '') as unknown as T;
  }
  return value;
}

/**
 * Chooses the best display name. A fresh local store uses the email prefix as
 * a placeholder, so a real Firebase display name / stored profile name wins.
 */
function resolveProfileName(
  user: UserAccount,
  localName?: string,
  remoteName?: string
): string {
  const emailPrefix = (user.email || '').split('@')[0].toLowerCase();
  const candidates = [remoteName, user.name, localName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());
  const realName = candidates.find((value) => value.toLowerCase() !== emailPrefix);
  return realName || candidates[0] || '';
}

/**
 * Migrates local user data to Firestore if it does not already exist in Firestore.
 * Preserves all existing student records and prevents empty overwrites.
 */
export async function migrateLocalStoreToFirestore(
  userId: string, 
  user: UserAccount, 
  localStore: UserStoreData
): Promise<UserStoreData> {
  const storePath = `users/${userId}/data/store`;
  const userPath = `users/${userId}`;

  try {
    // Check if store already exists in Firestore
    const storeDocRef = doc(db, 'users', userId, 'data', 'store');
    const existingSnap = await getDoc(storeDocRef);

    if (existingSnap.exists()) {
      const remoteData = existingSnap.data() as UserStoreData;
      // Union the records known on this device with the account copy, newest
      // write winning. Nothing a device still holds can be silently dropped,
      // and account-wide deletion tombstones keep deleted records gone.
      const remoteTxs = Array.isArray(remoteData.transactions) ? remoteData.transactions : [];
      const tombstones: string[] = Array.isArray((remoteData as any).deletedTransactionIds)
        ? (remoteData as any).deletedTransactionIds
        : [];
      const tombstoneSet = new Set(tombstones);
      const byId = new Map<string, Transaction>();
      for (const tx of [...(localStore.transactions || []), ...remoteTxs]) {
        if (!tx || !tx.id || tombstoneSet.has(tx.id)) continue;
        const existing = byId.get(tx.id);
        if (!existing || String(tx.updatedAt || '') > String(existing.updatedAt || '')) {
          byId.set(tx.id, tx);
        }
      }
      const remoteIds = new Set(remoteTxs.map((tx) => tx.id));
      const localOnly = Array.from(byId.values()).filter((tx) => !remoteIds.has(tx.id));
      // Push records this device holds but the account copy is missing, one
      // append per record so nothing else in the list can be overwritten.
      for (const tx of localOnly) {
        await setDoc(storeDocRef, {
          transactions: arrayUnion(sanitizeForFirestore(tx) as unknown as Record<string, unknown>),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      return {
        profile: {
          ...(localStore.profile || {}),
          ...(remoteData.profile || {}),
          name: resolveProfileName(user, localStore.profile?.name, remoteData.profile?.name),
          email: remoteData.profile?.email || localStore.profile?.email || user.email,
        },
        budget: { ...(localStore.budget || {}), ...(remoteData.budget || {}) },
        transactions: Array.from(byId.values()),
        categories: (remoteData.categories && remoteData.categories.length > 0)
          ? remoteData.categories
          : (localStore.categories || []),
      };
    }

    // If it does not exist in Firestore, populate it from existing local store & account
    const initialPayload: UserStoreData = {
      profile: {
        name: resolveProfileName(user, localStore.profile?.name),
        email: localStore.profile?.email || user.email,
        studentId: localStore.profile?.studentId || user.studentId || 'ALU-KGL-2026',
        university: localStore.profile?.university || user.university || 'African Leadership University',
        campus: localStore.profile?.campus || 'Kigali Innovation City, Rwanda',
        currency: localStore.profile?.currency || 'RWF',
        onboardingCompleted: localStore.profile?.onboardingCompleted ?? true,
        avatarUrl: localStore.profile?.avatarUrl || user.avatarUrl || '',
      },
      budget: localStore.budget || {
        monthlyCap: 150000,
        cycleStartDay: 1,
        notifyThresholdPct: 80,
      },
      transactions: localStore.transactions || [],
      categories: localStore.categories || [],
    };

    // Save user profile doc
    await setDoc(doc(db, 'users', userId), sanitizeForFirestore({
      userId,
      name: initialPayload.profile.name,
      email: user.email,
      studentId: user.studentId || initialPayload.profile.studentId || '',
      university: user.university || initialPayload.profile.university || 'African Leadership University',
      avatarUrl: user.avatarUrl || initialPayload.profile.avatarUrl || '',
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }), { merge: true });

    // Save store document
    await setDoc(storeDocRef, sanitizeForFirestore(initialPayload), { merge: true });
    return initialPayload;
  } catch (error) {
    console.warn('[Firestore Initial Migrate Notice]:', error);
    return localStore;
  }
}

/**
 * Saves current user store (profile, budget, transactions, categories) to Firestore.
 * Pass { includeTransactions: false } for routine profile/budget syncs so a
 * device with an older list can never overwrite records added elsewhere.
 */
export async function syncUserStoreToFirestore(
  userId: string,
  store: UserStoreData,
  user?: UserAccount,
  options?: { includeTransactions?: boolean; clearTombstones?: boolean }
): Promise<void> {
  try {
    const includeTransactions = options?.includeTransactions !== false;
    const storeDocRef = doc(db, 'users', userId, 'data', 'store');
    const payload: Record<string, unknown> = {
      ...store,
      updatedAt: new Date().toISOString(),
    };
    if (!includeTransactions) delete payload.transactions;
    if (options?.clearTombstones) payload.deletedTransactionIds = [];
    await setDoc(storeDocRef, sanitizeForFirestore(payload), { merge: true });

    // Update root user profile document
    if (user || store.profile) {
      await setDoc(doc(db, 'users', userId), sanitizeForFirestore({
        userId,
        name: user?.name || store.profile?.name || '',
        email: (user?.email || store.profile?.email || '').trim().toLowerCase(),
        studentId: user?.studentId || store.profile?.studentId || '',
        university: user?.university || store.profile?.university || '',
        avatarUrl: store.profile?.avatarUrl || user?.avatarUrl || '',
        updatedAt: new Date().toISOString(),
      }), { merge: true });
    }
  } catch (error) {
    console.warn('[Firestore Sync Notice]:', error);
  }
}

/**
 * Appends one transaction to the account document.
 * Appending (instead of rewriting the whole list) means a second device with
 * an older list can never erase a record that was just added somewhere else.
 */
export async function addTransactionToFirestore(
  userId: string,
  transaction: Transaction
): Promise<boolean> {
  try {
    const clean = sanitizeForFirestore(transaction);
    await setDoc(doc(db, 'users', userId, 'data', 'store'), {
      transactions: arrayUnion(clean as unknown as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firestore Transaction Add Notice]:', error);
    return false;
  }
}

/**
 * Removes exactly one transaction from the account document. Only the record
 * being deleted is touched; every other record is preserved.
 */
export async function removeTransactionFromFirestore(
  userId: string,
  transaction: Transaction
): Promise<boolean> {
  try {
    const clean = sanitizeForFirestore(transaction);
    await setDoc(doc(db, 'users', userId, 'data', 'store'), {
      transactions: arrayRemove(clean as unknown as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firestore Transaction Remove Notice]:', error);
    return false;
  }
}

/**
 * Records a deletion tombstone. Every device filters these ids out, so a
 * deleted record cannot reappear from another device's stale copy.
 */
export async function markTransactionDeletedInFirestore(
  userId: string,
  transactionId: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'users', userId, 'data', 'store'), {
      deletedTransactionIds: arrayUnion(transactionId),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.warn('[Firestore Transaction Tombstone Notice]:', error);
  }
}

/**
 * Subscribes to real-time updates for the user store.
 * Changes made on one device are instantly broadcast to all devices for this account.
 */
export function subscribeUserStoreFromFirestore(
  userId: string,
  onUpdate: (store: UserStoreData) => void
): () => void {
  const storePath = `users/${userId}/data/store`;
  const storeDocRef = doc(db, 'users', userId, 'data', 'store');

  const unsubscribe = onSnapshot(
    storeDocRef,
    (snapshot) => {
      // Ignore intermediate local echoes with pending writes
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }
      if (snapshot.exists()) {
        const data = snapshot.data() as UserStoreData;
        onUpdate(data);
      }
    },
    (error) => {
      console.warn('[Firestore Real-time Sync Notice]:', error?.message || error);
    }
  );

  return unsubscribe;
}

/**
 * Sends a bug report / support message to the app owner.
 * Reports are stored in the `feedback` collection and are readable by the
 * project owner through the Firebase Console (clients cannot read them).
 */
export async function submitBugReport(
  userId: string,
  report: { message: string; email?: string; name?: string }
): Promise<void> {
  const message = (report.message || '').trim().slice(0, 4000);
  if (!message) {
    throw new Error('Please describe the problem first.');
  }

  await addDoc(collection(db, 'feedback'), {
    uid: userId || 'unknown',
    message,
    email: report.email || '',
    name: report.name || '',
    appVersion: APP_VERSION,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
    createdAt: new Date().toISOString(),
  });
}
