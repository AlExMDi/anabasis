import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IconBack } from '../components/Icons';
import { Loading } from '../components/States';
import { TextField } from '../components/TextField';
import { WorkoutEditor, previousSetsFor } from '../components/WorkoutEditor';
import { discardWorkout, finishWorkout, updateWorkoutMeta } from '../db/actions';
import { useActiveWorkout, useCompletedWorkouts, useExerciseMap, useSettings } from '../hooks/data';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { completedSetCount, workoutVolume } from '../lib/calc';
import { confirmAction } from '../lib/confirm';
import { formatClock } from '../lib/format';
import { formatVolume } from '../lib/units';

export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const workout = useActiveWorkout();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const history = useCompletedWorkouts();
  const now = useNow(1000, !!workout);
  const wake = useWakeLock(!!workout);
  const [error, setError] = useState<string | null>(null);
  // Finishing/discarding clears the active workout before we navigate away;
  // without this guard the "no active workout" redirect would win the race.
  const leaving = useRef(false);

  const exerciseIds = workout?.exercises.map((e) => e.exerciseId).join('|') ?? '';
  const previous = useMemo(
    () => (workout && history ? previousSetsFor(history, exerciseIds.split('|'), workout.startedAt, workout.id) : new Map()),
    // Recompute only when the set of exercises changes, not on every keystroke.
    [history, exerciseIds, workout?.startedAt, workout?.id],
  );

  if (workout === undefined || !exercises || !settings || !history) return <main className="page page--no-tabs"><Loading /></main>;
  if (workout === null) return leaving.current ? null : <Navigate to="/" replace />;

  const done = completedSetCount(workout);
  const pending = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);

  const finish = async () => {
    setError(null);
    if (done === 0) { setError('Complete at least one set before finishing.'); return; }
    if (pending > 0 && !confirmAction(`${pending} unfinished set${pending > 1 ? 's' : ''} will be discarded. Finish workout?`)) return;
    leaving.current = true;
    const res = await finishWorkout(workout.id);
    if (!res.ok) { leaving.current = false; setError(res.error ?? 'Could not finish workout.'); return; }
    navigate(`/history/${workout.id}?finished=1`, { replace: true });
  };

  const discard = async () => {
    if (!confirmAction('Discard this workout? Logged sets will be lost.')) return;
    leaving.current = true;
    await discardWorkout(workout.id);
    navigate('/', { replace: true });
  };

  return (
    <main className="page page--no-tabs">
      <header className="page-header">
        <button type="button" className="icon-btn" aria-label="Minimise workout" onClick={() => navigate('/')}><IconBack /></button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <div className="timer" aria-label="Workout duration">{formatClock(now - workout.startedAt)}</div>
          <div className="tiny faint">{wake === 'active' ? 'Screen stays on' : ' '}</div>
        </div>
        <button type="button" className="btn btn--success btn--sm" onClick={() => void finish()}>Finish</button>
      </header>

      <TextField
        className="input input--title"
        aria-label="Workout name"
        value={workout.name}
        maxLength={80}
        onCommit={(v) => void updateWorkoutMeta(workout.id, { name: v })}
      />

      <div className="stats">
        <div className="stat"><div className="stat__label">Exercises</div><div className="stat__value">{workout.exercises.length}</div></div>
        <div className="stat"><div className="stat__label">Volume</div><div className="stat__value">{formatVolume(workoutVolume(workout), settings.unit)}</div></div>
        <div className="stat"><div className="stat__label">Sets</div><div className="stat__value">{done}</div></div>
      </div>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <WorkoutEditor workout={workout} mode="active" exercises={exercises} settings={settings} previous={previous} />

      <button type="button" className="btn btn--danger btn--block" onClick={() => void discard()}>Discard workout</button>
    </main>
  );
}
