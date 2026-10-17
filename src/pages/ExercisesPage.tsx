import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DescribeSheet } from '../components/DescribeExercise';
import { ExerciseRow, MuscleChips, filterExercises, sortByName } from '../components/ExercisePicker';
import { IconChevron, IconPlus, IconSearch, IconSparkle } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, Loading } from '../components/States';
import type { Muscle } from '../db/types';
import { useExercises } from '../hooks/data';
import { useI18n } from '../i18n';

export function ExercisesPage() {
  const { t, tn, lang } = useI18n();
  const navigate = useNavigate();
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [describing, setDescribing] = useState(false);
  const filtered = useMemo(() => (exercises ? sortByName(filterExercises(exercises, query, muscle), lang) : []), [exercises, query, muscle, lang]);

  return (
    <main className="page">
      <PageHeader
        title={t('exercises.title')}
        actions={<Link to="/exercises/new" className="btn btn--ghost btn--sm"><IconPlus width={18} height={18} /> {t('exercises.custom')}</Link>}
      />
      <button type="button" className="btn btn--soft btn--block" onClick={() => setDescribing(true)}>
        <IconSparkle width={18} height={18} /> {t('picker.describeCta')}
      </button>
      <div className="search">
        <IconSearch />
        <input className="input" type="search" placeholder={t('picker.search')} aria-label={t('picker.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <MuscleChips value={muscle} onChange={setMuscle} />
      {exercises === undefined ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('picker.none')} action={<Link to="/exercises/new" className="btn btn--primary">{t('exercises.createCustom')}</Link>}>
          {t('exercises.noneHint')}
        </EmptyState>
      ) : (
        <>
          <p className="small faint">{tn('exercises.count', filtered.length)}</p>
          <ul className="list">
            {filtered.map((e) => (
              <li key={e.id}>
                <ExerciseRow exercise={e} trailing={<IconChevron width={20} height={20} className="faint" />} />
              </li>
            ))}
          </ul>
        </>
      )}
      {describing && (
        <DescribeSheet
          onClose={() => setDescribing(false)}
          onPick={(id) => { setDescribing(false); navigate(`/progress/${id}`); }}
        />
      )}
    </main>
  );
}
