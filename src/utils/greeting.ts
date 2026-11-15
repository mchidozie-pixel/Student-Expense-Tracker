/**
 * Chooses a greeting from the student's local clock.
 *
 *   05:00 - 11:59  Good morning
 *   12:00 - 16:59  Good afternoon
 *   17:00 - 20:59  Good evening
 *   21:00 - 04:59  Still up   (shown as "Still up, Name?")
 *
 * Kept in one place so the dashboard and any future screen greet the
 * student the same way, and so the wording is easy to change for the demo.
 */
export function getTimeGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Still up';
}

/** Full greeting line, e.g. "Good evening, Mira" or "Still up, Mira?". */
export function formatGreeting(firstName: string, date: Date = new Date()): string {
  const greeting = getTimeGreeting(date);
  const name = (firstName || 'Scholar').trim() || 'Scholar';
  return greeting === 'Still up' ? `Still up, ${name}?` : `${greeting}, ${name}`;
}
