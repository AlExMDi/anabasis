import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, Loading } from '../components/States';
import { createExercise, deleteExercise, updateExercise, validateExerciseName } from '../db/actions';
import { db } from '../db/db';
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from '../db/types';
import { useI18n, type TKey } from '../i18n';
import { confirmAction } from '../lib/confirm';

export function ExerciseFormPage() {
  const { t, muscle: muscleLabel, equipment: equipmentLabel } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id]);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<TKey | null>(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setMuscle(existing.primaryMuscle);
      setEquipment(existing.equipment);
      setDescription(existing.description ?? '');
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (id && existing === undefined) return <main className="page page--no-tabs"><Loading /></main>;
  if (id && (existing === null || !existing?.isCustom)) {
    return (
      <main className="page page--no-tabs">
        <PageHeader title={t('exform.edit')} back="/exercises" />
        <ErrorState title={t('exform.cantEdit')} message={t('exform.cantEditHint')} action={<Link className="btn" to="/exercises">{t('common.back')}</Link>} />
      </main>
    );
  }

  const save = async () => {
    const err = await validateExerciseName(name, id);
    setError(err ? `exform.err.${err}` : null);
    if (err) return;
    const input = { name, primaryMuscle: muscle, equipment, description, aliases: existing?.aliases };
    if (id) {
      await updateExercise(id, input);
      navigate(`/progress/${id}`, { replace: true });
    } else {
      const newId = await createExercise(input);
      navigate(`/progress/${newId}`, { replace: true });
    }
  };

  const remove = async () => {
    if (!id || !confirmAction(t('exform.confirmDelete'))) return;
    try {
      await deleteExercise(id);
      navigate('/exercises', { replace: true });
    } catch {
      setError('exform.err.inUse');
    }
  };

  return (
    <main className="page page--no-tabs">
      <PageHeader title={id ? t('exform.edit') : t('exform.new')} back={true} />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <label className="field">
          <span>{t('exform.name')}</span>
          <input className="input" value={name} maxLength={80} autoComplete="off" aria-invalid={!!error} onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        {error && <p className="error-text" role="alert">{t(error)}</p>}
        <label className="field">
          <span>{t('exform.muscle')}</span>
          <select className="select" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {MUSCLES.map((m) => <option key={m} value={m}>{muscleLabel(m)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('exform.equipment')}</span>
          <select className="select" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((m) => <option key={m} value={m}>{equipmentLabel(m)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('exform.description')} <span className="faint">· {t('common.optional')}</span></span>
          <textarea className="textarea" value={description} maxLength={2000} placeholder={t('describe.placeholder')} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary btn--lg btn--block">{t('exform.save')}</button>
        {id && <button type="button" className="btn btn--danger btn--block" onClick={() => void remove()}>{t('exform.delete')}</button>}
      </form>
    </main>
  );
}
