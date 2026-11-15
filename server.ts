import dotenv from 'dotenv';
dotenv.config({ override: true });
import express, { type Request, type Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { initializeApp as initAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, type Firestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the same Firebase project and named Firestore database as the client app
let firebaseProjectId = 'alu-expense-tracker';
let firebaseFirestoreDatabaseId = '';
try {
  const appletConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));
  if (appletConfig.projectId) firebaseProjectId = appletConfig.projectId;
  if (appletConfig.firestoreDatabaseId) firebaseFirestoreDatabaseId = appletConfig.firestoreDatabaseId;
} catch (configErr: any) {
  console.warn('[Firebase Config Notice]:', configErr?.message);
}

// Initialize Firebase Admin for server-side trusted updates
let adminAuthInstance: AdminAuth | null = null;
let adminDbInstance: Firestore | null = null;
try {
  const adminApp = getAdminApps().length === 0
    ? initAdminApp({ projectId: firebaseProjectId })
    : getAdminApp();
  adminAuthInstance = getAdminAuth(adminApp);
  adminDbInstance = firebaseFirestoreDatabaseId
    ? getAdminFirestore(adminApp, firebaseFirestoreDatabaseId)
    : getAdminFirestore(adminApp);
} catch (adminInitErr: any) {
  console.warn('[Firebase Admin Init Notice]:', adminInitErr?.message);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
// Email-only session fallback exists for AI Studio's iframe preview. Never enable it on a published host
// unless explicitly opted in, otherwise anyone who knows an email could read that student's records.
const allowPreviewEmailFallback =
  process.env.ALLOW_PREVIEW_EMAIL_FALLBACK === 'true' ||
  (!process.env.K_SERVICE && !isProduction);

// Standard CORS & OPTIONS preflight handler for mobile apps, PWA, and iframe previews
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Generous payload limit to comfortably handle base64 cropped profile pictures
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  next();
});

// Persistence directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'user_database.json');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}
app.use('/avatars', express.static(AVATARS_DIR));


// Password hashing helpers
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(inputPassword: string, storedHashOrPlain?: string): boolean {
  if (!storedHashOrPlain) return false;
  if (storedHashOrPlain.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = storedHashOrPlain.split('$');
    if (!saltHex || !hashHex) return false;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.scryptSync(inputPassword, Buffer.from(saltHex, 'hex'), expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
  // Compatibility for accounts made by earlier versions; successful login upgrades the hash.
  const legacyHash = crypto.createHash('sha256').update(inputPassword + '_alu_tracker_salt_2026').digest('hex');
  if (storedHashOrPlain === legacyHash) return true;
  if (storedHashOrPlain === inputPassword) return true;
  return false;
}

const SESSION_COOKIE = 'student_tracker_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function publicUser(user: Database['users'][number]) {
  return {
    name: user.name,
    email: user.email,
    studentId: user.studentId,
    avatarUrl: user.avatarUrl,
    university: user.university,
    createdAt: user.createdAt,
  };
}

function getCookieValue(req: Request, name: string): string | null {
  const cookies = req.headers.cookie?.split(';') || [];
  const entry = cookies.find((part) => part.trim().startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.trim().slice(name.length + 1));
  } catch {
    return null;
  }
}

function setSessionCookie(req: Request, res: Response, db: Database, email: string): string {
  db.sessions ||= {};
  const now = Date.now();
  for (const [key, session] of Object.entries(db.sessions)) {
    if (session.expiresAt <= now) delete db.sessions[key];
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[crypto.createHash('sha256').update(token).digest('hex')] = {
    email,
    expiresAt: now + SESSION_TTL_MS,
  };
  saveDatabase(db);
  // SameSite=None; Secure ensures cookie works in iframe preview environments without getting dropped
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=None; Secure; Partitioned; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  return token;
}

function clearSessionCookie(req: Request, res: Response) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=None; Secure; Partitioned; Max-Age=0`);
}

function getAuthenticatedUser(req: Request): { db: Database; user: Database['users'][number] } | null {
  const db = loadDatabase();
  let token = getCookieValue(req, SESSION_COOKIE);

  // Also accept Authorization: Bearer <token>
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1].trim();
    }
  }

  // Also accept ?token= query parameter
  if (!token && req.query.token && typeof req.query.token === 'string') {
    token = (req.query.token as string).trim();
  }

  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = db.sessions?.[tokenHash];
    if (session && session.expiresAt > Date.now()) {
      const user = db.users.find((candidate) => candidate.email.toLowerCase() === session.email.toLowerCase());
      if (user) return { db, user };
    }
  }

  // Fallback for iframe preview contexts using header (local preview only)
  if (allowPreviewEmailFallback) {
    const fallbackEmail = (req.headers['x-session-email'] as string) || (req.query.email as string);
    if (fallbackEmail && typeof fallbackEmail === 'string') {
      const cleanEmail = fallbackEmail.trim().toLowerCase();
      const user = db.users.find((candidate) => candidate.email.toLowerCase() === cleanEmail);
      if (user) return { db, user };
    }
  }

  return null;
}

function clearUserSessions(db: Database, email: string) {
  if (!db.sessions) return;
  for (const [key, session] of Object.entries(db.sessions)) {
    if (session.email.toLowerCase() === email.toLowerCase()) delete db.sessions[key];
  }
}

function maskEmail(email: string): string {
  const clean = email.trim();
  if (!clean || !clean.includes('@')) return clean;
  const [name, domain] = clean.split('@');
  if (name.length <= 1) {
    return `${name}***@${domain}`;
  }
  return `${name[0]}***@${domain}`;
}

export interface Database {
  users: Array<{
    name: string;
    email: string;
    password?: string;
    studentId?: string;
    avatarUrl?: string;
    university?: string;
    createdAt?: string;
  }>;
  stores: Record<string, any>;
  resetTokens?: Record<string, { email: string; userId?: string; expiresAt: number; used?: boolean }>;
  resetCodes?: Record<string, { codeHash: string; email?: string; expiresAt: number; sentAt?: number; used?: boolean; attempts?: number }>;
  sessions?: Record<string, { email: string; expiresAt: number }>;
  savedAt?: number;
}

// Durable server-side persistence:
// Cloud Run / AI Studio containers have an ephemeral filesystem, so the JSON file is only a local cache.
// When hosted, mirror the whole auth database to one Firestore document and restore it on cold start.
const FIRESTORE_DB_COLLECTION = 'system';
const FIRESTORE_DB_DOC = 'appDatabase';
const useFirestorePersistence =
  process.env.ENABLE_FIRESTORE_PERSISTENCE === 'true' ||
  Boolean(process.env.K_SERVICE) ||
  isProduction;
let firestorePersistenceActive = false;
let firestoreBackupWarned = false;

function loadLocalDatabaseFile(): Database | null {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!parsed || !Array.isArray(parsed.users)) return null;
    return parsed as Database;
  } catch (err) {
    console.error('Error loading db file', err);
    return null;
  }
}

function loadDatabase(): Database {
  const existing = loadLocalDatabaseFile();
  if (existing) {
    // Migrate any unhashed passwords to hashed
    let modified = false;
    existing.users.forEach(u => {
      if (u.password && !u.password.startsWith('scrypt$') && u.password.length < 60) {
        u.password = hashPassword(u.password);
        modified = true;
      }
    });
    if (modified) {
      saveDatabase(existing);
    }
    return existing;
  }
  // Start with no pre-created account; each student must register their own account.
  const defaultDb: Database = {
    users: [],
    stores: {},
    sessions: {},
  };
  saveDatabase(defaultDb);
  return defaultDb;
}

async function backupDatabaseToFirestore(db: Database) {
  if (!adminDbInstance) return;
  const payload: Database = JSON.parse(JSON.stringify(db));
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf-8') > 900 * 1024) {
    if (!firestoreBackupWarned) {
      firestoreBackupWarned = true;
      console.warn('[Persistence] Database exceeds 900KB; skipping Firestore backup. Move records to a dedicated collection before real use.');
    }
    return;
  }
  await adminDbInstance
    .collection(FIRESTORE_DB_COLLECTION)
    .doc(FIRESTORE_DB_DOC)
    .set({ db: payload, savedAt: payload.savedAt || Date.now() });
}

function saveDatabase(db: Database) {
  db.savedAt = Date.now();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db file', err);
  }

  if (firestorePersistenceActive && adminDbInstance) {
    backupDatabaseToFirestore(db).catch((err) => {
      if (!firestoreBackupWarned) {
        firestoreBackupWarned = true;
        console.warn('[Persistence] Firestore backup failed; using local file only:', err?.message || err);
      }
    });
  }
}

/**
 * Runs once before accepting requests. On a hosted container with an ephemeral disk,
 * restore the durable Firestore copy; otherwise seed Firestore from the local file.
 */
async function initializeDatabasePersistence() {
  if (!useFirestorePersistence) {
    console.log('[Persistence] Local file database (Firestore mirror disabled).');
    return;
  }
  if (!adminDbInstance) {
    console.warn('[Persistence] Firebase Admin unavailable; using local file database only.');
    return;
  }

  try {
    const ref = adminDbInstance.collection(FIRESTORE_DB_COLLECTION).doc(FIRESTORE_DB_DOC);
    const snap = await ref.get();
    const remote = snap.exists ? (snap.data() as any) : null;
    const remoteDb: Database | null = remote?.db && Array.isArray(remote.db.users) ? remote.db : null;
    const localDb = loadLocalDatabaseFile();

    const remoteSavedAt = Number(remote?.savedAt || remoteDb?.savedAt || 0);
    const localSavedAt = Number(localDb?.savedAt || 0);
    const remoteUsers = remoteDb?.users?.length || 0;
    const localUsers = localDb?.users?.length || 0;

    // Never let an empty remote copy erase real local accounts.
    const shouldRestoreRemote =
      Boolean(remoteDb) &&
      remoteUsers > 0 &&
      (localUsers === 0 || remoteSavedAt >= localSavedAt);

    if (shouldRestoreRemote && remoteDb) {
      fs.writeFileSync(DB_FILE, JSON.stringify(remoteDb, null, 2), 'utf-8');
      console.log(`[Persistence] Restored server database from Firestore (users=${remoteUsers}).`);
    } else {
      const db = loadDatabase();
      await backupDatabaseToFirestore(db);
      console.log(`[Persistence] Backed up local database to Firestore (users=${db.users.length}).`);
    }

    firestorePersistenceActive = true;
  } catch (err: any) {
    console.warn('[Persistence] Firestore unavailable; using local file database only:', err?.message || err);
  }
}

// Ensure database file is initialized on startup
loadDatabase();

// ================= API ENDPOINTS FOR CROSS-DEVICE PERSISTENCE =================

// Register new student account (storing password hashed)
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be between 6 and 128 characters.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Please enter a valid name and email address.' });
    }
    const db = loadDatabase();
    const existing = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'This email is already registered. Please sign in or reset your password.' });
    }
    const newUser = {
      name: name.trim(),
      email: cleanEmail,
      password: hashPassword(password),
      studentId: `ALU-${Math.floor(1000 + Math.random() * 9000)}`,
      university: 'African Leadership University',
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    
    // Initialize clean store
    db.stores[cleanEmail] = {
      profile: {
        name: newUser.name,
        email: newUser.email,
        studentId: newUser.studentId,
        university: newUser.university,
        campus: 'Kigali Innovation City, Rwanda',
        currency: 'RWF',
        onboardingCompleted: true
      },
      budget: {
        monthlyCap: 150000,
        cycleStartDay: 1,
        notifyThresholdPct: 80
      },
      transactions: [],
      categories: []
    };
    
    const token = setSessionCookie(req, res, db, cleanEmail);
    return res.json({ success: true, token, user: publicUser(newUser) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Server error' });
  }
});

// Authenticate student account (with exact error messages requested)
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const db = loadDatabase();
    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email.' });
    }
    if (!user.password) {
      user.password = hashPassword(password);
      saveDatabase(db);
    } else if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Try again.' });
    }
    if (user.password && !user.password.startsWith('scrypt$')) {
      user.password = hashPassword(password);
      saveDatabase(db);
    }
    const store = db.stores[cleanEmail] || null;
    const token = setSessionCookie(req, res, db, cleanEmail);
    return res.json({ success: true, token, user: publicUser(user), store });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Server error' });
  }
});

app.get('/api/auth/session', (req, res) => {
  const auth = getAuthenticatedUser(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Please sign in.' });
  }
  return res.json({
    success: true,
    user: publicUser(auth.user),
    store: auth.db.stores[auth.user.email.toLowerCase()] || null,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getCookieValue(req, SESSION_COOKIE);
  if (token) {
    const db = loadDatabase();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (db.sessions) delete db.sessions[tokenHash];
    saveDatabase(db);
  }
  clearSessionCookie(req, res);
  return res.json({ success: true });
});

// Mail transporter helper (uses standard SMTP if valid non-placeholder credentials are configured)
function getMailTransporter() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim() || 'miraclechidozie35@gmail.com';
  const rawPass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_PASS?.trim();
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';

  // Check that credentials are real values and not placeholder labels
  const isPlaceholderUser = !user || !user.includes('@') || 
    user.toLowerCase().includes('the gmail') || 
    user.toLowerCase().includes('your-email') || 
    user.toLowerCase().includes('example.com');

  const isPlaceholderPass = !pass || 
    pass.toLowerCase().includes('apppassword') || 
    pass.toLowerCase().includes('16-character') || 
    pass.toLowerCase().includes('your-gmail') ||
    pass.toLowerCase() === 'password';

  if (!isPlaceholderUser && !isPlaceholderPass && user && pass) {
    const isExplicitSecure = process.env.SMTP_SECURE === 'true';
    const isExplicitInsecure = process.env.SMTP_SECURE === 'false';
    const secure = isExplicitSecure || (!isExplicitInsecure && port === 465);

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return null;
}

function getMailFromAddress() {
  const user = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim() || 'miraclechidozie35@gmail.com';
  const configuredFrom = process.env.SMTP_FROM?.trim();
  const isPlaceholder = !configuredFrom
    || configuredFrom.toLowerCase().includes('your-email')
    || configuredFrom.toLowerCase().includes('example.com');
  return !isPlaceholder && configuredFrom && configuredFrom.includes('@')
    ? configuredFrom
    : `"Student Expense Tracker" <${user}>`;
}

// Generate HTML template for reset link email (Never emails old password)
function generateResetLinkEmailHtml(email: string, resetUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e5e9e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f4c3a; margin: 0; font-size: 22px;">Student Expense Tracker</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">African Leadership University · Kigali Innovation City</p>
      </div>
      <p style="font-size: 15px; color: #1e293b;">Hello,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        We received a request to reset the password for your account (<strong>${maskEmail(email)}</strong>).
      </p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Click the link below to set a new password. This link expires in <strong>15 minutes</strong> and works only once:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #0f4c3a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 9999px; font-weight: bold; font-size: 14px; display: inline-block;">
          Set New Password
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all;">
        Or copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color: #0f4c3a;">${resetUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Security Notice: Never share this link. If you did not request this reset, your account remains secure and your password is unchanged.
      </p>
    </div>
  `;
}

// Generate HTML template for 6-digit verification code email
function generateResetCodeEmailHtml(email: string, code: string, resetUrl?: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e5e9e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f4c3a; margin: 0; font-size: 22px;">Student Expense Tracker</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">African Leadership University · Kigali Innovation City</p>
      </div>
      <p style="font-size: 15px; color: #1e293b; margin-bottom: 12px;">Hello,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-top: 0;">
        We received a request to reset your password for account <strong>${maskEmail(email)}</strong>.
      </p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Here is your <strong>6-digit verification code</strong>. It expires in <strong>15 minutes</strong> and works only once:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #0f4c3a; color: #0f4c3a; padding: 16px 36px; border-radius: 14px; font-weight: 800; font-size: 32px; letter-spacing: 8px; font-family: monospace;">
          ${code}
        </div>
      </div>
      <p style="font-size: 13px; color: #475569; text-align: center; margin-top: 0; line-height: 1.5;">
        Copy this code and paste it into the app, then enter your new password to finish.
      </p>
      ${resetUrl ? `
      <div style="text-align: center; margin: 20px 0 10px 0;">
        <p style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Or click the link directly if you prefer:</p>
        <a href="${resetUrl}" style="background-color: #0f4c3a; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 9999px; font-weight: bold; font-size: 12px; display: inline-block;">
          Open Reset Page
        </a>
      </div>
      ` : ''}
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
        Security Notice: Never share this code with anyone. If you did not request this, your account is secure and your password is unchanged.
      </p>
    </div>
  `;
}

// ================= APP VERSION & AUTO-UPDATE SYSTEM =================
const VERSION_FILE = path.join(DATA_DIR, 'app_version.json');

function getPublishedAppVersion(): { version: string; releaseNotes: string[] } {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'));
    }
  } catch {}
  const defaultVersion = {
    version: '1.1',
    releaseNotes: [
      'Secure 6-digit email password recovery sent directly to student email via Gmail SMTP',
      'Real-time Firebase Firestore database sync across mobile phone and PC',
      'Mobile Money (MoMo) Rwanda SMS parser with first-time tutorial and quick navbar shortcut',
      'Offline-ready PWA installation with direct mobile home screen launcher',
      'In-app update checker to instantly verify and apply new versions'
    ]
  };
  try {
    fs.writeFileSync(VERSION_FILE, JSON.stringify(defaultVersion, null, 2), 'utf-8');
  } catch {}
  return defaultVersion;
}

app.get('/api/version', (req, res) => {
  const v = getPublishedAppVersion();
  return res.json(v);
});

app.post('/api/version/publish', (req, res) => {
  try {
    const { version, releaseNotes } = req.body;
    if (!version) return res.status(400).json({ error: 'Version required' });
    const current = getPublishedAppVersion();
    const updated = {
      version: String(version).trim(),
      releaseNotes: Array.isArray(releaseNotes) ? releaseNotes : current.releaseNotes,
    };
    fs.writeFileSync(VERSION_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return res.json({ success: true, ...updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// Check whether an account exists for this email
app.get('/api/auth/check-email', (req, res) => {
  try {
    const email = (req.query.email as string)?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ exists: false, error: "Please enter your email." });
    }
    const db = loadDatabase();
    const user = db.users.find(u => u.email.toLowerCase() === email);
    if (!user) {
      return res.status(404).json({ exists: false, error: "Account doesn't exist on this email." });
    }
    return res.json({ exists: true, email: user.email });
  } catch (e: any) {
    return res.status(500).json({ exists: false, error: e?.message || 'Server error' });
  }
});

// 1. Send reset link only to the email saved on that account
app.post('/api/auth/send-reset-link', async (req, res) => {
  try {
    const { email } = req.body;
    const typedEmail = email?.trim().toLowerCase();
    if (!typedEmail) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const db = loadDatabase();
    // Logic: user = database.findUserByEmail(typedEmail)
    // Typed email is used only to look up the account. It is never used as the destination.
    const user = db.users.find(u => u.email.toLowerCase() === typedEmail);
    // If no account is found, send nothing and show "Account doesn't exist on this email."
    if (!user) {
      return res.status(404).json({ success: false, error: "Account doesn't exist on this email." });
    }

    // Read the email address stored on that account record in the database.
    // That stored address is the only destination.
    // The `to` field must always be user.email from the database. It must never be typedEmail or any value from the request, form or URL.
    const storedDestinationEmail = user.email;

    // token = generateRandomToken()
    const token = crypto.randomBytes(32).toString('hex');

    if (!db.resetTokens) {
      db.resetTokens = {};
    }
    // Clean up expired tokens
    const now = Date.now();
    for (const [t, rec] of Object.entries(db.resetTokens)) {
      if (now > rec.expiresAt || rec.used) {
        delete db.resetTokens[t];
      }
    }

    // saveToken(user.id, token, expiresIn15Minutes)
    db.resetTokens[token] = {
      userId: user.studentId || user.email,
      email: storedDestinationEmail, // Destination is strictly user.email from database record
      expiresAt: now + 15 * 60 * 1000,
      used: false,
    };
    saveDatabase(db);

    // Build reset link: baseUrl + "/reset?token=" + token
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = process.env.APP_URL || `${proto}://${hostHeader}`;
    const resetUrl = `${baseUrl}/reset?token=${token}`;

    // 1. Dispatch real recovery email via Google Firebase Identity Platform
    try {
      const firebaseApiKey = 'AIzaSyCm7stRXEZHjYZFFoIsJLgIwriBXfk0H2k';
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: user.email,
        }),
      });
    } catch (fbErr: any) {
      console.warn('[Firebase Reset Link Dispatch]:', fbErr?.message);
    }

    // 2. Also attempt Nodemailer SMTP if configured
    const transporter = getMailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: getMailFromAddress(),
          to: user.email,
          subject: 'Reset your Student Expense Tracker password',
          text: `Reset your password by opening this link within 15 minutes: ${resetUrl}`,
          html: generateResetLinkEmailHtml(user.email, resetUrl),
        });
      } catch (smtpErr: any) {
        console.warn(`[SMTP Reset Link Warning]: ${smtpErr?.message || 'SMTP delivery rejected'}`);
      }
    }

    const auditLine = `[${new Date().toISOString()}] Reset token successfully dispatched to stored DB user: ${user.email}\n`;
    fs.appendFileSync(path.join(DATA_DIR, 'security_audit.log'), auditLine);

    return res.json({
      success: true,
      message: `We sent a reset link to ${maskEmail(user.email)}. Please check your inbox or spam folder.`,
      maskedEmail: maskEmail(user.email),
      expiresInMinutes: 15
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Server error' });
  }
});

// 2. Validate reset token when link is opened
app.get('/api/auth/verify-reset-token', (req, res) => {
  try {
    const token = (req.query.token as string)?.trim();
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Reset link is required.' });
    }

    const db = loadDatabase();
    const record = db.resetTokens?.[token];
    if (!record) {
      return res.status(400).json({ valid: false, error: 'This reset link has expired or has already been used. Please request a new link.' });
    }

    if (Date.now() > record.expiresAt) {
      if (db.resetTokens) delete db.resetTokens[token];
      saveDatabase(db);
      return res.status(400).json({ valid: false, error: 'This reset link has expired (15-minute limit exceeded). Please request a new link.' });
    }

    if (record.used) {
      if (db.resetTokens) delete db.resetTokens[token];
      saveDatabase(db);
      return res.status(400).json({ valid: false, error: 'This reset link has already been used. Please request a new link if needed.' });
    }

    return res.json({
      valid: true,
      email: record.email,
      maskedEmail: maskEmail(record.email),
    });
  } catch (e: any) {
    return res.status(500).json({ valid: false, error: e?.message || 'Server error' });
  }
});

// 3. Complete password reset: store password hashed, invalidate token (works once)
app.post('/api/auth/complete-reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (typeof token !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ success: false, error: 'New password must be between 6 and 128 characters.' });
    }

    const db = loadDatabase();
    const record = db.resetTokens?.[token];
    if (!record || record.used || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, error: 'This reset link has expired or has already been used. Please request a new link.' });
    }

    // Update user password to securely hashed representation
    const userIndex = db.users.findIndex(u => u.email.toLowerCase() === record.email.toLowerCase());
    if (userIndex >= 0) {
      db.users[userIndex].password = hashPassword(newPassword);
      clearUserSessions(db, record.email);
    }

    // Token works once: invalidate immediately
    record.used = true;
    if (db.resetTokens) delete db.resetTokens[token];
    clearSessionCookie(req, res);
    saveDatabase(db);

    const auditLine = `[${new Date().toISOString()}] Password successfully reset via 15-minute token for ${record.email}\n`;
    fs.appendFileSync(path.join(DATA_DIR, 'security_audit.log'), auditLine);

    return res.json({ success: true, message: 'Password updated successfully! You can now sign in.' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Server error' });
  }
});

// Check if outgoing email settings are active on the server
app.get('/api/auth/email-status', (_req, res) => {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim() || 'miraclechidozie35@gmail.com';
  const rawPass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_PASS?.trim();
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';
  const transporter = getMailTransporter();
  const configured = !!transporter;
  return res.json({
    configured,
    senderEmail: configured ? maskEmail(user) : null,
    host,
    port,
    userLength: user.length,
    userPreview: user,
    passLength: pass.length,
    isPlaceholderUser: !user || !user.includes('@'),
    isPlaceholderPass: !pass || pass.toLowerCase().includes('apppassword') || pass.toLowerCase().includes('16-character') || pass.toLowerCase() === 'password',
  });
});

// 4. Send 6-digit recovery code strictly to stored database email (Expires in 15 mins, one-time)
app.post('/api/auth/send-recovery-code', async (req, res) => {
  try {
    const { email } = req.body;
    const typedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!typedEmail) {
      return res.status(400).json({ success: false, error: 'Please enter your email address.' });
    }

    const db = loadDatabase();
    // Account lookup only: typed input is never the destination
    const user = db.users.find(u => u.email.toLowerCase() === typedEmail);
    if (!user) {
      return res.status(404).json({ success: false, error: "Account doesn't exist on this email." });
    }

    // Destination is strictly the email stored on the user record in the database
    const destinationEmail = user.email;
    const emailKey = destinationEmail.toLowerCase();
    const existingCode = db.resetCodes?.[emailKey];
    if (existingCode?.sentAt && Date.now() - existingCode.sentAt < 60 * 1000) {
      return res.status(429).json({ success: false, error: 'Please wait one minute before requesting another recovery code.' });
    }

    // Generate a random six-digit code, including leading zeroes when needed.
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');

    if (!db.resetCodes) {
      db.resetCodes = {};
    }

    const now = Date.now();
    // Clean expired or used codes
    for (const [em, rec] of Object.entries(db.resetCodes)) {
      if (now > rec.expiresAt || rec.used) {
        delete db.resetCodes[em];
      }
    }

    // Store code against user's email with 15-minute expiry and single-use flag
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    db.resetCodes[emailKey] = {
      codeHash,
      email: destinationEmail,
      expiresAt: now + 15 * 60 * 1000,
      sentAt: now,
      used: false,
      attempts: 0,
    };
    saveDatabase(db);

    // Optional troubleshooting aid: set LOG_RESET_CODES=true to see the code in server logs
    // when email delivery is unavailable. Leave this unset for real deployments.
    if (process.env.LOG_RESET_CODES === 'true') {
      console.warn(`[RESET-CODE] ${destinationEmail}: ${code} (temporary code; remove LOG_RESET_CODES after testing)`);
    }

    // Build reset link as an optional alternative for email
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = process.env.APP_URL || `${proto}://${hostHeader}`;
    const resetUrl = `${baseUrl}/?reset_email=${encodeURIComponent(destinationEmail)}`;

    // 1. Dispatch real recovery email via Google Firebase Identity Platform
    try {
      const firebaseApiKey = 'AIzaSyCm7stRXEZHjYZFFoIsJLgIwriBXfk0H2k';
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: destinationEmail,
        }),
      });
    } catch (fbErr: any) {
      console.warn('[Firebase Identity Dispatch]:', fbErr?.message);
    }

    // 2. Dispatch real recovery email via Nodemailer SMTP
    const transporter = getMailTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        error: 'SMTP email dispatch is not configured. Please provide your sender Gmail and 16-character Google App Password so the server can send your verification code.',
      });
    }

    try {
      await transporter.sendMail({
        from: getMailFromAddress(),
        to: destinationEmail,
        subject: 'Your Student Expense Tracker password reset code',
        text: `Your 6-digit verification code is: ${code}\nThis code expires in 15 minutes and works once.\nEnter it in the app to set your new password.`,
        html: generateResetCodeEmailHtml(destinationEmail, code, resetUrl),
      });
    } catch (smtpErr: any) {
      console.error('[SMTP Dispatch Error]:', smtpErr?.message);
      return res.status(500).json({
        success: false,
        error: `Could not send recovery email via Gmail: ${smtpErr?.message || 'SMTP authentication failed'}. Please check your Google App Password.`,
      });
    }

    const auditLine = `[${new Date().toISOString()}] 6-Digit recovery code generated and email dispatched to stored DB user: ${destinationEmail}\n`;
    fs.appendFileSync(path.join(DATA_DIR, 'security_audit.log'), auditLine);

    // Return HTTP 200 only after successful SMTP email handoff
    return res.status(200).json({
      success: true,
      message: `We sent your 6-digit code to ${maskEmail(destinationEmail)}. Please check your inbox or spam folder.`,
      maskedEmail: maskEmail(destinationEmail),
      expiresInMinutes: 15
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Server error' });
  }
});

// 5. Verify 6-digit code and save new password (works once, hashed with salt, updates both local DB and Firebase Auth)
app.post('/api/auth/verify-reset-code', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanCode = typeof code === 'string' ? code.trim() : '';

    if (!cleanEmail || !/^\d{6}$/.test(cleanCode || '') || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, error: 'Email, 6-digit code, and new password are required.' });
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ success: false, error: 'New password must be between 6 and 128 characters.' });
    }

    const db = loadDatabase();
    const record = db.resetCodes?.[cleanEmail];
    if (!record) {
      return res.status(400).json({ success: false, error: 'No active reset code found for this account. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt) {
      if (db.resetCodes) delete db.resetCodes[cleanEmail];
      saveDatabase(db);
      return res.status(400).json({ success: false, error: 'This code has expired (15-minute limit exceeded). Please request a new code.' });
    }

    if (record.used) {
      if (db.resetCodes) delete db.resetCodes[cleanEmail];
      saveDatabase(db);
      return res.status(400).json({ success: false, error: 'This code has already been used. Please request a new code.' });
    }

    if (!record.codeHash) {
      if (db.resetCodes) delete db.resetCodes[cleanEmail];
      saveDatabase(db);
      return res.status(400).json({ success: false, error: 'This older code is no longer valid. Please request a new code.' });
    }

    if (record.attempts !== undefined && record.attempts >= 5) {
      if (db.resetCodes) delete db.resetCodes[cleanEmail];
      saveDatabase(db);
      return res.status(400).json({ success: false, error: 'Too many incorrect attempts. Please request a new code.' });
    }

    const submittedCodeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    const expectedCodeHash = Buffer.from(record.codeHash, 'hex');
    const actualCodeHash = Buffer.from(submittedCodeHash, 'hex');
    const codeMatches = expectedCodeHash.length === actualCodeHash.length && crypto.timingSafeEqual(expectedCodeHash, actualCodeHash);
    if (!codeMatches) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5 && db.resetCodes) delete db.resetCodes[cleanEmail];
      saveDatabase(db);
      return res.status(400).json({ success: false, error: 'Invalid 6-digit code. Please check your email and try again.' });
    }

    // Find user record in database
    const userIndex = db.users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: "Account doesn't exist on this email." });
    }

    // Save hashed password in local database
    db.users[userIndex].password = hashPassword(newPassword);
    clearUserSessions(db, cleanEmail);

    // Also update Firebase Authentication password via Firebase Admin SDK
    if (adminAuthInstance) {
      try {
        let fbUser: any = null;
        try {
          fbUser = await adminAuthInstance.getUserByEmail(cleanEmail);
        } catch (notFoundErr: any) {
          if (notFoundErr.code === 'auth/user-not-found') {
            fbUser = await adminAuthInstance.createUser({
              email: cleanEmail,
              password: newPassword,
              displayName: db.users[userIndex]?.name || cleanEmail.split('@')[0],
            });
            console.log(`[Firebase Admin]: Created user in Firebase Auth with updated password for ${cleanEmail}`);
          }
        }
        if (fbUser && fbUser.uid) {
          await adminAuthInstance.updateUser(fbUser.uid, { password: newPassword });
          console.log(`[Firebase Admin]: Updated Firebase Auth password for ${cleanEmail}`);
        }
      } catch (fbAdminErr: any) {
        console.warn(`[Firebase Admin Update Password]: ${fbAdminErr?.message}`);
      }
    }

    // Mark code as used and remove so it cannot be used twice
    record.used = true;
    if (db.resetCodes) delete db.resetCodes[cleanEmail];
    saveDatabase(db);

    const auditLine = `[${new Date().toISOString()}] Password successfully reset via 6-digit verification code for ${cleanEmail}\n`;
    fs.appendFileSync(path.join(DATA_DIR, 'security_audit.log'), auditLine);

    clearSessionCookie(req, res);
    return res.json({ success: true, message: 'Password updated successfully! You can now sign in.' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Server error' });
  }
});

// Fetch user data & store for cross-device sync
app.get('/api/user-store', (req, res) => {
  try {
    const db = loadDatabase();
    let authenticatedUser: Database['users'][number] | undefined;
    let cleanEmail = '';
    
    const auth = getAuthenticatedUser(req);
    if (auth) {
      authenticatedUser = auth.user;
      cleanEmail = authenticatedUser.email.toLowerCase();
    } else if (allowPreviewEmailFallback && req.query.email && typeof req.query.email === 'string') {
      cleanEmail = (req.query.email as string).trim().toLowerCase();
      authenticatedUser = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!authenticatedUser || !cleanEmail) {
      return res.status(401).json({ error: 'Please sign in to view your records.' });
    }

    const store = db.stores[cleanEmail] || null;
    return res.json({ store, user: publicUser(authenticatedUser) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// Save user store for cross-device sync
app.post('/api/user-store', (req, res) => {
  try {
    const db = loadDatabase();
    let authenticatedUser: Database['users'][number] | undefined;
    let cleanEmail = '';

    const auth = getAuthenticatedUser(req);
    if (auth) {
      authenticatedUser = auth.user;
      cleanEmail = authenticatedUser.email.toLowerCase();
    } else if (allowPreviewEmailFallback && req.body.email && typeof req.body.email === 'string') {
      cleanEmail = req.body.email.trim().toLowerCase();
      authenticatedUser = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!authenticatedUser || !cleanEmail) {
      return res.status(401).json({ error: 'Please sign in to save your records.' });
    }

    const { store, user } = req.body;
    if (!store || typeof store !== 'object' || Array.isArray(store)) {
      return res.status(400).json({ error: 'A valid record store is required.' });
    }

    store.profile = { ...(store.profile || {}), email: cleanEmail };
    db.stores[cleanEmail] = store;

    if (user && typeof user === 'object') {
      if (typeof user.name === 'string') authenticatedUser.name = user.name.slice(0, 120);
      if (typeof user.avatarUrl === 'string' || user.avatarUrl === null) authenticatedUser.avatarUrl = user.avatarUrl || undefined;
      if (typeof user.studentId === 'string') authenticatedUser.studentId = user.studentId.slice(0, 80);
      if (typeof user.university === 'string') authenticatedUser.university = user.university.slice(0, 120);
    }

    saveDatabase(db);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// Update profile photo specifically (with disk file saving & cross-device persistence)
app.post('/api/update-avatar', (req, res) => {
  try {
    const db = loadDatabase();
    let user: Database['users'][number] | undefined;
    let cleanEmail = '';

    const auth = getAuthenticatedUser(req);
    if (auth) {
      user = auth.user;
      cleanEmail = user.email.toLowerCase();
    } else if (allowPreviewEmailFallback && req.body.email && typeof req.body.email === 'string') {
      cleanEmail = req.body.email.trim().toLowerCase();
      user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!user || !cleanEmail) {
      return res.status(401).json({ error: 'Please sign in to update your profile.' });
    }

    const { avatarUrl } = req.body;
    if (avatarUrl !== null && typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'A valid profile image is required.' });
    }

    let finalAvatarUrl: string | undefined = undefined;

    if (avatarUrl && typeof avatarUrl === 'string') {
      if (avatarUrl.startsWith('data:image/')) {
        try {
          const matches = avatarUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (matches && matches[2]) {
            const ext = matches[1].toLowerCase().includes('png') ? 'png' : 'jpg';
            const buffer = Buffer.from(matches[2], 'base64');
            const safeName = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `${safeName}.${ext}`;
            fs.writeFileSync(path.join(AVATARS_DIR, fileName), buffer);
            finalAvatarUrl = `/avatars/${fileName}?t=${Date.now()}`;
          } else {
            finalAvatarUrl = avatarUrl;
          }
        } catch (err: any) {
          console.warn('[Avatar disk save notice]:', err?.message);
          finalAvatarUrl = avatarUrl;
        }
      } else {
        // Direct URL or already remote
        finalAvatarUrl = avatarUrl;
      }
    }

    // Update user record
    user.avatarUrl = finalAvatarUrl;

    // Update user store profile
    if (!db.stores[cleanEmail]) {
      db.stores[cleanEmail] = { profile: {} };
    }
    if (!db.stores[cleanEmail].profile) {
      db.stores[cleanEmail].profile = {};
    }
    db.stores[cleanEmail].profile.avatarUrl = finalAvatarUrl;

    saveDatabase(db);
    return res.json({ success: true, avatarUrl: finalAvatarUrl });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});


// 404 handler for API routes (prevent falling through to HTML index)
app.all('/api/*', (_req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// ================= VITE DEV MIDDLEWARE & PRODUCTION SERVING =================
async function startServer() {
  const distDir = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));
  const isDev = process.env.NODE_ENV === 'development' || (!isProduction && !hasDist);

  // Load the durable database copy before serving any request
  await initializeDatabasePersistence();

  // Attach Vite's HMR WebSocket to the same HTTP server so edits live-reload instantly in local preview
  const httpServer = http.createServer(app);

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static dist in production
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} (${isDev ? 'development' : 'production'})`);
  });
}

startServer();
