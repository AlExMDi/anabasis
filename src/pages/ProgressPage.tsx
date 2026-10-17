import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExerciseAvatar } from '../components/ExercisePicker';
import { IconChart, IconChevron } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { MonthCalendar, MuscleBars, WeekComparison } from '../components/Stats';
import { EmptyState, Loading } from '../components/States';
import { useCompletedWorkouts, useExerciseMap, usePRs, useSettings } from '../hooks/data';
import { useI18n } from '../i18n';
import { formatDate } from '../lib/format';
import { readString, writeString } from '../lib/storage';

// Recharts stays out of the main bundle; the service worker still precaches the chunk.
const WeeklyVolumeChart = lazy(() => import('../components/WeeklyVolumeChart').then((m) => ({ default: m.WeeklyVolumeChart })));

type Tab = 'overview' | 'exercises';
const TAB_KEY = 'anabasis.progressTab';

export function ProgressPage() {
  const { t, tn, exName } = useI18n();
  const workouts = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const prs = usePRs(workouts);
  const [tab, setTabState] = useState<Tab>(() => (readString(TAB_KEY) === 'exercises' ? 'exercises' : 'overview'));
  const setTab = (v: Tab) => { setTabState(v); writeString(TAB_KEY, v); };

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

  if (!workouts || !exercises || !prs || !settings) return <main className="page"><PageHeader title={t('progress.title')} /><Loading /></main>;

  return (
    <main className="page">
      <PageHeader title={t('progress.title')} />
      {rows.length === 0 ? (
        <EmptyState icon={<IconChart />} title={t('progress.empty')} action={<Link to="/" className="btn btn--primary">{t('history.start')}</Link>}>
          {t('progress.emptyHint')}
        </EmptyState>
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label={t('progress.title')}>
            {(['overview', 'exercises'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
                {t(`progress.tab.${k}`)}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="stack fade-in">
              <WeekComparison workouts={workouts} unit={settings.unit} />
              <MonthCalendar workouts={workouts} />
              <MuscleBars workouts={workouts} exercises={exercises} />
              <Suspense fallback={<div className="card"><Loading /></div>}>
                <WeeklyVolumeChart workouts={workouts} unit={settings.unit} />
              </Suspense>
              <section className="stack-sm" aria-label={t('progress.total')}>
                <h2 className="section-title">{t('progress.total')}</h2>
                <div className="stats">
                  <div className="stat"><div className="stat__label">{t('common.workouts')}</div><div className="stat__value">{workouts.length}</div></div>
                  <div className="stat"><div className="stat__label">{t('common.exercises')}</div><div className="stat__value">{rows.length}</div></div>
                  <div className="stat"><div className="stat__label">{t('common.prs')}</div><div className="stat__value">{prs.length}</div></div>
                </div>
              </section>
            </div>
          ) : (
            <ul className="list fade-in">
              {rows.map((r) => {
                const ex = exercises.get(r.exerciseId);
                const name = exName(ex);
                const prCount = prs.filter((p) => p.exerciseId === r.exerciseId).length;
                return (
                  <li key={r.exerciseId}>
                    <Link to={`/progress/${r.exerciseId}`} className="list-item">
                      <ExerciseAvatar name={name} muscle={ex?.primaryMuscle} />
                      <span className="grow">
                        <span className="bold">{name}</span>
                        <br />
                        <span className="small muted">{tn('progress.sessions', r.sessions)} · {t('progress.last', { date: formatDate(r.last) })}</span>
                      </span>
                      {prCount > 0 && <span className="badge badge--pr">{tn('history.prCount', prCount)}</span>}
                      <IconChevron width={20} height={20} className="faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
