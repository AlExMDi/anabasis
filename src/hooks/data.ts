import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { DEFAULT_SETTINGS, type Exercise, type Settings, type Workout } from '../db/types';
import { detectPRs, type PersonalRecord } from '../lib/prs';

/** `undefined` while loading — callers render a loading state. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => (await db.settings.get('app')) ?? { ...DEFAULT_SETTINGS }, []);
}

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  const list = useExercises();
  return useMemo(() => (list ? new Map(list.map((e) => [e.id, e])) : undefined), [list]);
}

/** Completed workouts, newest first. */
export function useCompletedWorkouts(): Workout[] | undefined {
  return useLiveQuery(
    () => db.workouts.orderBy('startedAt').reverse().filter((w) => w.status === 'completed').toArray(),
    [],
  );
}

/** `null` = loaded and nothing in progress. */
export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => (await db.workouts.where('status').equals('active').first()) ?? null, []);
}

export function useWorkout(id: string | undefined): Workout | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.workouts.get(id)) ?? null) : null), [id]);
}

export function useRestTimer() {
  return useLiveQuery(async () => (await db.timers.get('rest')) ?? null, []);
}

export function usePRs(workouts: Workout[] | undefined): PersonalRecord[] | undefined {
  return useMemo(() => (workouts ? detectPRs(workouts) : undefined), [workouts]);
}
