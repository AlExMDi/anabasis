import { db } from './db';
import {
  DEFAULT_SETTINGS,
  type AiModel,
  type AiSecret,
  type Exercise,
  type Routine,
  type RoutineExercise,
  type Settings,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from './types';
import { uid } from '../lib/id';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Rows written by older versions lack newer fields, so always merge over the defaults. */
export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('app')) };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, id: 'app' });
  });
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export type ExerciseInput = Pick<Exercise, 'name' | 'primaryMuscle' | 'equipment'> & Partial<Pick<Exercise, 'description' | 'aliases'>>;

export type ExerciseNameError = 'required' | 'long' | 'duplicate';

export async function validateExerciseName(name: string, ignoreId?: string): Promise<ExerciseNameError | null> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'required';
  if (trimmed.length > 80) return 'long';
  const lower = trimmed.toLowerCase();
  const clash = await db.exercises.filter((e) => e.id !== ignoreId && e.name.toLowerCase() === lower).first();
  return clash ? 'duplicate' : null;
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  const id = uid();
  await db.exercises.add({ ...clean(input), id, isCustom: true, createdAt: Date.now() });
  return id;
}

function clean<T extends Partial<ExerciseInput>>(input: T): T {
  const out = { ...input };
  if (out.name !== undefined) out.name = out.name.trim();
  if (out.description !== undefined) out.description = out.description.trim().slice(0, 2000);
  if (out.aliases !== undefined) out.aliases = [...new Set(out.aliases.map((a) => a.trim()).filter(Boolean))].slice(0, 20);
  return out;
}

/** Updates the free-text notes/aliases on any exercise (seeded ones included). */
export async function updateExerciseNotes(id: string, patch: Partial<Pick<Exercise, 'description' | 'aliases'>>): Promise<void> {
  await db.exercises.update(id, clean(patch));
}

/** Remembers how you described an exercise so the offline search finds it next time. */
export async function rememberDescription(id: string, description: string): Promise<void> {
  const text = description.trim();
  if (!text) return;
  await db.transaction('rw', db.exercises, async () => {
    const ex = await db.exercises.get(id);
    if (!ex) return;
    const existing = ex.description?.trim() ?? '';
    if (existing.toLowerCase().includes(text.toLowerCase())) return;
    await db.exercises.update(id, clean({ description: existing ? `${existing}\n${text}` : text }));
  });
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  await db.exercises.update(id, clean(input));
}

/** Returns how many workouts/routines reference the exercise. */
export async function exerciseUsage(id: string): Promise<{ workouts: number; routines: number }> {
  const [workouts, routines] = await Promise.all([
    db.workouts.filter((w) => w.exercises.some((e) => e.exerciseId === id)).count(),
    db.routines.filter((r) => r.exercises.some((e) => e.exerciseId === id)).count(),
  ]);
  return { workouts, routines };
}

export async function deleteExercise(id: string): Promise<void> {
  const usage = await exerciseUsage(id);
  if (usage.workouts > 0 || usage.routines > 0) {
    throw new Error('in-use');
  }
  await db.exercises.delete(id);
}

export async function setExerciseRest(exerciseId: string, seconds: number): Promise<void> {
  await db.exercises.update(exerciseId, { restSeconds: seconds });
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export function newRoutineExercise(exerciseId: string): RoutineExercise {
  return {
    id: uid(),
    exerciseId,
    sets: Array.from({ length: 3 }, () => ({ id: uid(), weight: null, reps: null, type: 'normal' as const })),
  };
}

export async function saveRoutine(routine: Omit<Routine, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<string> {
  const now = Date.now();
  await db.routines.put({ ...routine, name: routine.name.trim(), createdAt: routine.createdAt ?? now, updatedAt: now });
  return routine.id;
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.routines.delete(id);
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export function newSet(prev?: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: uid(),
    weight: prev?.weight ?? null,
    reps: prev?.reps ?? null,
    rpe: null,
    type: prev?.type === 'warmup' ? 'warmup' : 'normal',
    completed: false,
  };
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').first();
}

async function restFor(exerciseId: string, settings: Settings): Promise<number> {
  const ex = await db.exercises.get(exerciseId);
  return ex?.restSeconds ?? settings.defaultRestSeconds;
}

export async function startWorkout(routineId: string | null, defaultName: string): Promise<string> {
  return db.transaction('rw', [db.workouts, db.routines, db.exercises, db.settings, db.timers], async () => {
    const existing = await getActiveWorkout();
    if (existing) throw new Error('A workout is already in progress.');
    const settings = await getSettings();
    const now = Date.now();
    let name = defaultName;
    let exercises: WorkoutExercise[] = [];
    if (routineId) {
      const routine = await db.routines.get(routineId);
      if (!routine) throw new Error('Routine not found.');
      name = routine.name;
      exercises = [];
      for (const re of routine.exercises) {
        exercises.push({
          id: uid(),
          exerciseId: re.exerciseId,
          restSeconds: await restFor(re.exerciseId, settings),
          notes: '',
          sets: re.sets.map((s) => ({ ...newSet(), weight: s.weight, reps: s.reps, type: s.type })),
        });
      }
    }
    const id = uid();
    await db.timers.clear();
    await db.workouts.add({
      id,
      name,
      notes: '',
      routineId,
      status: 'active',
      startedAt: now,
      endedAt: null,
      exercises,
    });
    return id;
  });
}

/**
 * Read-modify-write inside a transaction. Every edit goes straight to IndexedDB,
 * so an in-progress workout survives the app being closed at any moment.
 */
export async function mutateWorkout(id: string, fn: (w: Workout) => void): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) throw new Error('Workout not found.');
    fn(w);
    await db.workouts.put(w);
  });
}

function findExercise(w: Workout, weId: string): WorkoutExercise {
  const ex = w.exercises.find((e) => e.id === weId);
  if (!ex) throw new Error('Exercise not found in workout.');
  return ex;
}

export async function addExercisesToWorkout(workoutId: string, exerciseIds: string[]): Promise<void> {
  const settings = await getSettings();
  const rests = await Promise.all(exerciseIds.map((id) => restFor(id, settings)));
  await mutateWorkout(workoutId, (w) => {
    exerciseIds.forEach((exerciseId, i) => {
      w.exercises.push({ id: uid(), exerciseId, restSeconds: rests[i]!, notes: '', sets: [newSet()] });
    });
  });
}

export async function removeWorkoutExercise(workoutId: string, weId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    w.exercises = w.exercises.filter((e) => e.id !== weId);
  });
}

export async function moveWorkoutExercise(workoutId: string, weId: string, delta: -1 | 1): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const i = w.exercises.findIndex((e) => e.id === weId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= w.exercises.length) return;
    [w.exercises[i], w.exercises[j]] = [w.exercises[j]!, w.exercises[i]!];
  });
}

export async function addSet(workoutId: string, weId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const ex = findExercise(w, weId);
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(newSet(last));
  });
}

export async function removeSet(workoutId: string, weId: string, setId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const ex = findExercise(w, weId);
    ex.sets = ex.sets.filter((s) => s.id !== setId);
  });
}

export async function updateSet(workoutId: string, weId: string, setId: string, patch: Partial<Omit<WorkoutSet, 'id'>>): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const set = findExercise(w, weId).sets.find((s) => s.id === setId);
    if (set) Object.assign(set, patch);
  });
}

export async function updateWorkoutExercise(workoutId: string, weId: string, patch: Partial<Pick<WorkoutExercise, 'restSeconds' | 'notes'>>): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    Object.assign(findExercise(w, weId), patch);
  });
}

export async function updateWorkoutMeta(workoutId: string, patch: Partial<Pick<Workout, 'name' | 'notes' | 'startedAt' | 'endedAt'>>): Promise<void> {
  await db.workouts.update(workoutId, patch);
}

export interface FinishResult {
  ok: boolean;
  error?: string;
}

/** Drops unfinished sets and empty exercises, then marks the workout completed. */
export async function finishWorkout(workoutId: string, now = Date.now()): Promise<FinishResult> {
  let result: FinishResult = { ok: true };
  await db.transaction('rw', [db.workouts, db.timers], async () => {
    const w = await db.workouts.get(workoutId);
    if (!w) { result = { ok: false, error: 'Workout not found.' }; return; }
    const exercises = w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
      .filter((e) => e.sets.length > 0);
    if (exercises.length === 0) { result = { ok: false, error: 'Complete at least one set before finishing.' }; return; }
    await db.workouts.put({ ...w, exercises, status: 'completed', endedAt: Math.max(now, w.startedAt) });
    await db.timers.clear();
  });
  return result;
}

export async function discardWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', [db.workouts, db.timers], async () => {
    await db.workouts.delete(workoutId);
    await db.timers.clear();
  });
}

export const deleteWorkout = discardWorkout;

// ---------------------------------------------------------------------------
// Rest timer (timestamp based: remaining = endsAt - now, so it stays correct
// after iOS suspends the page in the background)
// ---------------------------------------------------------------------------

export async function startRestTimer(workoutId: string, workoutExerciseId: string, seconds: number, now = Date.now()): Promise<void> {
  if (seconds <= 0) { await db.timers.clear(); return; }
  await db.timers.put({ id: 'rest', workoutId, workoutExerciseId, startedAt: now, endsAt: now + seconds * 1000, durationSeconds: seconds });
}

export async function adjustRestTimer(deltaSeconds: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.timers, async () => {
    const t = await db.timers.get('rest');
    if (!t) return;
    const endsAt = Math.max(now, t.endsAt + deltaSeconds * 1000);
    if (endsAt <= now) { await db.timers.clear(); return; }
    await db.timers.put({ ...t, endsAt, durationSeconds: Math.max(1, t.durationSeconds + deltaSeconds) });
  });
}

export async function stopRestTimer(): Promise<void> {
  await db.timers.clear();
}

// ---------------------------------------------------------------------------
// AI key (device-only; excluded from backups)
// ---------------------------------------------------------------------------

export async function getAiSecret(): Promise<AiSecret | undefined> {
  return db.secrets.get('anthropic');
}

export async function saveAiSecret(apiKey: string, model: AiModel): Promise<void> {
  await db.secrets.put({ id: 'anthropic', apiKey: apiKey.trim(), model });
}

export async function setAiModel(model: AiModel): Promise<void> {
  await db.secrets.update('anthropic', { model });
}

export async function deleteAiSecret(): Promise<void> {
  await db.secrets.delete('anthropic');
}
