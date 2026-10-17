import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MUSCLES, type Exercise, type Muscle } from '../db/types';
import { useExercises } from '../hooks/data';
import { IconSearch, IconX } from './Icons';
import { EmptyState, Loading } from './States';

export function filterExercises(list: Exercise[], query: string, muscle: Muscle | 'all'): Exercise[] {
  const q = query.trim().toLowerCase();
  return list.filter(
    (e) => (muscle === 'all' || e.primaryMuscle === muscle) && (q === '' || e.name.toLowerCase().includes(q) || e.equipment.includes(q)),
  );
}

export function MuscleChips({ value, onChange }: { value: Muscle | 'all'; onChange: (m: Muscle | 'all') => void }) {
  return (
    <div className="chips" role="group" aria-label="Filter by muscle">
      {(['all', ...MUSCLES] as const).map((m) => (
        <button key={m} type="button" className="chip" aria-pressed={value === m} onClick={() => onChange(m)}>
          {m}
        </button>
      ))}
    </div>
  );
}

export function ExerciseAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return <span className="avatar" aria-hidden>{initials}</span>;
}

interface Props {
  title?: string;
  onClose: () => void;
  onPick: (exerciseIds: string[]) => void;
}

/** Full-height sheet for picking one or more exercises (in tap order). */
export function ExercisePicker({ title = 'Add exercises', onClose, onPick }: Props) {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const filtered = useMemo(() => (exercises ? filterExercises(exercises, query, muscle) : []), [exercises, query, muscle]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="row row--between">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><IconX /></button>
          </div>
          <div className="search">
            <IconSearch />
            <input className="input" type="search" placeholder="Search exercises" aria-label="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <MuscleChips value={muscle} onChange={setMuscle} />
        </div>
        <div className="sheet__body">
          {exercises === undefined ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <EmptyState title="No exercises found">
              <Link to="/exercises/new">Create a custom exercise</Link>
            </EmptyState>
          ) : (
            <ul className="list">
              {filtered.map((e) => {
                const idx = selected.indexOf(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`list-item ${idx >= 0 ? 'list-item--selected' : ''}`}
                      aria-pressed={idx >= 0}
                      onClick={() => toggle(e.id)}
                    >
                      <ExerciseAvatar name={e.name} />
                      <span className="grow">
                        <span className="bold">{e.name}</span>
                        <br />
                        <span className="small muted" style={{ textTransform: 'capitalize' }}>{e.primaryMuscle} · {e.equipment}</span>
                      </span>
                      {idx >= 0 && <span className="badge badge--accent">{idx + 1}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="sheet__foot">
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={selected.length === 0} onClick={() => onPick(selected)}>
            {selected.length === 0 ? 'Select exercises' : `Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
