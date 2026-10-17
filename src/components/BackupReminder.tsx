import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompletedWorkouts, useSettings } from '../hooks/data';
import { useI18n } from '../i18n';
import { isBackupStale } from '../lib/storage';
import { IconX } from './Icons';

/** Gentle nudge to export when the last backup is older than two weeks. */
export function BackupReminder() {
  const { t } = useI18n();
  const settings = useSettings();
  const workouts = useCompletedWorkouts();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('backup-reminder-dismissed') === '1'; } catch { return false; }
  });
  if (!settings || !workouts || workouts.length === 0 || dismissed || !isBackupStale(settings.lastBackupAt)) return null;
  return (
    <div className="banner" role="note">
      <span className="grow small">
        {settings.lastBackupAt === null ? t('backup.never') : t('backup.old')} {t('backup.onlyHere')}{' '}
        <Link to="/settings">{t('backup.export')}</Link>
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('backup.dismiss')}
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
