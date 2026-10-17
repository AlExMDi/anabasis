import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackupReminder } from '../components/BackupReminder';
import { IconChevron, IconDumbbell, IconPlus } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { WeekStrip } from '../components/Stats';
import { EmptyState, Loading } from '../components/States';
import { discardWorkout, startWorkout } from '../db/actions';
import { db } from '../db/db';
import { useActiveWorkout, useCompletedWorkouts, useExerciseMap, useSettings } from '../hooks/data';
import { useI18n } from '../i18n';
import { confirmAction } from '../lib/confirm';
import { dayPart, formatTime } from '../lib/format';

export function HomePage() {
  const { t, exName } = useI18n();
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const routines = useLiveQuery(() => db.routines.orderBy('updatedAt').reverse().toArray(), []);
  const exercises = useExerciseMap();
  const workouts = useCompletedWorkouts();
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const start = async (routineId: string | null) => {
    setError(null);
    try {
      if (active) {
        if (!confirmAction(t('home.confirmReplaceActive'))) return;
        await discardWorkout(active.id);
      }
      await startWorkout(routineId, t(`workoutName.${dayPart(Date.now())}`));
      navigate('/workout');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('home.startError'));
    }
  };

  return (
    <main className="page">
      <PageHeader
        title={t(`home.greeting.${dayPart(now)}`)}
        subtitle={new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      />
      <BackupReminder />
      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {active === undefined ? (
        <Loading />
      ) : active ? (
        <div className="card card--hero stack">
          <div>
            <p className="section-title">{t('tab.workout')}</p>
            <h2>{active.name}</h2>
            <p className="small muted">{t('home.inProgress', { time: formatTime(active.startedAt) })}</p>
          </div>
          <Link to="/workout" className="btn btn--primary btn--lg btn--block">{t('home.resume')}</Link>
        </div>
      ) : (
        <button type="button" className="btn btn--primary btn--xl btn--block" onClick={() => void start(null)}>
          <IconPlus width={24} height={24} /> {t('home.startEmpty')}
        </button>
      )}

      {workouts && settings && <WeekStrip workouts={workouts} unit={settings.unit} />}

      <div className="row row--between">
        <h2 className="section-title">{t('home.routines')}</h2>
        <Link to="/routines/new" className="btn btn--ghost btn--sm"><IconPlus width={18} height={18} /> {t('home.newRoutine')}</Link>
      </div>

      {routines === undefined || exercises === undefined ? (
        <Loading />
      ) : routines.length === 0 ? (
        <EmptyState icon={<IconDumbbell />} title={t('home.noRoutines')}>{t('home.noRoutinesHint')}</EmptyState>
      ) : (
        <ul className="list">
          {routines.map((r) => (
            <li key={r.id} className="card routine-card">
              <Link to={`/routines/${r.id}`} className="routine-card__body">
                <h3>{r.name}</h3>
                <p className="small muted routine-card__ex">
                  {r.exercises.length === 0 ? t('home.noExercisesInRoutine') : r.exercises.map((e) => exName(exercises.get(e.exerciseId))).join(' · ')}
                </p>
              </Link>
              <button type="button" className="btn btn--soft" disabled={r.exercises.length === 0} onClick={() => void start(r.id)}>
                {t('home.startRoutine')} <IconChevron width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
