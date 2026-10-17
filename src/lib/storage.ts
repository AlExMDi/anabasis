export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export async function requestPersistentStorage(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

export async function getPersistState(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

export const BACKUP_REMINDER_MS = 14 * 24 * 60 * 60 * 1000;

export function isBackupStale(lastBackupAt: number | null, now = Date.now()): boolean {
  return lastBackupAt === null || now - lastBackupAt > BACKUP_REMINDER_MS;
}

/** localStorage for small UI conveniences; private mode or blocked storage just forgets. */
export function readString(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeString(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
