export const MUSCLES = [
  'chest',
  'upper back',
  'lats',
  'lower back',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abdominals',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'full body',
  'cardio',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'smith machine',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const SET_TYPES = ['warmup', 'normal', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export type Unit = 'kg' | 'lb';
export type Lang = 'es' | 'en';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  equipment: Equipment;
  isCustom: boolean;
  /** Per-exercise rest override in seconds; falls back to the global default. */
  restSeconds?: number;
  /** Your own words for it ("how my trainer showed it"); also used to find it again. */
  description?: string;
  /** Extra names you call it; searched alongside the official names. */
  aliases?: string[];
  createdAt: number;
}

export interface RoutineSet {
  id: string;
  /** Always stored in kg; converted for display. */
  weight: number | null;
  reps: number | null;
  type: SetType;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  sets: RoutineSet[];
}

export interface Routine {
  id: string;
  name: string;
  notes: string;
  exercises: RoutineExercise[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: string;
  /** Always stored in kg; converted for display. */
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  type: SetType;
  completed: boolean;
  completedAt?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  restSeconds: number;
  notes: string;
  sets: WorkoutSet[];
}

export type WorkoutStatus = 'active' | 'completed';

export interface Workout {
  id: string;
  name: string;
  notes: string;
  routineId: string | null;
  status: WorkoutStatus;
  startedAt: number;
  endedAt: number | null;
  exercises: WorkoutExercise[];
}

export interface Settings {
  id: 'app';
  unit: Unit;
  /** null = follow the device language. */
  language: Lang | null;
  defaultRestSeconds: number;
  lastBackupAt: number | null;
}

export const AI_MODELS = ['claude-opus-5-5', 'claude-haiku-5-5'] as const;
export type AiModel = (typeof AI_MODELS)[number];

/** Never exported in backups: it only ever lives on this device. */
export interface AiSecret {
  id: 'anthropic';
  apiKey: string;
  model: AiModel;
}

/** Ephemeral rest-timer state; kept in its own table so it never clobbers workout edits. */
export interface RestTimerState {
  id: 'rest';
  workoutId: string;
  workoutExerciseId: string;
  startedAt: number;
  endsAt: number;
  durationSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  unit: 'kg',
  language: null,
  defaultRestSeconds: 90,
  lastBackupAt: null,
};
