import { db } from '../db/db';
import {
  DEFAULT_SETTINGS,
  EQUIPMENT,
  MUSCLES,
  SET_TYPES,
  type Exercise,
  type Routine,
  type RoutineExercise,
  type RoutineSet,
  type Settings,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../db/types';

export const BACKUP_APP_ID = 'anabasis';
export const BACKUP_VERSION = 1;

export interface BackupData {
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  settings: Settings;
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export type ValidationResult = { ok: true; data: BackupData } | { ok: false; errors: string[] };

export function buildBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

// ---------------------------------------------------------------------------
// Validation. Hand-written rather than a schema library to keep the dependency
// list to the requested stack. Each validator returns a cleaned copy so unknown
// keys in the file never reach the database.
// ---------------------------------------------------------------------------

const MAX_WEIGHT_KG = 2000;
const MAX_REPS = 10000;
const MAX_ERRORS = 20;

class Errors {
  list: string[] = [];
  add(path: string, msg: string) {
    if (this.list.length < MAX_ERRORS) this.list.push(`${path}: ${msg}`);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function str(o: Record<string, unknown>, k: string, path: string, e: Errors, opts: { nonEmpty?: boolean } = {}): string {
  const v = o[k];
  if (!isStr(v)) { e.add(`${path}.${k}`, 'must be a string'); return ''; }
  if (opts.nonEmpty && v.trim() === '') e.add(`${path}.${k}`, 'must not be empty');
  return v;
}

function num(o: Record<string, unknown>, k: string, path: string, e: Errors, min: number, max: number): number {
  const v = o[k];
  if (!isNum(v) || v < min || v > max) { e.add(`${path}.${k}`, `must be a number between ${min} and ${max}`); return min; }
  return v;
}

function nullableNum(o: Record<string, unknown>, k: string, path: string, e: Errors, min: number, max: number): number | null {
  const v = o[k];
  if (v === null || v === undefined) return null;
  return num(o, k, path, e, min, max);
}

function oneOf<T extends string>(o: Record<string, unknown>, k: string, allowed: readonly T[], path: string, e: Errors): T {
  const v = o[k];
  if (!isStr(v) || !(allowed as readonly string[]).includes(v)) {
    e.add(`${path}.${k}`, `must be one of ${allowed.join(', ')}`);
    return allowed[0]!;
  }
  return v as T;
}

function arr(o: Record<string, unknown>, k: string, path: string, e: Errors): unknown[] {
  const v = o[k];
  if (!Array.isArray(v)) { e.add(`${path}.${k}`, 'must be an array'); return []; }
  return v;
}

function vExercise(v: unknown, path: string, e: Errors): Exercise | null {
  if (!isObj(v)) { e.add(path, 'must be an object'); return null; }
  const ex: Exercise = {
    id: str(v, 'id', path, e, { nonEmpty: true }),
    name: str(v, 'name', path, e, { nonEmpty: true }).trim(),
    primaryMuscle: oneOf(v, 'primaryMuscle', MUSCLES, path, e),
    equipment: oneOf(v, 'equipment', EQUIPMENT, path, e),
    isCustom: v.isCustom === true,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
  if (v.restSeconds !== undefined) ex.restSeconds = num(v, 'restSeconds', path, e, 0, 3600);
  if (v.description !== undefined) {
    if (isStr(v.description)) ex.description = v.description.slice(0, 2000);
    else e.add(`${path}.description`, 'must be a string');
  }
  if (v.aliases !== undefined) {
    if (Array.isArray(v.aliases) && v.aliases.every(isStr)) ex.aliases = (v.aliases as string[]).slice(0, 20);
    else e.add(`${path}.aliases`, 'must be a list of strings');
  }
  return ex;
}

function vRoutineSet(v: unknown, path: string, e: Errors): RoutineSet {
  if (!isObj(v)) { e.add(path, 'must be an object'); return { id: '', weight: null, reps: null, type: 'normal' }; }
  return {
    id: str(v, 'id', path, e, { nonEmpty: true }),
    weight: nullableNum(v, 'weight', path, e, 0, MAX_WEIGHT_KG),
    reps: nullableNum(v, 'reps', path, e, 0, MAX_REPS),
    type: oneOf(v, 'type', SET_TYPES, path, e),
  };
}

function vRoutine(v: unknown, path: string, e: Errors, exerciseIds: Set<string>): Routine | null {
  if (!isObj(v)) { e.add(path, 'must be an object'); return null; }
  const exercises: RoutineExercise[] = arr(v, 'exercises', path, e).map((re, i) => {
    const p = `${path}.exercises[${i}]`;
    if (!isObj(re)) { e.add(p, 'must be an object'); return { id: '', exerciseId: '', sets: [] }; }
    const exerciseId = str(re, 'exerciseId', p, e, { nonEmpty: true });
    if (exerciseId && !exerciseIds.has(exerciseId)) e.add(`${p}.exerciseId`, `unknown exercise "${exerciseId}"`);
    return {
      id: str(re, 'id', p, e, { nonEmpty: true }),
      exerciseId,
      sets: arr(re, 'sets', p, e).map((s, j) => vRoutineSet(s, `${p}.sets[${j}]`, e)),
    };
  });
  return {
    id: str(v, 'id', path, e, { nonEmpty: true }),
    name: str(v, 'name', path, e, { nonEmpty: true }),
    notes: isStr(v.notes) ? v.notes : '',
    exercises,
    createdAt: num(v, 'createdAt', path, e, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(v, 'updatedAt', path, e, 0, Number.MAX_SAFE_INTEGER),
  };
}

function vWorkoutSet(v: unknown, path: string, e: Errors): WorkoutSet {
  if (!isObj(v)) { e.add(path, 'must be an object'); return { id: '', weight: null, reps: null, rpe: null, type: 'normal', completed: false }; }
  const s: WorkoutSet = {
    id: str(v, 'id', path, e, { nonEmpty: true }),
    weight: nullableNum(v, 'weight', path, e, 0, MAX_WEIGHT_KG),
    reps: nullableNum(v, 'reps', path, e, 0, MAX_REPS),
    rpe: nullableNum(v, 'rpe', path, e, 1, 10),
    type: oneOf(v, 'type', SET_TYPES, path, e),
    completed: v.completed === true,
  };
  if (isNum(v.completedAt)) s.completedAt = v.completedAt;
  return s;
}

function vWorkout(v: unknown, path: string, e: Errors, exerciseIds: Set<string>): Workout | null {
  if (!isObj(v)) { e.add(path, 'must be an object'); return null; }
  const exercises: WorkoutExercise[] = arr(v, 'exercises', path, e).map((we, i) => {
    const p = `${path}.exercises[${i}]`;
    if (!isObj(we)) { e.add(p, 'must be an object'); return { id: '', exerciseId: '', restSeconds: 0, notes: '', sets: [] }; }
    const exerciseId = str(we, 'exerciseId', p, e, { nonEmpty: true });
    if (exerciseId && !exerciseIds.has(exerciseId)) e.add(`${p}.exerciseId`, `unknown exercise "${exerciseId}"`);
    return {
      id: str(we, 'id', p, e, { nonEmpty: true }),
      exerciseId,
      restSeconds: num(we, 'restSeconds', p, e, 0, 3600),
      notes: isStr(we.notes) ? we.notes : '',
      sets: arr(we, 'sets', p, e).map((s, j) => vWorkoutSet(s, `${p}.sets[${j}]`, e)),
    };
  });
  const startedAt = num(v, 'startedAt', path, e, 0, Number.MAX_SAFE_INTEGER);
  const endedAt = v.endedAt === null || v.endedAt === undefined ? null : num(v, 'endedAt', path, e, 0, Number.MAX_SAFE_INTEGER);
  const status = oneOf(v, 'status', ['active', 'completed'] as const, path, e);
  if (status === 'completed' && endedAt === null) e.add(`${path}.endedAt`, 'is required for completed workouts');
  if (endedAt !== null && endedAt < startedAt) e.add(`${path}.endedAt`, 'must not be before startedAt');
  return {
    id: str(v, 'id', path, e, { nonEmpty: true }),
    name: str(v, 'name', path, e),
    notes: isStr(v.notes) ? v.notes : '',
    routineId: isStr(v.routineId) ? v.routineId : null,
    status,
    startedAt,
    endedAt,
    exercises,
  };
}

function vSettings(v: unknown, e: Errors): Settings {
  if (v === undefined) return { ...DEFAULT_SETTINGS };
  if (!isObj(v)) { e.add('data.settings', 'must be an object'); return { ...DEFAULT_SETTINGS }; }
  return {
    id: 'app',
    unit: oneOf(v, 'unit', ['kg', 'lb'] as const, 'data.settings', e),
    language: v.language === 'es' || v.language === 'en' ? v.language : null,
    defaultRestSeconds: num(v, 'defaultRestSeconds', 'data.settings', e, 0, 3600),
    lastBackupAt: isNum(v.lastBackupAt) ? v.lastBackupAt : null,
  };
}

function checkUnique(items: { id: string }[], label: string, e: Errors) {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) e.add(label, `duplicate id "${it.id}"`);
    seen.add(it.id);
  }
}

export function validateBackup(input: unknown): ValidationResult {
  const e = new Errors();
  if (!isObj(input)) return { ok: false, errors: ['File is not a JSON object.'] };
  if (input.app !== BACKUP_APP_ID) return { ok: false, errors: ['This is not an Anabasis backup file.'] };
  if (!isNum(input.version) || input.version > BACKUP_VERSION) {
    return { ok: false, errors: [`Unsupported backup version "${String(input.version)}".`] };
  }
  const data = input.data;
  if (!isObj(data)) return { ok: false, errors: ['Backup is missing its "data" section.'] };

  const exercises = arr(data, 'exercises', 'data', e)
    .map((x, i) => vExercise(x, `data.exercises[${i}]`, e))
    .filter((x): x is Exercise => x !== null);
  const exerciseIds = new Set(exercises.map((x) => x.id));
  const routines = arr(data, 'routines', 'data', e)
    .map((x, i) => vRoutine(x, `data.routines[${i}]`, e, exerciseIds))
    .filter((x): x is Routine => x !== null);
  const workouts = arr(data, 'workouts', 'data', e)
    .map((x, i) => vWorkout(x, `data.workouts[${i}]`, e, exerciseIds))
    .filter((x): x is Workout => x !== null);
  const settings = vSettings(data.settings, e);

  checkUnique(exercises, 'data.exercises', e);
  checkUnique(routines, 'data.routines', e);
  checkUnique(workouts, 'data.workouts', e);
  if (workouts.filter((w) => w.status === 'active').length > 1) e.add('data.workouts', 'more than one active workout');

  if (e.list.length > 0) return { ok: false, errors: e.list };
  return { ok: true, data: { exercises, routines, workouts, settings } };
}

/** Parses raw file text; never throws. */
export function parseBackupText(text: string): ValidationResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] };
  }
  return validateBackup(json);
}

// ---------------------------------------------------------------------------
// Database I/O
// ---------------------------------------------------------------------------

export async function readAllData(): Promise<BackupData> {
  const [exercises, routines, workouts, settings] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.workouts.toArray(),
    db.settings.get('app'),
  ]);
  return { exercises, routines, workouts, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

/** Builds the backup and records the export time as the "last backup" date. */
export async function exportBackup(now = new Date()): Promise<BackupFile> {
  const data = await readAllData();
  const lastBackupAt = now.getTime();
  const file = buildBackup({ ...data, settings: { ...data.settings, lastBackupAt } }, now);
  await db.settings.put({ ...data.settings, lastBackupAt });
  return file;
}

/** Replaces all local data with the backup in a single transaction (all or nothing). */
export async function restoreBackup(data: BackupData): Promise<void> {
  await db.transaction('rw', [db.exercises, db.routines, db.workouts, db.settings, db.timers], async () => {
    await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear(), db.settings.clear(), db.timers.clear()]);
    await db.exercises.bulkAdd(data.exercises);
    await db.routines.bulkAdd(data.routines);
    await db.workouts.bulkAdd(data.workouts);
    await db.settings.put(data.settings);
  });
}
