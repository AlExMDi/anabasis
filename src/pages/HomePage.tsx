import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackupReminder } from '../components/BackupReminder';
import { IconChevron, IconDumbbell, IconPlus } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, Loading } from '../components/States';
import { discardWorkout, startWorkout } from '../db/actions';
import { db } from '../db/db';
import { useActiveWorkout, useExerciseMap } from '../hooks/data';
import { confirmAction } from '../lib/confirm';

export function HomePage() {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const routines = useLiveQuery(() => db.routines.orderBy('updatedAt').reverse().toArray(), []);
  const exercises = useExerciseMap();
  const [error, setError] = useState<string | null>(null);

  const start = async (routineId: string | null) => {
    setError(null);
    try {
      if (active) {
        if (!confirmAction('A workout is already in progress. Discard it and start a new one?')) return;
        await discardWorkout(active.id);
      }
      await startWorkout(routineId);
      navigate('/workout');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start workout.');
    }
  };

  return (
    <main className="page">
      <PageHeader title="Workout" />
      <BackupReminder />
      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {active === undefined ? (
        <Loading />
      ) : active ? (
        <div className="card card--accent stack">
          <div>
            <h2>{active.name}</h2>
            <p className="small muted">In progress · started {new Date(active.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <Link to="/workout" className="btn btn--primary btn--lg btn--block">Resume workout</Link>
        </div>
      ) : (
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => void start(null)}>
          <IconPlus width={22} height={22} /> Start empty workout
        </button>
      )}

      <div className="row row--between">
        <h2 className="section-title">Routines</h2>
        <Link to="/routines/new" className="btn btn--ghost btn--sm"><IconPlus width={18} height={18} /> New routine</Link>
      </div>

      {routines === undefined || exercises === undefined ? (
        <Loading />
      ) : routines.length === 0 ? (
        <EmptyState icon={<IconDumbbell />} title="No routines yet">
          Save your regular sessions as routines to start them in one tap.
        </EmptyState>
      ) : (
        <ul className="list">
          {routines.map((r) => (
            <li key={r.id} className="card stack">
              <Link to={`/routines/${r.id}`} className="row" style={{ color: 'inherit' }}>
                <div className="grow">
                  <h3>{r.name}</h3>
                  <p className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.exercises.length === 0 ? 'No exercises' : r.exercises.map((e) => exercises.get(e.exerciseId)?.name ?? '?').join(', ')}
                  </p>
                </div>
                <IconChevron width={20} height={20} className="faint" />
              </Link>
              <button type="button" className="btn btn--block" disabled={r.exercises.length === 0} onClick={() => void start(r.id)}>
                Start routine
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
