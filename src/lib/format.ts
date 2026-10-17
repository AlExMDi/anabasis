// Module-level locale so these plain helpers follow the app language without
// threading it through every call; I18nProvider keeps it in sync.
let locale = 'en-US';

export function setFormatLocale(l: string): void {
  locale = l;
}

export function getFormatLocale(): string {
  return locale;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Clock style for running timers: 1:05:09 or 4:09. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatMonthYear(year: number, month: number): string {
  const s = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Narrow weekday labels starting on Monday. */
export function weekdayInitials(): string[] {
  const monday = new Date(2024, 0, 1); // a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }),
  );
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function dayPart(ts: number): DayPart {
  const h = new Date(ts).getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
