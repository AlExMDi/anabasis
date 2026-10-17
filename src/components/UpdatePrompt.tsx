import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * 'prompt' mode instead of auto-update: reloading mid-set would be jarring.
 * (Data is safe either way — every edit is already in IndexedDB.)
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="toast" role="status">
      <span className="small">{needRefresh ? 'A new version is available.' : 'Ready to work offline.'}</span>
      {needRefresh && <button className="btn btn--primary btn--sm" onClick={() => void updateServiceWorker(true)}>Update</button>}
      <button className="btn btn--sm" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>Close</button>
    </div>
  );
}
