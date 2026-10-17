import { useEffect, useState } from 'react';

export type WakeLockStatus = 'active' | 'unsupported' | 'released';

/**
 * Keeps the screen on while `enabled`. iOS Safari supports this from 16.4 (and in
 * home-screen apps from 18.4); elsewhere it silently degrades. The lock is dropped
 * by the browser whenever the page is hidden, so it is re-acquired on return.
 */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'released' : 'unsupported');

  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) { void sentinel.release(); return; }
        setStatus('active');
        sentinel.addEventListener('release', () => { if (!cancelled) setStatus('released'); });
      } catch {
        setStatus('released');
      }
    };
    const onVisible = () => { void acquire(); };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled, supported]);

  return status;
}
