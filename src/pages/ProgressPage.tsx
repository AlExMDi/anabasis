import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExerciseAvatar } from '../components/ExercisePicker';
import { IconChart, IconChevron } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, Loading } from '../components/States';
import { useCompletedWorkouts, useExerciseMap, usePRs } from '../hooks/data';
import { formatDate } from '../lib/format';

export function ProgressPage() {
  const workouts = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const prs = usePRs(workouts);

  const rows = useMemo(() => {
    if (!workouts) return [];
    const map = new Map<string, { exerciseId: string; sessions: number; last: number }>();
    for (const w of workouts) {
      for (const id of new Set(w.exercises.map((e) => e.exerciseId))) {
        const r = map.get(id) ?? { exerciseId: id, sessions: 0, last: 0 };
        r.sessions += 1;
        r.last = Math.max(r.last, w.startedAt);
        map.set(id, r);
      }
    }
    return [...map.values()].sort((a, b) => b.last - a.last);
  }, [workouts]);

  return (
    <main className="page">
      <PageHeader title="Progress" />
      {!workouts || !exercises || !prs ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={<IconChart />} title="No progress yet" action={<Link to="/" className="btn btn--primary">Start a workout</Link>}>
          Log a few workouts to see charts and personal records per exercise.
        </EmptyState>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><div className="stat__label">Workouts</div><div className="stat__value">{workouts.length}</div></div>
            <div className="stat"><div className="stat__label">Exercises</div><div className="stat__value">{rows.length}</div></div>
            <div className="stat"><div className="stat__label">PRs</div><div className="stat__value">{prs.length}</div></div>
          </div>
          <ul className="list">
            {rows.map((r) => {
              const ex = exercises.get(r.exerciseId);
              const prCount = prs.filter((p) => p.exerciseId === r.exerciseId).length;
              return (
                <li key={r.exerciseId}>
                  <Link to={`/progress/${r.exerciseId}`} className="list-item">
                    <ExerciseAvatar name={ex?.name ?? '?'} />
                    <span className="grow">
                      <span className="bold">{ex?.name ?? 'Unknown exercise'}</span>
                      <br />
                      <span className="small muted">{r.sessions} session{r.sessions > 1 ? 's' : ''} · last {formatDate(r.last)}</span>
                    </span>
                    {prCount > 0 && <span className="badge badge--pr">{prCount} PR</span>}
                    <IconChevron width={20} height={20} className="faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
