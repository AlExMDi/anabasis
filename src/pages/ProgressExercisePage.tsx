import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconEdit, IconTrophy } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { useCompletedWorkouts, useExerciseMap, usePRs, useSettings } from '../hooks/data';
import { exerciseHistory } from '../lib/calc';
import { formatDate } from '../lib/format';
import { PR_LABELS, allTimeBests } from '../lib/prs';
import { formatNumber, formatVolume, formatWeight, toDisplayWeight } from '../lib/units';
import { formatPRValue } from './HistoryDetailPage';

type Metric = 'bestWeight' | 'best1RM' | 'volume';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'bestWeight', label: 'Best set' },
  { key: 'best1RM', label: 'Est. 1RM' },
  { key: 'volume', label: 'Volume' },
];

export function ProgressExercisePage() {
  const { exerciseId = '' } = useParams();
  const exercises = useExerciseMap();
  const workouts = useCompletedWorkouts();
  const settings = useSettings();
  const prs = usePRs(workouts);
  const [metric, setMetric] = useState<Metric>('best1RM');

  const history = useMemo(() => (workouts ? exerciseHistory(workouts, exerciseId) : []), [workouts, exerciseId]);
  const bests = useMemo(() => (workouts ? allTimeBests(workouts, exerciseId) : null), [workouts, exerciseId]);

  if (!exercises || !workouts || !settings || !prs) return <main className="page page--no-tabs"><Loading /></main>;
  const exercise = exercises.get(exerciseId);
  if (!exercise) {
    return (
      <main className="page page--no-tabs">
        <PageHeader title="Exercise" back={true} />
        <ErrorState title="Exercise not found" action={<Link to="/exercises" className="btn">Exercise library</Link>} />
      </main>
    );
  }

  const { unit } = settings;
  const exPRs = prs.filter((p) => p.exerciseId === exerciseId).reverse();
  const data = history.map((h) => ({
    date: h.date,
    value: Math.round(toDisplayWeight(h[metric], unit) * 10) / 10,
  }));
  const fmtAxisDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <main className="page page--no-tabs">
      <PageHeader
        title={exercise.name}
        back={true}
        actions={exercise.isCustom ? <Link to={`/exercises/${exercise.id}/edit`} className="btn btn--sm"><IconEdit width={18} height={18} /> Edit</Link> : undefined}
      />
      <p className="small muted" style={{ textTransform: 'capitalize' }}>{exercise.primaryMuscle} · {exercise.equipment}{exercise.isCustom ? ' · custom' : ''}</p>

      {history.length === 0 ? (
        <EmptyState icon={<IconTrophy />} title="No history yet">Complete a working set of this exercise to see charts here.</EmptyState>
      ) : (
        <>
          {bests && (
            <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="stat"><div className="stat__label">Heaviest</div><div className="stat__value">{formatWeight(bests.weight, unit)}</div></div>
              <div className="stat"><div className="stat__label">Best est. 1RM</div><div className="stat__value">{formatWeight(Math.round(bests.e1rm * 10) / 10, unit)}</div></div>
              <div className="stat"><div className="stat__label">Best set volume</div><div className="stat__value">{formatVolume(bests.setVolume, unit)}</div></div>
              <div className="stat"><div className="stat__label">Best session</div><div className="stat__value">{formatVolume(bests.sessionVolume, unit)}</div></div>
            </div>
          )}

          <section className="card">
            <div className="segmented chart-tabs" role="group" aria-label="Chart metric">
              {METRICS.map((m) => (
                <button key={m.key} type="button" aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>
              ))}
            </div>
            {data.length < 2 ? (
              <p className="small muted" style={{ padding: '24px 0', textAlign: 'center' }}>Log this exercise in at least two sessions to see a trend.</p>
            ) : (
              <div className="chart" role="img" aria-label={`${METRICS.find((m) => m.key === metric)!.label} over time, in ${unit}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="#2c313c" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtAxisDate} stroke="#2c313c" tickLine={false} minTickGap={24} />
                    <YAxis stroke="#2c313c" tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} tickFormatter={(v: number) => formatNumber(v, 0)} />
                    <Tooltip
                      contentStyle={{ background: '#20242d', border: '1px solid #2c313c', borderRadius: 10, color: '#eef0f4' }}
                      labelStyle={{ color: '#a3aab8' }}
                      cursor={{ stroke: '#6d7584', strokeWidth: 1 }}
                      labelFormatter={(t) => formatDate(Number(t))}
                      formatter={(v) => [`${formatNumber(Number(v), 1)} ${unit}`, METRICS.find((m) => m.key === metric)!.label]}
                    />
                    <Line type="monotone" dataKey="value" stroke="#4f8cff" strokeWidth={2} dot={{ r: 4, fill: '#4f8cff', stroke: '#171a21', strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#171a21', strokeWidth: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {exPRs.length > 0 && (
            <section className="card stack-sm" aria-label="Personal record history">
              <h2 className="row"><IconTrophy width={20} height={20} style={{ color: 'var(--gold)' }} /> PR history</h2>
              {exPRs.slice(0, 20).map((p) => (
                <Link key={`${p.workoutId}-${p.type}`} to={`/history/${p.workoutId}`} className="row row--between small" style={{ color: 'inherit', minHeight: 36 }}>
                  <span><span className="muted">{formatDate(p.date)}</span> · {PR_LABELS[p.type]}</span>
                  <span className="badge badge--pr">{formatPRValue(p, unit)}</span>
                </Link>
              ))}
            </section>
          )}

          <section className="stack-sm" aria-label="Sessions">
            <h2 className="section-title">Sessions</h2>
            {[...history].reverse().map((h) => (
              <Link key={h.workoutId} to={`/history/${h.workoutId}`} className="card card--tight row" style={{ color: 'inherit' }}>
                <span className="grow small">{formatDate(h.date)}</span>
                <span className="small tabular">{h.bestSet ? `${formatWeight(h.bestSet.weight, unit)} × ${h.bestSet.reps}` : '–'}</span>
                <span className="small faint tabular nowrap">{h.sets} sets</span>
              </Link>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
