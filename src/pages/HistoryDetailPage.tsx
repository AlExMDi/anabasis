import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconCheck, IconEdit, IconTrophy } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, Loading } from '../components/States';
import { TextField } from '../components/TextField';
import { WorkoutEditor, previousSetsFor } from '../components/WorkoutEditor';
import { deleteWorkout, finishWorkout, updateWorkoutMeta } from '../db/actions';
import type { Exercise, Settings, Workout } from '../db/types';
import { useCompletedWorkouts, useExerciseMap, usePRs, useSettings, useWorkout } from '../hooks/data';
import { useI18n } from '../i18n';
import { completedSetCount, epley1RM, workoutDuration, workoutVolume } from '../lib/calc';
import { confirmAction } from '../lib/confirm';
import { formatDateTime, formatDuration } from '../lib/format';
import { type PersonalRecord } from '../lib/prs';
import { formatNumber, formatVolume, formatWeight, toDisplayWeight } from '../lib/units';

export function HistoryDetailPage() {
  const { t, tn } = useI18n();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const exercises = useExerciseMap();
  const settings = useSettings();
  const history = useCompletedWorkouts();
  const allPRs = usePRs(history);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previous = useMemo(
    () => (workout && history ? previousSetsFor(history, workout.exercises.map((e) => e.exerciseId), workout.startedAt, workout.id) : new Map()),
    [workout, history],
  );

  if (workout === undefined || !exercises || !settings || !allPRs || !history) return <main className="page page--no-tabs"><Loading /></main>;
  if (workout === null || workout.status !== 'completed') {
    return (
      <main className="page page--no-tabs">
        <PageHeader title={t('detail.title')} back="/history" />
        <ErrorState title={t('detail.notFound')} message={t('detail.notFoundHint')} action={<Link className="btn" to="/history">{t('detail.backToHistory')}</Link>} />
      </main>
    );
  }

  const prs = allPRs.filter((p) => p.workoutId === workout.id);
  const finished = !!params.get('finished') && !editing;
  // History is newest first; this workout's position from the oldest is its number.
  const number = history.length - history.findIndex((w) => w.id === workout.id);

  const doneEditing = async () => {
    setError(null);
    const pending = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
    if (pending > 0 && !confirmAction(tn('detail.pendingSets', pending))) return;
    const res = await finishWorkout(workout.id, workout.endedAt ?? Date.now());
    if (!res.ok) { setError(t('detail.cannotSave', { error: t('active.needOneSet') })); return; }
    setEditing(false);
  };

  const remove = async () => {
    if (!confirmAction(t('detail.confirmDelete'))) return;
    await deleteWorkout(workout.id);
    navigate('/history', { replace: true });
  };

  return (
    <main className="page page--no-tabs">
      <PageHeader
        title={editing ? t('detail.edit') : finished ? '' : workout.name || t('workoutName.fallback')}
        back={editing ? undefined : finished ? '/' : '/history'}
        actions={
          editing ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void doneEditing()}>{t('common.done')}</button>
          ) : (
            <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}><IconEdit width={18} height={18} /> {t('common.edit')}</button>
          )
        }
      />

      {finished && (
        <section className="finish-hero" role="status">
          <div className="finish-hero__check"><IconCheck /></div>
          <h1>{t('detail.finishedTitle')}</h1>
          <p className="muted">{workout.name} · {t('detail.finishedNumber', { n: number })}</p>
          <p className={prs.length > 0 ? 'finish-hero__prs' : 'small muted'}>
            {prs.length > 0 ? <><IconTrophy width={18} height={18} /> {tn('detail.finishedPRs', prs.length)}</> : t('detail.finishedNoPRs')}
          </p>
        </section>
      )}
      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {editing ? (
        <>
          <label className="field">
            <span>{t('detail.name')}</span>
            <TextField className="input" value={workout.name} maxLength={80} onCommit={(v) => void updateWorkoutMeta(workout.id, { name: v })} />
          </label>
          <TimingFields workout={workout} />
          <WorkoutEditor workout={workout} mode="edit" exercises={exercises} settings={settings} previous={previous} prs={prs} />
          <button type="button" className="btn btn--danger btn--block" onClick={() => void remove()}>{t('detail.delete')}</button>
        </>
      ) : (
        <>
          <WorkoutSummary workout={workout} exercises={exercises} settings={settings} prs={prs} />
          {finished && <Link to="/" className="btn btn--primary btn--lg btn--block">{t('common.done')}</Link>}
        </>
      )}
    </main>
  );
}

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(ts - off).toISOString().slice(0, 16);
}

function TimingFields({ workout }: { workout: Workout }) {
  const { t } = useI18n();
  const minutes = Math.round(workoutDuration(workout) / 60000);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <label className="field grow">
        <span>{t('detail.started')}</span>
        <input
          className="input"
          type="datetime-local"
          value={toLocalInput(workout.startedAt)}
          onChange={(e) => {
            const ts = new Date(e.target.value).getTime();
            if (Number.isNaN(ts)) return;
            void updateWorkoutMeta(workout.id, { startedAt: ts, endedAt: ts + minutes * 60000 });
          }}
        />
      </label>
      <label className="field" style={{ width: 110 }}>
        <span>{t('detail.minutes')}</span>
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={minutes}
          aria-invalid={!!error}
          onChange={(e) => {
            const m = Number(e.target.value);
            if (!Number.isInteger(m) || m < 1 || m > 1440) { setError(t('detail.minutesRange')); return; }
            setError(null);
            void updateWorkoutMeta(workout.id, { endedAt: workout.startedAt + m * 60000 });
          }}
        />
        {error && <span className="error-text">{error}</span>}
      </label>
    </div>
  );
}

function WorkoutSummary({ workout, exercises, settings, prs }: { workout: Workout; exercises: Map<string, Exercise>; settings: Settings; prs: PersonalRecord[] }) {
  const { t, exName } = useI18n();
  const { unit } = settings;
  return (
    <>
      <p className="muted small">{formatDateTime(workout.startedAt)}</p>
      <div className="stats stats--4">
        <div className="stat"><div className="stat__label">{t('common.time')}</div><div className="stat__value">{formatDuration(workoutDuration(workout))}</div></div>
        <div className="stat"><div className="stat__label">{t('common.volume')}</div><div className="stat__value">{formatVolume(workoutVolume(workout), unit)}</div></div>
        <div className="stat"><div className="stat__label">{t('common.sets')}</div><div className="stat__value">{completedSetCount(workout)}</div></div>
        <div className="stat"><div className="stat__label">{t('common.prs')}</div><div className="stat__value">{prs.length}</div></div>
      </div>

      {prs.length > 0 && (
        <section className="card card--gold stack-sm" aria-label={t('detail.prs')}>
          <h2 className="row"><IconTrophy width={20} height={20} className="gold" /> {t('detail.prs')}</h2>
          {prs.map((p) => (
            <div key={`${p.exerciseId}-${p.type}`} className="row row--between small">
              <span>{exName(exercises.get(p.exerciseId))} · {t(`pr.${p.type}`)}</span>
              <span className="badge badge--pr">{formatPRValue(p, unit)}</span>
            </div>
          ))}
        </section>
      )}

      {workout.exercises.map((we) => {
        let n = 0;
        const name = exName(exercises.get(we.exerciseId));
        return (
          <section key={we.id} className="card stack-sm" aria-label={name}>
            <Link to={`/progress/${we.exerciseId}`} className="ex-card__name">{name}</Link>
            {we.notes && <p className="small muted note">{we.notes}</p>}
            {we.sets.map((s) => {
              if (s.type !== 'warmup') n += 1;
              const setPRs = prs.filter((p) => p.setId === s.id);
              const label = s.type === 'normal' ? String(n) : s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : 'F';
              return (
                <div key={s.id} className="row small summary-set">
                  <span className="badge summary-set__label" data-type={s.type}>{label}</span>
                  <span className="grow tabular">
                    {formatWeight(s.weight, unit)} × {s.reps ?? '–'}
                    {s.rpe !== null && <span className="faint"> @{s.rpe}</span>}
                  </span>
                  {setPRs.length > 0 && <span className="badge badge--pr"><IconTrophy width={12} height={12} /> PR</span>}
                  <span className="faint tabular nowrap">
                    {s.weight && s.reps ? t('detail.est1rm', { value: formatNumber(toDisplayWeight(epley1RM(s.weight, s.reps), unit), 1) }) : ''}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

export function formatPRValue(p: PersonalRecord, unit: Settings['unit']): string {
  return p.type === 'weight' || p.type === 'e1rm' ? formatWeight(p.value, unit) : formatVolume(p.value, unit);
}
