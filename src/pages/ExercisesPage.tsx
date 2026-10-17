import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExerciseAvatar, MuscleChips, filterExercises } from '../components/ExercisePicker';
import { IconChevron, IconPlus, IconSearch } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, Loading } from '../components/States';
import type { Muscle } from '../db/types';
import { useExercises } from '../hooks/data';

export function ExercisesPage() {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const filtered = useMemo(() => (exercises ? filterExercises(exercises, query, muscle) : []), [exercises, query, muscle]);

  return (
    <main className="page">
      <PageHeader title="Exercises" actions={<Link to="/exercises/new" className="btn btn--ghost btn--sm"><IconPlus width={18} height={18} /> Custom</Link>} />
      <div className="search">
        <IconSearch />
        <input className="input" type="search" placeholder="Search exercises" aria-label="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <MuscleChips value={muscle} onChange={setMuscle} />
      {exercises === undefined ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState title="No exercises found" action={<Link to="/exercises/new" className="btn btn--primary">Create custom exercise</Link>}>
          Try a different search or filter.
        </EmptyState>
      ) : (
        <>
          <p className="small faint">{filtered.length} exercise{filtered.length === 1 ? '' : 's'}</p>
          <ul className="list">
            {filtered.map((e) => (
              <li key={e.id}>
                <Link to={`/progress/${e.id}`} className="list-item">
                  <ExerciseAvatar name={e.name} />
                  <span className="grow">
                    <span className="bold">{e.name}</span>
                    {e.isCustom && <> <span className="badge badge--accent">Custom</span></>}
                    <br />
                    <span className="small muted" style={{ textTransform: 'capitalize' }}>{e.primaryMuscle} · {e.equipment}</span>
                  </span>
                  <IconChevron width={20} height={20} className="faint" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
