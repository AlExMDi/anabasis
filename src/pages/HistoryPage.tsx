import { Link } from 'react-router-dom';
import { BackupReminder } from '../components/BackupReminder';
import { IconHistory, IconTrophy } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, Loading } from '../components/States';
import type { Exercise, Unit, Workout } from '../db/types';
import { useCompletedWorkouts, useExerciseMap, usePRs, useSettings } from '../hooks/data';
import { completedSetCount, workoutDuration, workoutVolume } from '../lib/calc';
import { formatDate, formatDuration } from '../lib/format';
import { prsByWorkout, type PersonalRecord } from '../lib/prs';
import { formatVolume } from '../lib/units';

export function HistoryPage() {
  const workouts = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const prs = usePRs(workouts);

  return (
    <main className="page">
      <PageHeader title="History" />
      <BackupReminder />
      {!workouts || !exercises || !settings || !prs ? (
        <Loading />
      ) : workouts.length === 0 ? (
        <EmptyState icon={<IconHistory />} title="No workouts yet" action={<Link to="/" className="btn btn--primary">Start a workout</Link>}>
          Finished workouts will show up here.
        </EmptyState>
      ) : (
        <WorkoutList workouts={workouts} exercises={exercises} unit={settings.unit} prMap={prsByWorkout(prs)} />
      )}
    </main>
  );
}

function WorkoutList({ workouts, exercises, unit, prMap }: {
  workouts: Workout[];
  exercises: Map<string, Exercise>;
  unit: Unit;
  prMap: Map<string, PersonalRecord[]>;
}) {
  return (
    <ul className="list">
      {workouts.map((w) => {
        const prCount = prMap.get(w.id)?.length ?? 0;
        return (
          <li key={w.id}>
            <Link to={`/history/${w.id}`} className="card stack-sm" style={{ display: 'flex', color: 'inherit' }}>
              <div className="row row--between">
                <h3 className="grow">{w.name || 'Workout'}</h3>
                {prCount > 0 && <span className="badge badge--pr"><IconTrophy width={12} height={12} /> {prCount} PR{prCount > 1 ? 's' : ''}</span>}
              </div>
              <p className="small muted">{formatDate(w.startedAt)}</p>
              <div className="stats">
                <div className="stat"><div className="stat__label">Time</div><div className="stat__value">{formatDuration(workoutDuration(w))}</div></div>
                <div className="stat"><div className="stat__label">Volume</div><div className="stat__value">{formatVolume(workoutVolume(w), unit)}</div></div>
                <div className="stat"><div className="stat__label">Sets</div><div className="stat__value">{completedSetCount(w)}</div></div>
              </div>
              <p className="small faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.exercises.map((e) => `${e.sets.length} × ${exercises.get(e.exerciseId)?.name ?? '?'}`).join(' · ')}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
