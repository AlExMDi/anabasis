import { useEffect, useRef, useState } from 'react';
import { BackupReminder } from '../components/BackupReminder';
import { IconKey } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { Loading } from '../components/States';
import { formatRest, REST_OPTIONS } from '../components/WorkoutEditor';
import { deleteAiSecret, saveAiSecret, setAiModel, updateSettings } from '../db/actions';
import { db, resetDatabase } from '../db/db';
import { AI_MODELS, type AiModel, type AiSecret, type Lang, type Unit } from '../db/types';
import { useAiSecret, useSettings } from '../hooks/data';
import { useI18n, type TKey } from '../i18n';
import { testApiKey } from '../lib/identify/claude';
import { IdentifyError } from '../lib/identify/types';
import { exportBackup, parseBackupText, readAllData, restoreBackup, type BackupData } from '../lib/backup';
import { confirmAction } from '../lib/confirm';
import { workoutsToCsv } from '../lib/csv';
import { dateStamp, readFileText, saveFile } from '../lib/files';
import { formatDateTime } from '../lib/format';
import { getPersistState, getStorageEstimate, isBackupStale, requestPersistentStorage, type PersistState } from '../lib/storage';

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

type Message = { kind: 'info' | 'error'; text: string; details?: string[] };

export function SettingsPage() {
  const { t } = useI18n();
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
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : t('settings.genericError') });
    } finally { setBusy(false); }
  };

  const exportJson = () => run(async () => {
    const backup = await exportBackup();
    const res = await saveFile(`anabasis-backup-${dateStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    if (res !== 'cancelled') setMessage({ kind: 'info', text: t('settings.exported', { n: backup.data.workouts.length }) });
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
    if (file.size > MAX_IMPORT_BYTES) { setMessage({ kind: 'error', text: t('settings.tooLarge') }); return; }
    const res = parseBackupText(await readFileText(file));
    if (!res.ok) { setMessage({ kind: 'error', text: t('settings.cantImport'), details: res.errors }); return; }
    setPendingImport({ data: res.data, fileName: file.name });
  };

  const confirmImport = () => run(async () => {
    if (!pendingImport) return;
    await restoreBackup(pendingImport.data);
    setPendingImport(null);
    setMessage({ kind: 'info', text: t('settings.restored') });
  });

  const deleteAll = () => run(async () => {
    if (!confirmAction(t('settings.confirmDelete1'))) return;
    if (!confirmAction(t('settings.confirmDelete2'))) return;
    await resetDatabase();
    setMessage({ kind: 'info', text: t('settings.deleted') });
  });

  return (
    <main className="page">
      <PageHeader title={t('settings.title')} />
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
        <h2 className="section-title">{t('settings.preferences')}</h2>
        <div className="field">
          <span>{t('settings.language')}</span>
          <div className="segmented" role="group" aria-label={t('settings.language')}>
            {([null, 'es', 'en'] as (Lang | null)[]).map((l) => (
              <button key={l ?? 'auto'} type="button" aria-pressed={settings.language === l} onClick={() => void updateSettings({ language: l })}>
                {l === null ? t('settings.language.auto') : l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('settings.unit')}</span>
          <div className="segmented" role="group" aria-label={t('settings.unit')}>
            {(['kg', 'lb'] as Unit[]).map((u) => (
              <button key={u} type="button" aria-pressed={settings.unit === u} onClick={() => void updateSettings({ unit: u })}>{u}</button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>{t('settings.defaultRest')}</span>
          <select className="select" value={settings.defaultRestSeconds} onChange={(e) => void updateSettings({ defaultRestSeconds: Number(e.target.value) })}>
            {REST_OPTIONS.map((s) => <option key={s} value={s}>{formatRest(s, t)}</option>)}
          </select>
        </label>
        <p className="tiny faint">{t('settings.restHint')}</p>
      </section>

      <AiSection />

      <section className="card stack">
        <h2 className="section-title">{t('settings.backup')}</h2>
        <p className="small">
          {t('settings.lastBackup')}{' '}
          <strong>{settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : t('settings.never')}</strong>
          {isBackupStale(settings.lastBackupAt) && <span className="muted">{t('settings.staleHint')}</span>}
        </p>
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => void exportJson()}>{t('settings.exportJson')}</button>
        <button type="button" className="btn btn--block" disabled={busy} onClick={() => fileInput.current?.click()}>{t('settings.restore')}</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={t('settings.backupFile')}
          data-testid="import-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {pendingImport && (
          <div className="banner stack-sm" role="alertdialog" aria-label={t('settings.confirmRestore')} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <p className="small">
              {t('settings.restoreSummary', {
                file: pendingImport.fileName,
                workouts: pendingImport.data.workouts.length,
                routines: pendingImport.data.routines.length,
                custom: pendingImport.data.exercises.filter((e) => e.isCustom).length,
              })}{' '}
              <strong>{t('settings.restoreReplaces')}</strong>
            </p>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => setPendingImport(null)}>{t('common.cancel')}</button>
              <button type="button" className="btn btn--primary grow" disabled={busy} onClick={() => void confirmImport()}>{t('settings.replace')}</button>
            </div>
          </div>
        )}
        <button type="button" className="btn btn--block" disabled={busy} onClick={() => void exportCsv()}>{t('settings.exportCsv')}</button>
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('settings.storage')}</h2>
        <p className="small">
          {t('settings.persistent')}{' '}
          <strong>
            {t(`settings.persist.${persist}`)}
          </strong>
        </p>
        <p className="tiny faint">
          {t('settings.storageHint')}
          {estimate && ` ${t('settings.usage', { mb: (estimate.usage / 1024 / 1024).toFixed(1) })}`}
        </p>
        {persist === 'not-persisted' && (
          <button type="button" className="btn btn--block" onClick={() => void requestPersistentStorage().then(setPersist)}>{t('settings.requestPersist')}</button>
        )}
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('settings.danger')}</h2>
        <button type="button" className="btn btn--danger btn--block" disabled={busy} onClick={() => void deleteAll()}>{t('settings.deleteAll')}</button>
      </section>

      <p className="tiny faint" style={{ textAlign: 'center' }}>
        {t('settings.footer')} {db.name} v{db.verno}
      </p>
    </main>
  );
}

const KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

function errorKey(e: unknown): TKey {
  if (e instanceof IdentifyError && (e.code === 'auth' || e.code === 'rate')) return `describe.err.${e.code}`;
  if (e instanceof IdentifyError && (e.code === 'network' || e.code === 'overloaded')) return 'describe.fallback.network';
  return 'describe.err.other';
}

/** Bring-your-own-key: the key is stored only in this device's IndexedDB and never exported. */
function AiSection() {
  const { t } = useI18n();
  const secret = useAiSecret();
  const [key, setKey] = useState('');
  const [model, setModel] = useState<AiModel>('claude-opus-5-5');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string } | null>(null);

  useEffect(() => { if (secret) setModel(secret.model); }, [secret]);
  if (secret === undefined) return null;

  const test = async (apiKey: string, m: AiModel) => {
    setStatus({ kind: 'busy', text: t('ai.testing') });
    try {
      await testApiKey(apiKey, m);
      setStatus({ kind: 'ok', text: t('ai.testOk') });
    } catch (e) {
      setStatus({ kind: 'error', text: t(errorKey(e), { message: e instanceof Error ? e.message : String(e) }) });
    }
  };

  const save = async () => {
    const trimmed = key.trim();
    if (!KEY_PATTERN.test(trimmed)) { setStatus({ kind: 'error', text: t('ai.keyInvalid') }); return; }
    await saveAiSecret(trimmed, model);
    setKey('');
    await test(trimmed, model);
  };

  const remove = async () => {
    if (!confirmAction(t('ai.confirmRemove'))) return;
    await deleteAiSecret();
    setStatus(null);
  };

  return (
    <section className="card stack" aria-label={t('ai.title')}>
      <h2 className="section-title row"><IconKey width={16} height={16} /> {t('ai.title')}</h2>
      <p className="small muted">{t('ai.intro')}</p>
      {secret ? (
        <SavedKey secret={secret} onTest={() => void test(secret.apiKey, secret.model)} onRemove={() => void remove()} busy={status?.kind === 'busy'} />
      ) : (
        <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="field">
            <span>{t('ai.key')}</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={t('ai.keyPlaceholder')}
              value={key}
              onChange={(e) => { setKey(e.target.value); setStatus(null); }}
            />
          </label>
          <button type="submit" className="btn btn--primary btn--block" disabled={key.trim() === '' || status?.kind === 'busy'}>{t('ai.saveKey')}</button>
          <p className="tiny faint">{t('ai.getKey')}</p>
        </form>
      )}
      <label className="field">
        <span>{t('ai.model')}</span>
        <select
          className="select"
          value={model}
          onChange={(e) => {
            const m = e.target.value as AiModel;
            setModel(m);
            if (secret) void setAiModel(m);
          }}
        >
          {AI_MODELS.map((m) => <option key={m} value={m}>{t(`ai.model.${m}`)}</option>)}
        </select>
      </label>
      {status && (
        <p className={`small ${status.kind === 'error' ? 'error-text' : status.kind === 'ok' ? 'ok-text' : 'muted'}`} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      <p className="tiny faint">{t('ai.privacy')}</p>
    </section>
  );
}

function SavedKey({ secret, onTest, onRemove, busy }: { secret: AiSecret; onTest: () => void; onRemove: () => void; busy: boolean }) {
  const { t } = useI18n();
  return (
    <div className="stack-sm">
      <p className="small">{t('ai.keySaved', { last4: secret.apiKey.slice(-4) })}</p>
      <div className="row">
        <button type="button" className="btn grow" disabled={busy} onClick={onTest}>{t('ai.test')}</button>
        <button type="button" className="btn btn--danger grow" onClick={onRemove}>{t('ai.removeKey')}</button>
      </div>
    </div>
  );
}
