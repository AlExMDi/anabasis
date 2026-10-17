import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompletedWorkouts, useSettings } from '../hooks/data';
import { isBackupStale } from '../lib/storage';
import { IconX } from './Icons';

/** Gentle nudge to export when the last backup is older than two weeks. */
export function BackupReminder() {
  const settings = useSettings();
  const workouts = useCompletedWorkouts();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('backup-reminder-dismissed') === '1'; } catch { return false; }
  });
  if (!settings || !workouts || workouts.length === 0 || dismissed || !isBackupStale(settings.lastBackupAt)) return null;
  return (
    <div className="banner" role="note">
      <span className="grow small">
        {settings.lastBackupAt === null ? 'You haven’t backed up yet.' : 'Your last backup is over 2 weeks old.'}{' '}
        Your data only lives on this device. <Link to="/settings">Export a backup</Link>
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss backup reminder"
        onClick={() => {
          setDismissed(true);
          try { sessionStorage.setItem('backup-reminder-dismissed', '1'); } catch { /* ignore */ }
        }}
      >
        <IconX />
      </button>
    </div>
  );
}
