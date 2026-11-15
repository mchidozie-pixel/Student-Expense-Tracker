export const APP_VERSION = '1.9.1';

export const VERSION_RELEASE_NOTES: Record<string, string[]> = {
  '1.9.1': [
    'The Record button and form footer now stay above the phone keyboard, so the expense can always be saved',
    'Amounts typed with a comma (2,500) are accepted instead of being rejected',
    'Missing amount or note now shows a clear message instead of nothing happening',
    'A record is only called "saved" once it reaches your account; if the phone is offline it says so and syncs automatically later',
    'Text fields use a phone-friendly size so iOS no longer zooms the page when you start typing'
  ],
  '1.9': [
    'Records are now saved one by one in your account, so adding a record can never remove another one',
    'Edits and deletes stay deleted - a record removed on one device stays removed on every device',
    'Signing in on a second device or tab merges both copies instead of replacing your list',
    'Profile, budget and photo saves no longer rewrite your record list'
  ],
  '1.8': [
    'Profile pictures from a phone are now shrunk automatically and verified in the account, so the new photo replaces the old one for good',
    'Unsupported phone photo formats now show a clear message instead of silently keeping the old picture',
    'Bigger app name, logo and profile picture in the mobile header'
  ],
  '1.7': [
    'Reset screen now explains that only the newest email works and shows when it was requested',
    'Resend is locked for 2 minutes so the app cannot cancel the link already in your inbox'
  ],
  '1.6': [
    'Forgot password now checks the database first - unknown emails are rejected with a clear message',
    'Reset emails are sent only when the account exists, so the newest link always arrives'
  ],
  '1.5': [
    'Password reset restored to the reliable standard Firebase flow',
    'Reset emails now open a working "Reset your password" page'
  ],
  '1.4': [
    'Password reset emails now open straight into the app',
    'Sign-in and sign-out are instant - no waiting screens',
    'Analytics and Settings load on demand for a faster start'
  ],
  '1.3': [
    'New builds now take effect automatically - no update bar on the home screen',
    'Update checking lives only in Settings',
    'Profile photos save to your account even when cloud photo storage is unavailable',
    'Fresh sign-in loading is faster and more reliable'
  ],
  '1.2': [
    'Hardened pre-demo build: private files removed from the public bundle',
    'Dates now use Kigali local time everywhere (no off-by-one-day entries)',
    'MoMo import now rejects incoming-money SMS instead of logging an expense',
    'Budget, profile and expense sync is safer right after sign-in',
    'Profile photos upload to Cloud Storage only - no oversized local copies',
    'Statement printing now prints just the statement, on clean white pages'
  ],
  '1.1': [
    'Accounts and passwords handled securely by Firebase Authentication',
    'Password reset links delivered by Firebase - no SMTP or app password needed',
    'Expenses, budgets and categories synced online through Firebase Firestore',
    'Profile photos stored privately in Firebase Cloud Storage',
    'Offline-ready PWA with in-app update checker for new published versions'
  ]
};

/**
 * Compare two semver-like version strings (e.g., '1.1' vs '1.2')
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = v2.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
