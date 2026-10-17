import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MUSCLES, type Exercise, type Muscle } from '../db/types';
import { useExercises } from '../hooks/data';
import { exerciseName, useI18n } from '../i18n';
import { seedSpanishName } from '../db/seedEs';
import { normalize } from '../lib/identify/local';
import { DescribePanel } from './DescribeExercise';
import { IconBack, IconSearch, IconSparkle, IconX } from './Icons';
import { EmptyState, Loading } from './States';

/** Matches either language's name, your aliases and the equipment, accent-insensitive. */
export function filterExercises(list: Exercise[], query: string, muscle: Muscle | 'all'): Exercise[] {
  const q = normalize(query).trim();
  return list.filter((e) => {
    if (muscle !== 'all' && e.primaryMuscle !== muscle) return false;
    if (q === '') return true;
    const hay = normalize([e.name, seedSpanishName(e.id) ?? '', e.equipment, ...(e.aliases ?? [])].join(' '));
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

export function sortByName(list: Exercise[], lang: 'es' | 'en'): Exercise[] {
  return [...list].sort((a, b) => exerciseName(a, lang).localeCompare(exerciseName(b, lang), lang));
}

export function MuscleChips({ value, onChange }: { value: Muscle | 'all'; onChange: (m: Muscle | 'all') => void }) {
  const { t, muscle } = useI18n();
  return (
    <div className="chips" role="group" aria-label={t('picker.filterMuscle')}>
      {(['all', ...MUSCLES] as const).map((m) => (
        <button key={m} type="button" className="chip" aria-pressed={value === m} onClick={() => onChange(m)}>
          {m === 'all' ? t('picker.all') : muscle(m)}
        </button>
      ))}
    </div>
  );
}

const REGION: Record<Muscle, string> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  'upper back': 'pull', lats: 'pull', 'lower back': 'pull', traps: 'pull', biceps: 'pull', forearms: 'pull',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  abdominals: 'core', 'full body': 'other', cardio: 'other',
};

export function ExerciseAvatar({ name, muscle }: { name: string; muscle?: Muscle }) {
  const initials = name.split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w) && w.length > 2).slice(0, 2).map((w) => w[0]).join('') || name.slice(0, 2);
  return <span className="avatar" data-region={muscle ? REGION[muscle] : 'other'} aria-hidden>{initials}</span>;
}

export function ExerciseRow({ exercise, selectedIndex, onClick, trailing }: { exercise: Exercise; selectedIndex?: number; onClick?: () => void; trailing?: ReactNode }) {
  const { t, exName, muscle, equipment } = useI18n();
  const name = exName(exercise);
  const content = (
    <>
      <ExerciseAvatar name={name} muscle={exercise.primaryMuscle} />
      <span className="grow">
        <span className="bold">{name}</span>
        {exercise.isCustom && <> <span className="badge badge--accent">{t('common.custom')}</span></>}
        <br />
        <span className="small muted">{muscle(exercise.primaryMuscle)} · {equipment(exercise.equipment)}</span>
      </span>
      {selectedIndex !== undefined && selectedIndex >= 0 && <span className="badge badge--accent">{selectedIndex + 1}</span>}
      {trailing}
    </>
  );
  return onClick ? (
    <button type="button" className={`list-item ${selectedIndex !== undefined && selectedIndex >= 0 ? 'list-item--selected' : ''}`} aria-pressed={selectedIndex !== undefined ? selectedIndex >= 0 : undefined} onClick={onClick}>
      {content}
    </button>
  ) : (
    <Link to={`/progress/${exercise.id}`} className="list-item">{content}</Link>
  );
}

export function useSheetBehaviour(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
}

interface Props {
  title?: string;
  onClose: () => void;
  onPick: (exerciseIds: string[]) => void;
}

/** Full-height sheet for picking one or more exercises (in tap order), or describing one. */
export function ExercisePicker({ title, onClose, onPick }: Props) {
  const { t, tn, lang } = useI18n();
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [describing, setDescribing] = useState(false);
  useSheetBehaviour(onClose);
  const heading = title ?? t('picker.title');

  const filtered = useMemo(() => (exercises ? sortByName(filterExercises(exercises, query, muscle), lang) : []), [exercises, query, muscle, lang]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={describing ? t('describe.title') : heading} onClick={(e) => e.stopPropagation()}>
        {describing ? (
          <>
            <div className="sheet__head">
              <div className="row">
                <button type="button" className="icon-btn" aria-label={t('common.back')} onClick={() => setDescribing(false)}><IconBack /></button>
                <h2 className="grow">{t('describe.title')}</h2>
                <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}><IconX /></button>
              </div>
            </div>
            <div className="sheet__body">
              <DescribePanel
                onPick={(id) => {
                  setSelected((s) => (s.includes(id) ? s : [...s, id]));
                  setDescribing(false);
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="sheet__head">
              <div className="row row--between">
                <h2>{heading}</h2>
                <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}><IconX /></button>
              </div>
              <div className="search">
                <IconSearch />
                <input className="input" type="search" placeholder={t('picker.search')} aria-label={t('picker.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <button type="button" className="btn btn--soft btn--block" onClick={() => setDescribing(true)}>
                <IconSparkle width={18} height={18} /> {t('picker.describeCta')}
              </button>
              <MuscleChips value={muscle} onChange={setMuscle} />
            </div>
            <div className="sheet__body">
              {exercises === undefined ? (
                <Loading />
              ) : filtered.length === 0 ? (
                <EmptyState title={t('picker.none')}>
                  <Link to="/exercises/new">{t('picker.createCustom')}</Link>
                </EmptyState>
              ) : (
                <ul className="list">
                  {filtered.map((e) => (
                    <li key={e.id}>
                      <ExerciseRow exercise={e} selectedIndex={selected.indexOf(e.id)} onClick={() => toggle(e.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="sheet__foot">
              <button type="button" className="btn btn--primary btn--block btn--lg" disabled={selected.length === 0} onClick={() => onPick(selected)}>
                {selected.length === 0 ? t('picker.select') : tn('picker.add', selected.length)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
