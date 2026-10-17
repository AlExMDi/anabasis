import type { SetType, Workout, WorkoutSet } from '../db/types';

let n = 0;
export function set(weight: number, reps: number, opts: Partial<WorkoutSet> & { type?: SetType } = {}): WorkoutSet {
  n += 1;
  return { id: `s${n}`, weight, reps, rpe: null, type: 'normal', completed: true, ...opts };
}

export function workout(id: string, startedAt: number, exercises: Record<string, WorkoutSet[]>): Workout {
  return {
    id,
    name: `Workout ${id}`,
    notes: '',
    routineId: null,
    status: 'completed',
    startedAt,
    endedAt: startedAt + 3600_000,
    exercises: Object.entries(exercises).map(([exerciseId, sets], i) => ({
      id: `${id}-we${i}`,
      exerciseId,
      restSeconds: 90,
      notes: '',
      sets,
    })),
  };
}
