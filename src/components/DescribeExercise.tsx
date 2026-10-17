import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createExercise, getAiSecret, rememberDescription, validateExerciseName } from '../db/actions';
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from '../db/types';
import { useExerciseMap, useExercises } from '../hooks/data';
import { useI18n, type TKey } from '../i18n';
import { identifyExercise, IdentifyError, type IdentifyResult } from '../lib/identify';
import { ExerciseRow, useSheetBehaviour } from './ExercisePicker';
import { IconSparkle, IconX } from './Icons';

const MIN_CHARS = 8;

/**
 * "I don't know its name": the user describes what they did and we suggest
 * library exercises (Claude when a key is set, keyword search otherwise).
 */
export function DescribePanel({ onPick }: { onPick: (exerciseId: string) => void }) {
  const { t, lang, muscle, equipment } = useI18n();
  const exercises = useExercises();
  const byId = useExerciseMap();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState<IdentifyError | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [draft, setDraft] = useState<{ name: string; muscle: Muscle; equipment: Equipment } | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const identify = async () => {
    if (text.trim().length < MIN_CHARS) { setInputError(t('describe.tooShort')); return; }
    if (!exercises) return;
    setInputError(null);
    setError(null);
    setResult(null);
    setDraft(null);
    setBusy(true);
    try {
      const secret = (await getAiSecret()) ?? null;
      const res = await identifyExercise(text, exercises, secret, lang);
      setResult(res);
      if (res.newExercise) {
        setDraft({
          name: (lang === 'es' ? res.newExercise.nameEs : res.newExercise.nameEn) || res.newExercise.nameEs,
          muscle: res.newExercise.primaryMuscle,
          equipment: res.newExercise.equipment,
        });
      }
    } catch (e) {
      setError(e instanceof IdentifyError ? e : new IdentifyError('other', e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (id: string) => {
    if (remember) await rememberDescription(id, text);
    onPick(id);
  };

  const createAndUse = async () => {
    if (!draft || !result?.newExercise) return;
    const err = await validateExerciseName(draft.name);
    if (err) { setDraftError(t(`exform.err.${err}`)); return; }
    const other = lang === 'es' ? result.newExercise.nameEn : result.newExercise.nameEs;
    const id = await createExercise({
      name: draft.name,
      primaryMuscle: draft.muscle,
      equipment: draft.equipment,
      description: text,
      aliases: other && other !== draft.name ? [other] : [],
    });
    onPick(id);
  };

  return (
    <div className="stack">
      <p className="small muted">{t('describe.intro')}</p>
      <label className="field">
        <span className="sr-only">{t('describe.label')}</span>
        <textarea
          className="textarea textarea--lg"
          value={text}
          maxLength={1000}
          placeholder={t('describe.placeholder')}
          aria-label={t('describe.label')}
          aria-invalid={!!inputError}
          onChange={(e) => { setText(e.target.value); setInputError(null); }}
        />
      </label>
      <p className="tiny faint">{t('describe.dictateHint')}</p>
      {inputError && <p className="error-text" role="alert">{inputError}</p>}
      <button type="button" className="btn btn--primary btn--block btn--lg" disabled={busy || !exercises} onClick={() => void identify()}>
        {busy ? <><span className="spinner spinner--sm" aria-hidden /> {t('describe.thinking')}</> : <><IconSparkle width={20} height={20} /> {t('describe.identify')}</>}
      </button>

      {error && (
        <div className="banner banner--error" role="alert">
          <span className="grow small">
            {t(`describe.err.${error.code === 'network' || error.code === 'overloaded' ? 'other' : error.code}` as TKey, { message: error.message })}
            {error.code === 'auth' && <> <Link to="/settings">{t('describe.goSettings')}</Link></>}
          </span>
        </div>
      )}

      {result && byId && (
        <section className="stack fade-in" aria-live="polite" aria-label={result.source === 'claude' ? t('describe.sourceClaude') : t('describe.sourceLocal')}>
          <div className="row row--wrap">
            <span className={`badge ${result.source === 'claude' ? 'badge--accent' : ''}`}>
              {result.source === 'claude' && <IconSparkle width={12} height={12} />}
              {result.source === 'claude' ? t('describe.sourceClaude') : t('describe.sourceLocal')}
            </span>
          </div>
          {result.fallbackReason && <p className="tiny muted">{t(`describe.fallback.${result.fallbackReason}` as TKey)}</p>}
          {result.question && <div className="banner banner--info small">{t('describe.question', { q: result.question })}</div>}

          {result.matches.length === 0 && !result.newExercise && <p className="small muted">{t('describe.noMatches')}</p>}

          {result.matches.length > 0 && (
            <ul className="list">
              {result.matches.map((m) => {
                const ex = byId.get(m.exerciseId);
                if (!ex) return null;
                return (
                  <li key={m.exerciseId} className="match">
                    <ExerciseRow
                      exercise={ex}
                      onClick={() => void pick(ex.id)}
                      trailing={<span className="btn btn--sm btn--primary" aria-hidden>{t('describe.use')}</span>}
                    />
                    <div className="match__meta">
                      <div className="meter" aria-label={t('describe.confidence', { n: Math.round(m.confidence * 100) })}>
                        <div className="meter__fill" style={{ width: `${Math.round(m.confidence * 100)}%` }} />
                      </div>
                      <span className="tiny muted nowrap">{t('describe.confidence', { n: Math.round(m.confidence * 100) })}</span>
                    </div>
                    {result.source === 'claude' && m.reason && <p className="small muted match__reason">{m.reason}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {draft && (
            <div className="card stack card--accent">
              <div>
                <h3>{t('describe.newTitle')}</h3>
                <p className="small muted">{result.newExercise?.reason || t('describe.newHint')}</p>
              </div>
              <label className="field">
                <span>{t('exform.name')}</span>
                <input className="input" value={draft.name} maxLength={80} aria-invalid={!!draftError} onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setDraftError(null); }} />
              </label>
              {draftError && <p className="error-text" role="alert">{draftError}</p>}
              <div className="row">
                <label className="field grow">
                  <span>{t('exform.muscle')}</span>
                  <select className="select" value={draft.muscle} onChange={(e) => setDraft({ ...draft, muscle: e.target.value as Muscle })}>
                    {MUSCLES.map((m) => <option key={m} value={m}>{muscle(m)}</option>)}
                  </select>
                </label>
                <label className="field grow">
                  <span>{t('exform.equipment')}</span>
                  <select className="select" value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value as Equipment })}>
                    {EQUIPMENT.map((m) => <option key={m} value={m}>{equipment(m)}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn btn--primary btn--block" onClick={() => void createAndUse()}>{t('describe.createUse')}</button>
            </div>
          )}

          {result.matches.length > 0 && (
            <label className="check-row small">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>{t('describe.remember')}</span>
            </label>
          )}
          {!draft && <Link to="/exercises/new" className="small">{t('describe.createEmpty')}</Link>}
        </section>
      )}
    </div>
  );
}

/** Standalone sheet (used from the exercise library). */
export function DescribeSheet({ onClose, onPick }: { onClose: () => void; onPick: (exerciseId: string) => void }) {
  const { t } = useI18n();
  useSheetBehaviour(onClose);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('describe.title')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="row row--between">
            <h2>{t('describe.title')}</h2>
            <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}><IconX /></button>
          </div>
        </div>
        <div className="sheet__body">
          <DescribePanel onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
