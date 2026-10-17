import type { Workout, WorkoutExercise, WorkoutSet } from '../db/types';

/**
 * Estimated one-rep max using the Epley formula: w × (1 + reps / 30).
 * A single rep is returned as-is (the formula would overestimate it by ~3%).
 */
export function epley1RM(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * A set counts toward stats when it was completed and is not a warm-up:
 * warm-ups would inflate volume without reflecting working effort.
 */
export function isWorkingSet(set: WorkoutSet): boolean {
  return set.completed && set.type !== 'warmup' && (set.reps ?? 0) > 0;
}

export function setVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  return (set.weight ?? 0) * (set.reps ?? 0);
}

export function exerciseVolume(ex: WorkoutExercise): number {
  return ex.sets.filter(isWorkingSet).reduce((sum, s) => sum + setVolume(s), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
}

export function completedSetCount(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.completed).length, 0);
}

export function workoutDuration(w: Workout, now = Date.now()): number {
  return (w.endedAt ?? now) - w.startedAt;
}

export interface ExerciseSessionStats {
  workoutId: string;
  date: number;
  /** Heaviest working-set weight in kg. */
  bestWeight: number;
  /** Set with the highest estimated 1RM. */
  bestSet: { weight: number; reps: number } | null;
  best1RM: number;
  volume: number;
  sets: number;
}

/** Per-session stats for one exercise, oldest first. Sessions with no working sets are skipped. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSessionStats[] {
  const out: ExerciseSessionStats[] = [];
  const sorted = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(isWorkingSet));
    if (sets.length === 0) continue;
    let bestWeight = 0;
    let best1RM = 0;
    let bestSet: ExerciseSessionStats['bestSet'] = null;
    let volume = 0;
    for (const s of sets) {
      const weight = s.weight ?? 0;
      const reps = s.reps ?? 0;
      bestWeight = Math.max(bestWeight, weight);
      const e = epley1RM(weight, reps);
      if (e > best1RM || bestSet === null) {
        best1RM = Math.max(best1RM, e);
        bestSet = { weight, reps };
      }
      volume += weight * reps;
    }
    out.push({ workoutId: w.id, date: w.startedAt, bestWeight, bestSet, best1RM, volume, sets: sets.length });
  }
  return out;
}
