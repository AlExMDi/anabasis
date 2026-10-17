import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconEdit, IconTrophy } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, Loading } from '../components/States';
import { TextField } from '../components/TextField';
import { WorkoutEditor, previousSetsFor } from '../components/WorkoutEditor';
import { deleteWorkout, finishWorkout, updateWorkoutMeta } from '../db/actions';
import type { Exercise, Settings, Workout } from '../db/types';
import { useCompletedWorkouts, useExerciseMap, usePRs, useSettings, useWorkout } from '../hooks/data';
import { completedSetCount, epley1RM, workoutDuration, workoutVolume } from '../lib/calc';
import { confirmAction } from '../lib/confirm';
import { formatDateTime, formatDuration } from '../lib/format';
import { PR_LABELS, type PersonalRecord } from '../lib/prs';
import { formatNumber, formatVolume, formatWeight, toDisplayWeight } from '../lib/units';

export function HistoryDetailPage() {
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

  if (workout === undefined || !exercises || !settings || !allPRs) return <main className="page page--no-tabs"><Loading /></main>;
  if (workout === null || workout.status !== 'completed') {
    return (
      <main className="page page--no-tabs">
        <PageHeader title="Workout" back="/history" />
        <ErrorState title="Workout not found" message="It may have been deleted." action={<Link className="btn" to="/history">Back to history</Link>} />
      </main>
    );
  }

  const prs = allPRs.filter((p) => p.workoutId === workout.id);

  const doneEditing = async () => {
    setError(null);
    const pending = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
    if (pending > 0 && !confirmAction(`${pending} unticked set${pending > 1 ? 's' : ''} will be removed. Continue?`)) return;
    const res = await finishWorkout(workout.id, workout.endedAt ?? Date.now());
    if (!res.ok) { setError(`${res.error} You can delete the workout instead.`); return; }
    setEditing(false);
  };

  const remove = async () => {
    if (!confirmAction('Delete this workout permanently?')) return;
    await deleteWorkout(workout.id);
    navigate('/history', { replace: true });
  };

  return (
    <main className="page page--no-tabs">
      <PageHeader
        title={editing ? 'Edit workout' : workout.name || 'Workout'}
        back={editing ? undefined : '/history'}
        actions={
          editing ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void doneEditing()}>Done</button>
          ) : (
            <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}><IconEdit width={18} height={18} /> Edit</button>
          )
        }
      />

      {params.get('finished') && !editing && (
        <div className="banner banner--info" role="status">
          Workout saved{prs.length > 0 ? ` — ${prs.length} new personal record${prs.length > 1 ? 's' : ''}!` : '.'}
        </div>
      )}
      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {editing ? (
        <>
          <label className="field">
            <span>Name</span>
            <TextField className="input" value={workout.name} maxLength={80} onCommit={(v) => void updateWorkoutMeta(workout.id, { name: v })} />
          </label>
          <TimingFields workout={workout} />
          <WorkoutEditor workout={workout} mode="edit" exercises={exercises} settings={settings} previous={previous} prs={prs} />
          <button type="button" className="btn btn--danger btn--block" onClick={() => void remove()}>Delete workout</button>
        </>
      ) : (
        <WorkoutSummary workout={workout} exercises={exercises} settings={settings} prs={prs} />
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
  const minutes = Math.round(workoutDuration(workout) / 60000);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <label className="field grow">
        <span>Started</span>
        <input
          className="input"
          type="datetime-local"
          value={toLocalInput(workout.startedAt)}
          onChange={(e) => {
            const t = new Date(e.target.value).getTime();
            if (Number.isNaN(t)) return;
            void updateWorkoutMeta(workout.id, { startedAt: t, endedAt: t + minutes * 60000 });
          }}
        />
      </label>
      <label className="field" style={{ width: 110 }}>
        <span>Minutes</span>
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={minutes}
          aria-invalid={!!error}
          onChange={(e) => {
            const m = Number(e.target.value);
            if (!Number.isInteger(m) || m < 1 || m > 1440) { setError('1–1440'); return; }
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
  const { unit } = settings;
  return (
    <>
      <p className="muted small">{formatDateTime(workout.startedAt)}</p>
      <div className="stats">
        <div className="stat"><div className="stat__label">Time</div><div className="stat__value">{formatDuration(workoutDuration(workout))}</div></div>
        <div className="stat"><div className="stat__label">Volume</div><div className="stat__value">{formatVolume(workoutVolume(workout), unit)}</div></div>
        <div className="stat"><div className="stat__label">Sets</div><div className="stat__value">{completedSetCount(workout)}</div></div>
      </div>

      {prs.length > 0 && (
        <section className="card stack-sm" aria-label="Personal records">
          <h2 className="row"><IconTrophy width={20} height={20} style={{ color: 'var(--gold)' }} /> Personal records</h2>
          {prs.map((p) => (
            <div key={`${p.exerciseId}-${p.type}`} className="row row--between small">
              <span>{exercises.get(p.exerciseId)?.name ?? '?'} · {PR_LABELS[p.type]}</span>
              <span className="badge badge--pr">{formatPRValue(p, unit)}</span>
            </div>
          ))}
        </section>
      )}

      {workout.exercises.map((we) => {
        let n = 0;
        return (
          <section key={we.id} className="card stack-sm" aria-label={exercises.get(we.exerciseId)?.name}>
            <Link to={`/progress/${we.exerciseId}`} className="ex-card__name">{exercises.get(we.exerciseId)?.name ?? 'Unknown exercise'}</Link>
            {we.sets.map((s) => {
              if (s.type !== 'warmup') n += 1;
              const setPRs = prs.filter((p) => p.setId === s.id);
              const label = s.type === 'normal' ? String(n) : s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : 'F';
              return (
                <div key={s.id} className="row small">
                  <span className="badge" style={{ width: 28, justifyContent: 'center' }}>{label}</span>
                  <span className="grow tabular">
                    {formatWeight(s.weight, unit)} × {s.reps ?? '–'}
                    {s.rpe !== null && <span className="faint"> @{s.rpe}</span>}
                  </span>
                  {setPRs.length > 0 && <span className="badge badge--pr"><IconTrophy width={12} height={12} /> PR</span>}
                  <span className="faint tabular nowrap">
                    {s.weight && s.reps ? `1RM ${formatNumber(toDisplayWeight(epley1RM(s.weight, s.reps), unit), 1)}` : ''}
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
