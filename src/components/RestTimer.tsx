import { useEffect, useRef } from 'react';
import { adjustRestTimer, stopRestTimer } from '../db/actions';
import type { RestTimerState } from '../db/types';
import { useRestTimer } from '../hooks/data';
import { useNow } from '../hooks/useNow';
import { formatClock } from '../lib/format';
import { playRestDone } from '../lib/sound';

const DONE_DISPLAY_MS = 4000;
/** Only beep if we saw the timer cross zero "live"; not when returning hours later. */
const LATE_BEEP_WINDOW_MS = 3000;

/**
 * Mounted once at the app root. Remaining time is always endsAt − now, so it is
 * correct after iOS suspends the page; the beep uses the in-app Web Audio context.
 */
export function useRestTimerController(): { timer: RestTimerState | null | undefined; remaining: number } {
  const timer = useRestTimer();
  const now = useNow(250, !!timer);
  const firedFor = useRef<number | null>(null);
  const remaining = timer ? timer.endsAt - now : 0;

  useEffect(() => {
    if (!timer || remaining > 0) return;
    if (firedFor.current !== timer.endsAt) {
      firedFor.current = timer.endsAt;
      if (document.visibilityState === 'visible' && -remaining < LATE_BEEP_WINDOW_MS) playRestDone();
    }
    if (-remaining > DONE_DISPLAY_MS) void stopRestTimer();
  }, [timer, remaining]);

  return { timer, remaining };
}

export function RestBar({ timer, remaining }: { timer: RestTimerState; remaining: number }) {
  const done = remaining <= 0;
  const pct = Math.max(0, Math.min(100, (remaining / (timer.durationSeconds * 1000)) * 100));
  return (
    <div className={`rest-bar ${done ? 'rest-bar--done' : ''}`} role="timer" aria-label="Rest timer">
      <div className="rest-bar__progress" style={{ width: `${pct}%` }} />
      {done ? (
        <>
          <span className="rest-bar__time">Rest complete</span>
          <button type="button" className="btn btn--sm" onClick={() => void stopRestTimer()}>Dismiss</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn--sm" onClick={() => void adjustRestTimer(-15)} aria-label="Subtract 15 seconds">−15</button>
          <span className="rest-bar__time" aria-live="off">{formatClock(remaining)}</span>
          <button type="button" className="btn btn--sm" onClick={() => void adjustRestTimer(15)} aria-label="Add 15 seconds">+15</button>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => void stopRestTimer()}>Skip</button>
        </>
      )}
    </div>
  );
}
