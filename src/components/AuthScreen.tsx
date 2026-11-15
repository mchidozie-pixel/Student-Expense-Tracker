import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sun, 
  Moon,
  ChevronLeft,
  Eye,
  EyeOff,
  Send,
  Smartphone
} from 'lucide-react';
import { 
  maskEmail
} from '../utils/storage';
import { UserAccount } from '../types';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  fetchSignInMethodsForEmail,
  updateProfile 
} from 'firebase/auth';
import { auth as clientAuth } from '../lib/firebase';

/**
 * Converts Firebase Authentication error codes into student-friendly messages.
 * Firebase is now the only account/password authority, so configuration issues
 * (Email/Password provider disabled, unauthorized domain) surface here.
 */
function getFirebaseAuthMessage(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/wrong-password':
      return 'Incorrect password for this email. Try again or use Forgot password.';
    case 'auth/user-not-found':
      return 'No account exists with this email. Create an account instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact the app owner.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Sign-in is temporarily unavailable. Please try again later or contact the app owner.';
    case 'auth/unauthorized-domain':
      return 'Sign-in is not available on this web address. Please open the app from its official link.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

interface AuthScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

/** Practical email check so students get a clear message before Firebase does. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Password reset uses Firebase's standard email flow (the reliable v1.1
 * behaviour). The link opens Firebase's own "Reset your password" page,
 * which works on the free Spark plan without a custom action domain.
 * Custom continue URLs and handleCodeInApp caused "invalid page mode" errors.
 */

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  isDark,
  onToggleTheme,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot' | 'reset_password'>('signin');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password visibility (peek-on-hold / toggle)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password recovery flow (Firebase sends the reset email)
  const [maskedEmail, setMaskedEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [sentAtLabel, setSentAtLabel] = useState('');
  // Firebase keeps only ONE active reset link per account: any new request
  // cancels the previous email. A cooldown stops the app from doing that
  // to a link the student is about to open.
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Link token verification flow (kept for direct link compatibility)
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetTokenValid, setResetTokenValid] = useState<boolean | null>(null);
  const [resetTokenError, setResetTokenError] = useState<string | null>(null);
  const [resetMaskedEmail, setResetMaskedEmail] = useState<string>('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetFormState = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLinkSent(false);
  };

  // Password-reset link from the email: ?mode=resetPassword&oobCode=...
  // Firebase puts the one-time code in the URL; we verify it and show our own
  // "set a new password" screen so the student never leaves the app.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('alu_password_reset_complete') === 'true') {
        sessionStorage.removeItem('alu_password_reset_complete');
        setSuccessMsg('Password updated successfully! Please sign in with your new password.');
      }
    } catch {}

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    if (mode !== 'resetPassword' || !oobCode) return;

    // Strip the code from the address bar so a refresh cannot resubmit it.
    window.history.replaceState({}, document.title, window.location.pathname);

    setResetToken(oobCode);
    setAuthMode('reset_password');
    setLoading(true);
    verifyPasswordResetCode(clientAuth, oobCode)
      .then((accountEmail) => {
        setResetTokenValid(true);
        setResetMaskedEmail(maskEmail(accountEmail));
        setEmail(accountEmail);
      })
      .catch((err: any) => {
        const code = err?.code || '';
        setResetTokenValid(false);
        setResetTokenError(
          code === 'auth/expired-action-code'
            ? 'This reset link has expired or was already used. Request a new link below.'
            : code === 'auth/invalid-action-code'
              ? 'This reset link is not valid. Request a new one below.'
              : 'Could not verify this reset link. Please request a new one.'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Enter your email and password.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Enter a valid email address, like name@gmail.com.');
      return;
    }

    setLoading(true);
    try {
      // Ask Firebase whether this email already has an account. This lets the
      // app say "password is wrong" vs "this account does not exist" after a
      // failed sign-in (reliable when account enumeration protection is off).
      let accountExists: boolean | null = null;
      try {
        const methods = await fetchSignInMethodsForEmail(clientAuth, cleanEmail);
        accountExists = methods.length > 0;
      } catch {
        accountExists = null;
      }

      try {
        // Firebase Authentication is the single source of truth for accounts.
        const credential = await signInWithEmailAndPassword(clientAuth, cleanEmail, password);
        const firebaseUser = credential.user;

        onLoginSuccess({
          uid: firebaseUser.uid,
          email: firebaseUser.email || cleanEmail,
          name: firebaseUser.displayName || cleanEmail.split('@')[0],
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          avatarUrl: firebaseUser.photoURL || undefined,
        });
      } catch (err: any) {
        if (err?.code === 'auth/invalid-credential') {
          if (accountExists === false) {
            // Enumeration protection is off, so an empty result is proof.
            setErrorMsg('This account does not exist in the database. Check the email address or create an account.');
          } else if (accountExists === true) {
            // Proven to exist, so the only thing left wrong is the password.
            setErrorMsg('Password is incorrect for this email. Try again or use Forgot password.');
          } else {
            setErrorMsg('Incorrect email or password. If you have not created an account with this email, create one; otherwise use Forgot password.');
          }
        } else {
          setErrorMsg(getFirebaseAuthMessage(err));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMsg('Enter a valid email address, like name@gmail.com.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Create the account directly in Firebase Authentication.
      // This also signs the student in immediately.
      const credential = await createUserWithEmailAndPassword(clientAuth, cleanEmail, password);
      const firebaseUser = credential.user;

      if (cleanName) {
        await updateProfile(firebaseUser, { displayName: cleanName }).catch(() => {});
      }

      setSuccessMsg('Account created! Initialized fresh 0000 records.');
      onLoginSuccess({
        uid: firebaseUser.uid,
        email: firebaseUser.email || cleanEmail,
        name: cleanName || cleanEmail.split('@')[0],
        createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
      });
    } catch (err: any) {
      setErrorMsg(getFirebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Forgot password flow: Firebase Authentication sends the reset email.
  // The student clicks the link and lands on Firebase's password page.
  const sendResetEmail = async (cleanEmail: string) => {
    await sendPasswordResetEmail(clientAuth, cleanEmail);
  };

  const handleInitiateForgot = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Enter your email address above first, then tap Forgot password.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('That email looks incomplete. Use the full address, like name@gmail.com.');
      return;
    }

    setLoading(true);
    try {
      // Email enumeration protection is off for this project, so this answer is
      // definitive: an empty list means the email has no account here at all.
      let methods: string[] | null = null;
      try {
        methods = await fetchSignInMethodsForEmail(clientAuth, cleanEmail);
      } catch (err: any) {
        // The Email/Password provider is switched off, so no reset can be sent.
        if (err?.code === 'auth/operation-not-allowed') {
          setErrorMsg('Password reset is not available yet. Please contact the app owner.');
          return;
        }
        methods = null;
      }

      if (methods !== null && methods.length === 0) {
        // No account: do not send anything, say it plainly.
        setErrorMsg('This account does not exist in the database. Check the email address or create an account.');
        return;
      }

      try {
        await sendResetEmail(cleanEmail);
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
          setErrorMsg('This account does not exist in the database. Check the email address or create an account.');
          return;
        }
        throw err;
      }

      const displayMasked = maskEmail(cleanEmail);
      setMaskedEmail(displayMasked);
      setAuthMode('forgot');
      setLinkSent(true);
      setSentAtLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setResendCooldown(120);
      setSuccessMsg(`Reset link sent to ${displayMasked}. Open it and choose a new password.`);
    } catch (err: any) {
      setErrorMsg(getFirebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendRecoveryCode = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (resendCooldown > 0) {
      setErrorMsg('Wait for the current link first. A new request cancels the email already in your inbox.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Email address is missing. Please return to sign in.');
      return;
    }

    setLoading(true);
    try {
      try {
        await sendResetEmail(cleanEmail);
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
          setErrorMsg('This account does not exist in the database. Check the email address or create an account.');
          return;
        }
        throw err;
      }
      setLinkSent(true);
      setSentAtLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setResendCooldown(120);
      setSuccessMsg(`A new reset link was sent to ${maskedEmail || maskEmail(cleanEmail)}. The previous email no longer works.`);
    } catch (err: any) {
      setErrorMsg(getFirebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetToken) {
      setErrorMsg('This reset link is missing its code. Please open the newest link from your email.');
      return;
    }
    if (resetPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setErrorMsg('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(clientAuth, resetToken, resetPassword);

      // We already know the new password, so sign the student straight in
      // instead of sending them back to the login form.
      const cleanEmail = email.trim().toLowerCase();
      try {
        const credential = await signInWithEmailAndPassword(clientAuth, cleanEmail, resetPassword);
        const firebaseUser = credential.user;
        onLoginSuccess({
          uid: firebaseUser.uid,
          email: firebaseUser.email || cleanEmail,
          name: firebaseUser.displayName || cleanEmail.split('@')[0],
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          avatarUrl: firebaseUser.photoURL || undefined,
        });
        return;
      } catch {
        // Password was saved; the automatic sign-in just did not go through.
        setSuccessMsg('Password updated. Sign in with your new password.');
        setPassword('');
        setResetPassword('');
        setResetConfirmPassword('');
        setResetToken(null);
        setResetTokenValid(null);
        setAuthMode('signin');
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setResetTokenValid(false);
        setResetTokenError('This reset link has expired or was already used. Request a new link below.');
      } else {
        setErrorMsg(getFirebaseAuthMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center px-4 py-8 transition-colors duration-200 ${
      isDark ? 'bg-[#0b0d11] text-gray-100' : 'bg-[#f5f7f6] text-gray-900'
    }`}>
      
      {/* Top controls: Theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            isDark 
              ? 'bg-[#151922] border-[#252c3d] text-amber-300 hover:bg-[#1c2230]' 
              : 'bg-white border-[#e5e9e7] text-gray-700 hover:bg-gray-50 shadow-xs'
          }`}
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-gray-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md">
        
        {/* Brand Lockup */}
        <div className="text-center mb-6">
          <div 
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl app-logo-badge border p-2 shadow-md mb-3 overflow-hidden"
            style={{ backgroundColor: '#ffffff', borderColor: '#e2e8e5' }}
          >
            <img 
              src="/assets/aistudio/logo1_4461ccd3.png" 
              alt="Student Expense Tracker Logo" 
              className="w-full h-full object-contain select-none"
              style={{ filter: 'none' }}
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Student Expense Tracker
          </h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            African Leadership University · Kigali Innovation City
          </p>
        </div>

        {/* Main Card */}
        <div className={`p-6 sm:p-7 rounded-3xl border shadow-xl transition-all ${
          isDark 
            ? 'bg-[#121620] border-[#222a3c] shadow-black/40' 
            : 'bg-white border-[#e8ebe9] shadow-slate-200/50'
        }`}>
          
          {/* Tabs for Sign In vs Register (Hidden if in forgot password or reset mode) */}
          {authMode !== 'forgot' && authMode !== 'reset_password' && (
            <div className={`flex rounded-full p-1 mb-6 border ${
              isDark ? 'bg-[#0f131a] border-[#1f2637]' : 'bg-[#f0f3f2] border-[#e2e7e5]'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  resetFormState();
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${
                  authMode === 'signin'
                    ? 'bg-[#0f4c3a] text-white shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  resetFormState();
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${
                  authMode === 'signup'
                    ? 'bg-[#0f4c3a] text-white shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Create Account (0000)
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: SIGN IN */}
          {authMode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a] focus:ring-1 focus:ring-[#0f4c3a]' 
                        : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a] focus:ring-1 focus:ring-[#0f4c3a]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleInitiateForgot}
                    className="text-[11px] font-semibold text-[#0f4c3a] dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a] focus:ring-1 focus:ring-[#0f4c3a]' 
                        : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a] focus:ring-1 focus:ring-[#0f4c3a]'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer select-none transition-colors"
                    title="Hold down to view password, release to hide"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-pine py-2.5 text-xs font-bold tracking-wide flex items-center justify-center gap-2 mt-2 shadow-md cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Tracker'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* MODE 2: CREATE FRESH ACCOUNT (START WITH 0000) */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Fresh account guarantee: Starts with <strong>0000</strong> expenses. Your records save exclusively to your profile.</span>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jean Pierre Nkurunziza"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a]' 
                        : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a]' 
                        : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                        isDark 
                          ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a]' 
                          : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a]'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onMouseDown={() => setShowPassword(true)}
                      onMouseUp={() => setShowPassword(false)}
                      onMouseLeave={() => setShowPassword(false)}
                      onTouchStart={() => setShowPassword(true)}
                      onTouchEnd={() => setShowPassword(false)}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer select-none"
                      title="Hold or click to show password"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Confirm
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                        isDark 
                          ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a]' 
                          : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a]'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      onMouseDown={() => setShowConfirmPassword(true)}
                      onMouseUp={() => setShowConfirmPassword(false)}
                      onMouseLeave={() => setShowConfirmPassword(false)}
                      onTouchStart={() => setShowConfirmPassword(true)}
                      onTouchEnd={() => setShowConfirmPassword(false)}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer select-none"
                      title="Hold or click to show password"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-pine py-2.5 text-xs font-bold tracking-wide flex items-center justify-center gap-2 mt-4 shadow-md cursor-pointer"
              >
                <span>{loading ? 'Creating Account...' : 'Create Fresh Account (0000)'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* MODE 3: FIREBASE PASSWORD RESET (email link) */}
          {authMode === 'forgot' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    resetFormState();
                  }}
                  className={`p-1.5 rounded-full border transition-colors ${
                    isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Back to sign in"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="font-bold text-sm">
                    {linkSent ? 'Check Your Email' : 'Reset Your Password'}
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Secure reset link sent by Firebase Authentication
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 text-xs leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-semibold text-xs">
                      Reset link sent to{' '}
                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200 break-all">{maskedEmail || maskEmail(email)}</span>
                    </p>
                    <p className="text-[11px] opacity-90">
                      Open the newest email and tap the reset link within 1 hour, then set your new password.
                    </p>
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Sending another request cancels this link — use the email below only once it arrives.
                    </p>
                    {sentAtLabel && (
                      <p className="text-[10px] opacity-75">
                        Requested at {sentAtLabel}. If you have several reset emails, the newest one is the only one that works.
                      </p>
                    )}
                    <p className="text-[10px] opacity-75">
                      It can take 1–2 minutes. If it is not there, check your spam folder.
                    </p>
                    <p className="text-[10px] opacity-60">
                      It arrives from &ldquo;Student Expense Tracker&rdquo; through Firebase, so the sender address may still end in firebaseapp.com. That is normal.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResendRecoveryCode}
                disabled={loading || resendCooldown > 0}
                className="w-full btn-pine py-2.5 text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {loading
                    ? 'Sending…'
                    : resendCooldown > 0
                      ? `New link available in ${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`
                      : 'Send a New Link (cancels the current one)'}
                </span>
              </button>

              <div className="text-center pt-1">
                <p className={`text-[10px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Check the address above. If it is wrong, go back, correct it, and try again.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    resetFormState();
                  }}
                  className={`text-xs font-medium hover:underline cursor-pointer ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* MODE 4: RESET PASSWORD VIEW (Opened via ?mode=resetPassword&oobCode=...) */}
          {authMode === 'reset_password' && (
            <div className="space-y-4">
              <div className="text-center mb-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base">Set New Password</h3>
                {resetMaskedEmail && (
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Resetting password for <span className="font-semibold text-emerald-600 dark:text-emerald-400">{resetMaskedEmail}</span>
                  </p>
                )}
              </div>

              {loading && resetTokenValid === null && (
                <div className="py-6 text-center text-xs text-gray-400">
                  Verifying reset link...
                </div>
              )}

              {resetTokenValid === false && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetTokenError || 'This reset link has expired or has already been used. Please request a new link.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResetToken(null);
                      setResetTokenValid(null);
                      setResetTokenError(null);
                      setAuthMode('signin');
                      resetFormState();
                    }}
                    className="w-full btn-pine py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>Back to Sign In</span>
                  </button>
                </div>
              )}

              {resetTokenValid === true && (
                <form onSubmit={handleCompleteResetPassword} className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Link verified. Choose a new password below and you will go straight into Student Expense Tracker.</span>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                          isDark 
                            ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a]' 
                            : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a]'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={showResetPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowResetPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer select-none"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showResetConfirmPassword ? 'text' : 'password'}
                        required
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs border outline-none transition-all ${
                          isDark 
                            ? 'bg-[#0e1117] border-[#222a3a] text-white focus:border-[#0f4c3a]' 
                            : 'bg-white border-[#d8dedb] text-gray-900 focus:border-[#0f4c3a]'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={showResetConfirmPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowResetConfirmPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer select-none"
                      >
                        {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-pine py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{loading ? 'Saving New Password...' : 'Save New Password & Sign In'}</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('reset_token');
                        url.searchParams.delete('oobCode');
                        url.searchParams.delete('mode');
                        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
                        setAuthMode('signin');
                        resetFormState();
                      }}
                      className={`text-xs font-medium hover:underline cursor-pointer ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footnote reassurance */}
        <div className={`text-center mt-6 text-[11px] leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <p>
            Accounts and expense records are stored securely in Firebase Authentication, Firestore, and Cloud Storage.
          </p>
        </div>
      </div>
    </div>
  );
};
