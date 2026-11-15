import { APP_VERSION } from '../version';
import { submitBugReport } from './firestoreSync';

/**
 * Optional email delivery for bug reports.
 *
 * Bug reports are always written to Firestore (`feedback` collection), which the
 * app owner reads in the Firebase Console. If a Web3Forms access key is present
 * at build time, the same report is also emailed straight to the owner so it is
 * noticed immediately. The key is designed to be public (it only lets someone
 * post a message to the owner's inbox); the owner's email is never shipped in
 * the app.
 */
const WEB3FORMS_KEY = ((import.meta.env.VITE_WEB3FORMS_KEY as string | undefined) || '').trim();

export const isEmailDeliveryConfigured = WEB3FORMS_KEY.length > 0;

interface BugReportInput {
  message: string;
  email?: string;
  name?: string;
}

interface BugReportResult {
  emailed: boolean;
  stored: boolean;
}

async function sendBugReportEmail(userId: string, report: BugReportInput): Promise<boolean> {
  if (!isEmailDeliveryConfigured) return false;

  const timestamp = new Date().toISOString();
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      subject: `Bug report - Student Expense Tracker (v${APP_VERSION})`,
      from_name: report.name?.trim() || 'Student Expense Tracker user',
      email: report.email?.trim() || 'noreply@student-expense-tracker.app',
      message: [
        report.message,
        '',
        '---',
        `Student: ${report.name?.trim() || 'Unknown'} <${report.email?.trim() || 'no email on file'}>`,
        `User ID: ${userId || 'signed out'}`,
        `Page: ${typeof window !== 'undefined' ? window.location.pathname : ''}`,
        `App version: v${APP_VERSION}`,
        `Sent: ${timestamp}`,
      ].join('\n'),
    }),
  });

  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return Boolean(res.ok && data?.success);
}

/**
 * Delivers a bug report to the owner: email when configured, Firestore always.
 * Succeeds if either channel worked, so a missing rules deployment no longer
 * hides a report that already reached the owner's inbox (and vice versa).
 */
export async function sendBugReport(userId: string, report: BugReportInput): Promise<BugReportResult> {
  let emailed = false;
  let stored = false;

  try {
    emailed = await sendBugReportEmail(userId, report);
  } catch (err: any) {
    console.warn('[Bug report email]', err?.code || err?.message || err);
  }

  try {
    await submitBugReport(userId, report);
    stored = true;
  } catch (err: any) {
    console.warn('[Bug report store]', err?.code || err?.message || err);
  }

  return { emailed, stored };
}
