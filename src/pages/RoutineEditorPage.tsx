import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExercisePicker } from '../components/ExercisePicker';
import { IconDown, IconPlus, IconTrash, IconUp, IconX } from '../components/Icons';
import { NumberField } from '../components/NumberField';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, Loading } from '../components/States';
import { deleteRoutine, newRoutineExercise, saveRoutine } from '../db/actions';
import { db } from '../db/db';
import type { Routine, RoutineExercise, RoutineSet, SetType } from '../db/types';
import { useExerciseMap, useSettings } from '../hooks/data';
import { useI18n } from '../i18n';
import { confirmAction } from '../lib/confirm';
import { uid } from '../lib/id';
import { fromDisplayWeight, toDisplayWeight, weightStep } from '../lib/units';

type Draft = Omit<Routine, 'createdAt' | 'updatedAt'> & { createdAt?: number };

export function RoutineEditorPage() {
  const { t, exName } = useI18n();
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const existing = useLiveQuery(async () => (id ? ((await db.routines.get(id)) ?? null) : null), [id]);
  const exercises = useExerciseMap();
  const settings = useSettings();
  const [draft, setDraft] = useState<Draft | null>(isNew ? { id: uid(), name: '', notes: '', exercises: [] } : null);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load once; afterwards the draft is local until the user saves.
  useEffect(() => {
    if (!isNew && existing && draft === null) setDraft(structuredClone(existing));
  }, [existing, isNew, draft]);

  if (!exercises || !settings || (!isNew && existing === undefined)) return <main className="page page--no-tabs"><Loading /></main>;
  if (!isNew && existing === null) {
    return (
      <main className="page page--no-tabs">
        <PageHeader title={t('routine.edit')} back="/" />
        <ErrorState title={t('routine.notFound')} action={<Link className="btn" to="/">{t('common.back')}</Link>} />
      </main>
    );
  }
  if (!draft) return <main className="page page--no-tabs"><Loading /></main>;

  const { unit } = settings;
  const setExercises = (fn: (list: RoutineExercise[]) => RoutineExercise[]) => setDraft((d) => (d ? { ...d, exercises: fn(d.exercises) } : d));
  const patchExercise = (reId: string, fn: (re: RoutineExercise) => RoutineExercise) => setExercises((l) => l.map((re) => (re.id === reId ? fn(re) : re)));
  const patchSet = (reId: string, setId: string, patch: Partial<RoutineSet>) =>
    patchExercise(reId, (re) => ({ ...re, sets: re.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
  const move = (index: number, delta: -1 | 1) =>
    setExercises((l) => {
      const next = [...l];
      const j = index + delta;
      if (j < 0 || j >= next.length) return l;
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });

  const save = async () => {
    const errs: string[] = [];
    if (draft.name.trim() === '') errs.push(t('routine.err.name'));
    if (draft.name.trim().length > 80) errs.push(t('routine.err.nameLong'));
    if (draft.exercises.length === 0) errs.push(t('routine.err.exercises'));
    if (draft.exercises.some((e) => e.sets.length === 0)) errs.push(t('routine.err.sets'));
    setErrors(errs);
    if (errs.length > 0) return;
    await saveRoutine(draft);
    navigate('/', { replace: true });
  };

  return (
    <main className="page page--no-tabs">
      <PageHeader
        title={isNew ? t('routine.new') : t('routine.edit')}
        back="/"
        actions={<button type="button" className="btn btn--primary btn--sm" onClick={() => void save()}>{t('common.save')}</button>}
      />
      {errors.length > 0 && (
        <div className="banner banner--error" role="alert">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <label className="field">
        <span>{t('routine.name')}</span>
        <input className="input" value={draft.name} maxLength={80} placeholder={t('routine.namePlaceholder')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('routine.notes')}</span>
        <textarea className="textarea" value={draft.notes} maxLength={1000} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </label>

      {draft.exercises.map((re, i) => {
        const name = exName(exercises.get(re.exerciseId));
        return (
          <section key={re.id} className="card ex-card" aria-label={name}>
            <div className="ex-card__head">
              <span className="grow ex-card__name">{name}</span>
              <button type="button" className="icon-btn" aria-label={t('editor.moveUp', { name })} disabled={i === 0} onClick={() => move(i, -1)}><IconUp /></button>
              <button type="button" className="icon-btn" aria-label={t('editor.moveDown', { name })} disabled={i === draft.exercises.length - 1} onClick={() => move(i, 1)}><IconDown /></button>
              <button type="button" className="icon-btn icon-btn--danger" aria-label={t('editor.remove', { name })} onClick={() => setExercises((l) => l.filter((x) => x.id !== re.id))}><IconTrash /></button>
            </div>
            {re.sets.map((s, si) => (
              <div key={s.id} className="routine-set">
                <select
                  className="select"
                  aria-label={t('editor.setType', { set: t('editor.setLabel', { name, n: si + 1 }) })}
                  value={s.type}
                  onChange={(e) => patchSet(re.id, s.id, { type: e.target.value as SetType })}
                >
                  <option value="normal">{si + 1}</option>
                  <option value="warmup">W</option>
                  <option value="drop">D</option>
                  <option value="failure">F</option>
                </select>
                <NumberField
                  label={t('routine.targetWeight', { unit, set: t('editor.setLabel', { name, n: si + 1 }) })}
                  suffix={unit}
                  value={s.weight === null ? null : toDisplayWeight(s.weight, unit)}
                  placeholder="–"
                  step={weightStep(unit)}
                  max={unit === 'kg' ? 2000 : 4400}
                  onChange={(v) => patchSet(re.id, s.id, { weight: v === null ? null : fromDisplayWeight(v, unit) })}
                />
                <NumberField
                  label={t('routine.targetReps', { set: t('editor.setLabel', { name, n: si + 1 }) })}
                  integer
                  value={s.reps}
                  placeholder="–"
                  step={1}
                  max={1000}
                  onChange={(v) => patchSet(re.id, s.id, { reps: v })}
                />
                <button type="button" className="icon-btn" aria-label={t('editor.deleteSet', { set: t('editor.setLabel', { name, n: si + 1 }) })} onClick={() => patchExercise(re.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}>
                  <IconX width={18} height={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => patchExercise(re.id, (x) => {
                const last = x.sets[x.sets.length - 1];
                return { ...x, sets: [...x.sets, { id: uid(), weight: last?.weight ?? null, reps: last?.reps ?? null, type: 'normal' }] };
              })}
            >
              <IconPlus width={18} height={18} /> {t('editor.addSet')}
            </button>
          </section>
        );
      })}

      <button type="button" className="btn btn--block btn--lg" onClick={() => setPicking(true)}>
        <IconPlus width={20} height={20} /> {t('editor.addExercises')}
      </button>

      {!isNew && (
        <button
          type="button"
          className="btn btn--danger btn--block"
          onClick={async () => {
            if (!confirmAction(t('routine.confirmDelete'))) return;
            await deleteRoutine(draft.id);
            navigate('/', { replace: true });
          }}
        >
          {t('routine.delete')}
        </button>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            setExercises((l) => [...l, ...ids.map(newRoutineExercise)]);
          }}
        />
      )}
    </main>
  );
}
