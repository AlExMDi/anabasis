import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addExercisesToWorkout,
  addSet,
  moveWorkoutExercise,
  removeSet,
  removeWorkoutExercise,
  setExerciseRest,
  startRestTimer,
  updateSet,
  updateWorkoutExercise,
} from '../db/actions';
import type { Exercise, SetType, Settings, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { confirmAction } from '../lib/confirm';
import { PR_LABELS, type PersonalRecord } from '../lib/prs';
import { unlockAudio } from '../lib/sound';
import { formatNumber, fromDisplayWeight, toDisplayWeight, weightStep } from '../lib/units';
import { ExercisePicker } from './ExercisePicker';
import { IconCheck, IconDown, IconPlus, IconTrash, IconTrophy, IconUp, IconX } from './Icons';
import { NumberField } from './NumberField';

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600];

export function formatRest(s: number): string {
  if (s === 0) return 'Off';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m === 0 ? `${r}s` : r === 0 ? `${m}min` : `${m}:${String(r).padStart(2, '0')}`;
}

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const TYPE_LABEL: Record<Exclude<SetType, 'normal'>, string> = { warmup: 'W', drop: 'D', failure: 'F' };

interface Props {
  workout: Workout;
  mode: 'active' | 'edit';
  exercises: Map<string, Exercise>;
  settings: Settings;
  /** Sets from the most recent earlier session of each exercise. */
  previous: Map<string, WorkoutSet[]>;
  prs?: PersonalRecord[];
}

export function WorkoutEditor({ workout, mode, exercises, settings, previous, prs = [] }: Props) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="stack">
      {workout.exercises.length === 0 && (
        <div className="card muted" style={{ textAlign: 'center' }}>
          No exercises yet. Add one to start logging sets.
        </div>
      )}
      {workout.exercises.map((we, i) => (
        <ExerciseCard
          key={we.id}
          workout={workout}
          we={we}
          index={i}
          mode={mode}
          exercise={exercises.get(we.exerciseId)}
          settings={settings}
          previous={previous.get(we.exerciseId) ?? []}
          prs={prs.filter((p) => p.exerciseId === we.exerciseId)}
        />
      ))}
      <button type="button" className="btn btn--block btn--lg" onClick={() => setPicking(true)}>
        <IconPlus width={20} height={20} /> Add exercises
      </button>
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            void addExercisesToWorkout(workout.id, ids);
          }}
        />
      )}
    </div>
  );
}

interface CardProps {
  workout: Workout;
  we: WorkoutExercise;
  index: number;
  mode: 'active' | 'edit';
  exercise: Exercise | undefined;
  settings: Settings;
  previous: WorkoutSet[];
  prs: PersonalRecord[];
}

function ExerciseCard({ workout, we, index, mode, exercise, settings, previous, prs }: CardProps) {
  const name = exercise?.name ?? 'Unknown exercise';
  const last = workout.exercises.length - 1;
  const sessionPR = prs.find((p) => p.setId === null);
  let workingIndex = 0;

  return (
    <section className="card ex-card" aria-label={name}>
      <div className="ex-card__head">
        <div className="grow stack-sm">
          <Link to={`/progress/${we.exerciseId}`} className="ex-card__name">{name}</Link>
          <div className="ex-card__tools">
            {mode === 'active' && (
              <label className="row small muted">
                <span aria-hidden>Rest</span>
                <select
                  className="select rest-select"
                  aria-label={`Rest time for ${name}`}
                  value={we.restSeconds}
                  onChange={(e) => {
                    const s = Number(e.target.value);
                    void updateWorkoutExercise(workout.id, we.id, { restSeconds: s });
                    void setExerciseRest(we.exerciseId, s);
                  }}
                >
                  {(REST_OPTIONS.includes(we.restSeconds) ? REST_OPTIONS : [...REST_OPTIONS, we.restSeconds].sort((a, b) => a - b)).map((s) => (
                    <option key={s} value={s}>{formatRest(s)}</option>
                  ))}
                </select>
              </label>
            )}
            {sessionPR && <span className="badge badge--pr"><IconTrophy width={12} height={12} /> Volume PR</span>}
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => void moveWorkoutExercise(workout.id, we.id, -1)}><IconUp /></button>
        <button type="button" className="icon-btn" aria-label={`Move ${name} down`} disabled={index === last} onClick={() => void moveWorkoutExercise(workout.id, we.id, 1)}><IconDown /></button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          aria-label={`Remove ${name}`}
          onClick={() => {
            const logged = we.sets.some((s) => s.completed);
            if (!logged || confirmAction(`Remove ${name} and its sets from this workout?`)) void removeWorkoutExercise(workout.id, we.id);
          }}
        >
          <IconTrash />
        </button>
      </div>

      <div className="stack-sm">
        {we.sets.map((set, si) => {
          if (set.type !== 'warmup') workingIndex += 1;
          return (
            <SetRow
              key={set.id}
              workout={workout}
              we={we}
              set={set}
              label={set.type === 'normal' ? String(workingIndex) : TYPE_LABEL[set.type]}
              exerciseName={name}
              setNumber={si + 1}
              mode={mode}
              settings={settings}
              prev={previous[si]}
              prs={prs.filter((p) => p.setId === set.id)}
            />
          );
        })}
      </div>
      <button type="button" className="btn btn--sm" onClick={() => void addSet(workout.id, we.id)}>
        <IconPlus width={18} height={18} /> Add set
      </button>
    </section>
  );
}

interface SetRowProps {
  workout: Workout;
  we: WorkoutExercise;
  set: WorkoutSet;
  label: string;
  exerciseName: string;
  setNumber: number;
  mode: 'active' | 'edit';
  settings: Settings;
  prev: WorkoutSet | undefined;
  prs: PersonalRecord[];
}

function SetRow({ workout, we, set, label, exerciseName, setNumber, mode, settings, prev, prs }: SetRowProps) {
  const { unit } = settings;
  const [error, setError] = useState<string | null>(null);
  const desc = `${exerciseName} set ${setNumber}`;
  const update = (patch: Partial<WorkoutSet>) => void updateSet(workout.id, we.id, set.id, patch);
  const prevWeight = prev?.weight != null ? toDisplayWeight(prev.weight, unit) : null;
  const prevText = prev ? `${prevWeight !== null ? formatNumber(prevWeight) : '–'} × ${prev.reps ?? '–'}` : '—';

  const toggle = () => {
    if (set.completed) {
      update({ completed: false, completedAt: undefined });
      return;
    }
    // Hevy-style: an empty field takes last session's value when ticking.
    const weight = set.weight ?? prev?.weight ?? null;
    const reps = set.reps ?? prev?.reps ?? null;
    if (reps === null || reps <= 0) {
      setError('Enter reps first');
      return;
    }
    setError(null);
    unlockAudio();
    update({ weight: weight ?? 0, reps, completed: true, completedAt: Date.now() });
    if (mode === 'active') void startRestTimer(workout.id, we.id, we.restSeconds);
  };

  return (
    <div className={`set ${set.completed ? 'set--done' : ''}`} data-testid="set-row">
      <div className="set__type" data-type={set.type}>
        <select aria-label={`Set type for ${desc}`} value={set.type} onChange={(e) => update({ type: e.target.value as SetType })}>
          <option value="normal">{set.type === 'normal' ? label : 'N'}</option>
          <option value="warmup">W</option>
          <option value="drop">D</option>
          <option value="failure">F</option>
        </select>
      </div>
      <div className="set__prev">
        <button
          type="button"
          className="small"
          aria-label={prev ? `Previous: ${prevText}. Tap to copy.` : 'No previous value'}
          disabled={!prev}
          onClick={() => prev && update({ weight: prev.weight, reps: prev.reps })}
        >
          {prevText}
        </button>
        {prs.map((p) => (
          <span key={p.type} className="badge badge--pr" title={PR_LABELS[p.type]}>
            <IconTrophy width={12} height={12} /> PR
          </span>
        ))}
        <select
          className="select set__rpe"
          aria-label={`RPE for ${desc}`}
          value={set.rpe ?? ''}
          onChange={(e) => update({ rpe: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">RPE</option>
          {RPE_OPTIONS.map((r) => <option key={r} value={r}>@{r}</option>)}
        </select>
      </div>
      <div className="set__check">
        <button type="button" className="icon-btn" aria-label={`Delete ${desc}`} onClick={() => void removeSet(workout.id, we.id, set.id)}>
          <IconX width={18} height={18} />
        </button>
        <button type="button" className="check-btn" aria-pressed={set.completed} aria-label={`Complete ${desc}`} onClick={toggle}>
          <IconCheck />
        </button>
      </div>
      <div className="set__inputs">
        <NumberField
          label={`Weight (${unit}) for ${desc}`}
          suffix={unit}
          value={set.weight === null ? null : toDisplayWeight(set.weight, unit)}
          placeholder={prevWeight !== null ? formatNumber(prevWeight).replace(/,/g, '') : '0'}
          step={weightStep(unit)}
          max={unit === 'kg' ? 2000 : 4400}
          onChange={(v) => update({ weight: v === null ? null : fromDisplayWeight(v, unit) })}
        />
        <NumberField
          label={`Reps for ${desc}`}
          suffix="reps"
          integer
          value={set.reps}
          placeholder={prev?.reps != null ? String(prev.reps) : '0'}
          step={1}
          max={1000}
          onChange={(v) => { setError(null); update({ reps: v }); }}
        />
      </div>
      {error && <p className="error-text" role="alert" style={{ gridColumn: '1 / -1' }}>{error}</p>}
    </div>
  );
}

/** Most recent earlier session's sets for each exercise. */
export function previousSetsFor(history: Workout[], exerciseIds: string[], before: number, excludeId?: string): Map<string, WorkoutSet[]> {
  const map = new Map<string, WorkoutSet[]>();
  const wanted = new Set(exerciseIds);
  const sorted = [...history].filter((w) => w.status === 'completed' && w.id !== excludeId && w.startedAt < before).sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    if (wanted.size === 0) break;
    for (const ex of w.exercises) {
      if (wanted.has(ex.exerciseId)) {
        map.set(ex.exerciseId, ex.sets);
        wanted.delete(ex.exerciseId);
      }
    }
  }
  return map;
}
