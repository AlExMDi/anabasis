import { useEffect, useRef, useState } from 'react';
import { BackupReminder } from '../components/BackupReminder';
import { PageHeader } from '../components/PageHeader';
import { Loading } from '../components/States';
import { formatRest, REST_OPTIONS } from '../components/WorkoutEditor';
import { updateSettings } from '../db/actions';
import { db, resetDatabase } from '../db/db';
import type { Unit } from '../db/types';
import { useSettings } from '../hooks/data';
import { exportBackup, parseBackupText, readAllData, restoreBackup, type BackupData } from '../lib/backup';
import { confirmAction } from '../lib/confirm';
import { workoutsToCsv } from '../lib/csv';
import { dateStamp, readFileText, saveFile } from '../lib/files';
import { formatDateTime } from '../lib/format';
import { getPersistState, getStorageEstimate, isBackupStale, requestPersistentStorage, type PersistState } from '../lib/storage';

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

type Message = { kind: 'info' | 'error'; text: string; details?: string[] };

export function SettingsPage() {
  const settings = useSettings();
  const [persist, setPersist] = useState<PersistState | 'checking'>('checking');
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pendingImport, setPendingImport] = useState<{ data: BackupData; fileName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getPersistState().then(setPersist);
    void getStorageEstimate().then(setEstimate);
  }, []);

  if (!settings) return <main className="page"><Loading /></main>;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try { await fn(); } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally { setBusy(false); }
  };

  const exportJson = () => run(async () => {
    const backup = await exportBackup();
    const res = await saveFile(`anabasis-backup-${dateStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    if (res !== 'cancelled') setMessage({ kind: 'info', text: `Backup created with ${backup.data.workouts.length} workouts.` });
  });

  const exportCsv = () => run(async () => {
    const data = await readAllData();
    await saveFile(`anabasis-workouts-${dateStamp()}.csv`, workoutsToCsv(data.workouts, data.exercises, settings.unit), 'text/csv');
  });

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setMessage(null);
    setPendingImport(null);
    if (file.size > MAX_IMPORT_BYTES) { setMessage({ kind: 'error', text: 'File is too large to be an Anabasis backup.' }); return; }
    const res = parseBackupText(await readFileText(file));
    if (!res.ok) { setMessage({ kind: 'error', text: 'This backup can’t be imported:', details: res.errors }); return; }
    setPendingImport({ data: res.data, fileName: file.name });
  };

  const confirmImport = () => run(async () => {
    if (!pendingImport) return;
    await restoreBackup(pendingImport.data);
    setPendingImport(null);
    setMessage({ kind: 'info', text: 'Backup restored.' });
  });

  const deleteAll = () => run(async () => {
    if (!confirmAction('Delete ALL workouts, routines, custom exercises and settings from this device? This cannot be undone.')) return;
    if (!confirmAction('Are you sure? Consider exporting a backup first.')) return;
    await resetDatabase();
    setMessage({ kind: 'info', text: 'All data deleted.' });
  });

  return (
    <main className="page">
      <PageHeader title="Settings" />
      <BackupReminder />
      {message && (
        <div className={`banner ${message.kind === 'error' ? 'banner--error' : 'banner--info'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          <div className="grow small">
            {message.text}
            {message.details && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{message.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        </div>
      )}

      <section className="card stack">
        <h2 className="section-title">Preferences</h2>
        <div className="field">
          <span>Weight unit</span>
          <div className="segmented" role="group" aria-label="Weight unit">
            {(['kg', 'lb'] as Unit[]).map((u) => (
              <button key={u} type="button" aria-pressed={settings.unit === u} onClick={() => void updateSettings({ unit: u })}>{u}</button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Default rest timer</span>
          <select className="select" value={settings.defaultRestSeconds} onChange={(e) => void updateSettings({ defaultRestSeconds: Number(e.target.value) })}>
            {REST_OPTIONS.map((s) => <option key={s} value={s}>{formatRest(s)}</option>)}
          </select>
        </label>
        <p className="tiny faint">Changing the rest time on an exercise during a workout remembers it for that exercise.</p>
      </section>

      <section className="card stack">
        <h2 className="section-title">Backup</h2>
        <p className="small">
          Last backup:{' '}
          <strong>{settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : 'never'}</strong>
          {isBackupStale(settings.lastBackupAt) && <span className="muted"> — exporting regularly protects you if Safari clears site data.</span>}
        </p>
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => void exportJson()}>Export backup (JSON)</button>
        <button type="button" className="btn btn--block" disabled={busy} onClick={() => fileInput.current?.click()}>Restore from backup…</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Backup file"
          data-testid="import-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {pendingImport && (
          <div className="banner stack-sm" role="alertdialog" aria-label="Confirm restore" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <p className="small">
              <strong>{pendingImport.fileName}</strong> contains {pendingImport.data.workouts.length} workouts, {pendingImport.data.routines.length} routines and{' '}
              {pendingImport.data.exercises.filter((e) => e.isCustom).length} custom exercises. Restoring <strong>replaces all current data</strong>.
            </p>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => setPendingImport(null)}>Cancel</button>
              <button type="button" className="btn btn--primary grow" disabled={busy} onClick={() => void confirmImport()}>Replace my data</button>
            </div>
          </div>
        )}
        <button type="button" className="btn btn--block" disabled={busy} onClick={() => void exportCsv()}>Export workouts (CSV)</button>
      </section>

      <section className="card stack">
        <h2 className="section-title">Storage</h2>
        <p className="small">
          Persistent storage:{' '}
          <strong>
            {persist === 'checking' ? 'checking…' : persist === 'persisted' ? 'granted' : persist === 'not-persisted' ? 'not granted' : 'not supported'}
          </strong>
        </p>
        <p className="tiny faint">
          Data lives in this browser’s IndexedDB on this device only. With persistence granted the browser won’t evict it under storage pressure.
          On iPhone, adding the app to the Home Screen makes storage much more durable.
          {estimate && ` Using ${(estimate.usage / 1024 / 1024).toFixed(1)} MB.`}
        </p>
        {persist === 'not-persisted' && (
          <button type="button" className="btn btn--block" onClick={() => void requestPersistentStorage().then(setPersist)}>Request persistent storage</button>
        )}
      </section>

      <section className="card stack">
        <h2 className="section-title">Danger zone</h2>
        <button type="button" className="btn btn--danger btn--block" disabled={busy} onClick={() => void deleteAll()}>Delete all data</button>
      </section>

      <p className="tiny faint" style={{ textAlign: 'center' }}>
        Anabasis · no accounts, no tracking. {db.name} v{db.verno}
      </p>
    </main>
  );
}
