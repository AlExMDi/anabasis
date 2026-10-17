import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, Loading } from '../components/States';
import { createExercise, deleteExercise, updateExercise, validateExerciseName } from '../db/actions';
import { db } from '../db/db';
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from '../db/types';
import { confirmAction } from '../lib/confirm';

export function ExerciseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id]);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setMuscle(existing.primaryMuscle);
      setEquipment(existing.equipment);
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (id && existing === undefined) return <main className="page page--no-tabs"><Loading /></main>;
  if (id && (existing === null || !existing?.isCustom)) {
    return (
      <main className="page page--no-tabs">
        <PageHeader title="Exercise" back="/exercises" />
        <ErrorState title="Can’t edit this exercise" message="Only custom exercises can be edited." action={<Link className="btn" to="/exercises">Back</Link>} />
      </main>
    );
  }

  const save = async () => {
    const err = await validateExerciseName(name, id);
    setError(err);
    if (err) return;
    if (id) {
      await updateExercise(id, { name, primaryMuscle: muscle, equipment });
      navigate(`/progress/${id}`, { replace: true });
    } else {
      const newId = await createExercise({ name, primaryMuscle: muscle, equipment });
      navigate(`/progress/${newId}`, { replace: true });
    }
  };

  const remove = async () => {
    if (!id || !confirmAction('Delete this custom exercise?')) return;
    try {
      await deleteExercise(id);
      navigate('/exercises', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete exercise.');
    }
  };

  return (
    <main className="page page--no-tabs">
      <PageHeader title={id ? 'Edit exercise' : 'New exercise'} back={true} />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={80} autoComplete="off" aria-invalid={!!error} onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <label className="field">
          <span>Primary muscle</span>
          <select className="select" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)} style={{ textTransform: 'capitalize' }}>
            {MUSCLES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Equipment</span>
          <select className="select" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} style={{ textTransform: 'capitalize' }}>
            {EQUIPMENT.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn--primary btn--lg btn--block">Save exercise</button>
        {id && <button type="button" className="btn btn--danger btn--block" onClick={() => void remove()}>Delete exercise</button>}
      </form>
    </main>
  );
}
