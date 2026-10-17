import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BackupReminder } from '../components/BackupReminder';
import { IconHistory, IconTrophy } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, Loading } from '../components/States';
import type { Exercise, Unit, Workout } from '../db/types';
import { useCompletedWorkouts, useExerciseMap, usePRs, useSettings } from '../hooks/data';
import { useI18n } from '../i18n';
import { completedSetCount, workoutDuration, workoutVolume } from '../lib/calc';
import { formatDate, formatDuration, formatMonthYear } from '../lib/format';
import { prsByWorkout, type PersonalRecord } from '../lib/prs';
import { formatVolume } from '../lib/units';

export function HistoryPage() {
  const { t } = useI18n();
  const workouts = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const prs = usePRs(workouts);

  return (
    <main className="page">
      <PageHeader title={t('history.title')} />
      <BackupReminder />
      {!workouts || !exercises || !settings || !prs ? (
        <Loading />
      ) : workouts.length === 0 ? (
        <EmptyState icon={<IconHistory />} title={t('history.empty')} action={<Link to="/" className="btn btn--primary">{t('history.start')}</Link>}>
          {t('history.emptyHint')}
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
  const { t, tn, exName } = useI18n();
  // Group by month (workouts arrive newest first).
  const groups = useMemo(() => {
    const out: { key: string; y: number; m: number; items: Workout[] }[] = [];
    for (const w of workouts) {
      const d = new Date(w.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(w);
      else out.push({ key, y: d.getFullYear(), m: d.getMonth(), items: [w] });
    }
    return out;
  }, [workouts]);

  return (
    <div className="stack">
      {groups.map((g) => (
        <section key={g.key} className="stack-sm" aria-label={formatMonthYear(g.y, g.m)}>
          <div className="row row--between month-head">
            <h2 className="section-title">{formatMonthYear(g.y, g.m)}</h2>
            <span className="tiny faint">{tn('history.monthSummary', g.items.length)}</span>
          </div>
          <ul className="list">
            {g.items.map((w) => {
              const prCount = prMap.get(w.id)?.length ?? 0;
              return (
                <li key={w.id}>
                  <Link to={`/history/${w.id}`} className="card stack-sm workout-card">
                    <div className="row row--between">
                      <h3 className="grow">{w.name || t('workoutName.fallback')}</h3>
                      {prCount > 0 && <span className="badge badge--pr"><IconTrophy width={12} height={12} /> {tn('history.prCount', prCount)}</span>}
                    </div>
                    <p className="small muted">{formatDate(w.startedAt)}</p>
                    <div className="stats">
                      <div className="stat"><div className="stat__label">{t('common.time')}</div><div className="stat__value">{formatDuration(workoutDuration(w))}</div></div>
                      <div className="stat"><div className="stat__label">{t('common.volume')}</div><div className="stat__value">{formatVolume(workoutVolume(w), unit)}</div></div>
                      <div className="stat"><div className="stat__label">{t('common.sets')}</div><div className="stat__value">{completedSetCount(w)}</div></div>
                    </div>
                    <p className="small faint ellipsis">
                      {w.exercises.map((e) => `${e.sets.length} × ${exName(exercises.get(e.exerciseId))}`).join(' · ')}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
