import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from '../i18n';

/**
 * 'prompt' mode instead of auto-update: reloading mid-set would be jarring.
 * (Data is safe either way — every edit is already in IndexedDB.)
 */
export function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="toast" role="status">
      <span className="small">{needRefresh ? t('update.available') : t('update.offline')}</span>
      {needRefresh && <button className="btn btn--primary btn--sm" onClick={() => void updateServiceWorker(true)}>{t('update.update')}</button>}
      <button className="btn btn--sm" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>{t('common.close')}</button>
    </div>
  );
}
