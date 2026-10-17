import type { Workout } from '../db/types';
import { epley1RM, isWorkingSet, setVolume } from './calc';

export type PRType = 'weight' | 'e1rm' | 'setVolume' | 'sessionVolume';

export const PR_LABELS: Record<PRType, string> = {
  weight: 'Heaviest weight',
  e1rm: 'Best est. 1RM',
  setVolume: 'Best set volume',
  sessionVolume: 'Best session volume',
};

export interface PersonalRecord {
  workoutId: string;
  exerciseId: string;
  /** Null for session-level records (session volume). */
  setId: string | null;
  type: PRType;
  value: number;
  previous: number;
  date: number;
}

interface Bests {
  weight: number;
  e1rm: number;
  setVolume: number;
  sessionVolume: number;
}

const EPS = 1e-9;

/**
 * Replays completed workouts chronologically and records every time a best was beaten.
 *
 * - Only working sets (completed, non warm-up) count.
 * - The first session of an exercise only sets the baseline; flagging everything as a PR
 *   the first time you log a lift would make the badges meaningless.
 * - Within one session, each PR type is awarded at most once (to its best set).
 */
export function detectPRs(workouts: Workout[]): PersonalRecord[] {
  const bests = new Map<string, Bests>();
  const records: PersonalRecord[] = [];
  const sorted = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);

  for (const w of sorted) {
    // Group sets by exercise: an exercise may appear twice in one workout.
    const byExercise = new Map<string, { id: string; weight: number; e1rm: number; vol: number }[]>();
    for (const ex of w.exercises) {
      const list = byExercise.get(ex.exerciseId) ?? [];
      for (const s of ex.sets) {
        if (!isWorkingSet(s)) continue;
        list.push({
          id: s.id,
          weight: s.weight ?? 0,
          e1rm: epley1RM(s.weight ?? 0, s.reps ?? 0),
          vol: setVolume(s),
        });
      }
      byExercise.set(ex.exerciseId, list);
    }

    for (const [exerciseId, sets] of byExercise) {
      if (sets.length === 0) continue;
      const session: Bests = { weight: 0, e1rm: 0, setVolume: 0, sessionVolume: 0 };
      const bestSetId: Record<'weight' | 'e1rm' | 'setVolume', string | null> = { weight: null, e1rm: null, setVolume: null };
      for (const s of sets) {
        if (s.weight > session.weight) { session.weight = s.weight; bestSetId.weight = s.id; }
        if (s.e1rm > session.e1rm) { session.e1rm = s.e1rm; bestSetId.e1rm = s.id; }
        if (s.vol > session.setVolume) { session.setVolume = s.vol; bestSetId.setVolume = s.id; }
        session.sessionVolume += s.vol;
      }

      const prev = bests.get(exerciseId);
      if (prev) {
        for (const type of ['weight', 'e1rm', 'setVolume', 'sessionVolume'] as const) {
          if (session[type] > prev[type] + EPS && session[type] > 0) {
            records.push({
              workoutId: w.id,
              exerciseId,
              setId: type === 'sessionVolume' ? null : bestSetId[type],
              type,
              value: session[type],
              previous: prev[type],
              date: w.startedAt,
            });
          }
        }
        bests.set(exerciseId, {
          weight: Math.max(prev.weight, session.weight),
          e1rm: Math.max(prev.e1rm, session.e1rm),
          setVolume: Math.max(prev.setVolume, session.setVolume),
          sessionVolume: Math.max(prev.sessionVolume, session.sessionVolume),
        });
      } else {
        bests.set(exerciseId, session);
      }
    }
  }
  return records;
}

export function prsByWorkout(records: PersonalRecord[]): Map<string, PersonalRecord[]> {
  const map = new Map<string, PersonalRecord[]>();
  for (const r of records) {
    const list = map.get(r.workoutId) ?? [];
    list.push(r);
    map.set(r.workoutId, list);
  }
  return map;
}

/** All-time bests for one exercise (including its first session). */
export function allTimeBests(workouts: Workout[], exerciseId: string): Bests | null {
  let found = false;
  const b: Bests = { weight: 0, e1rm: 0, setVolume: 0, sessionVolume: 0 };
  for (const w of workouts) {
    if (w.status !== 'completed') continue;
    let session = 0;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (!isWorkingSet(s)) continue;
        found = true;
        b.weight = Math.max(b.weight, s.weight ?? 0);
        b.e1rm = Math.max(b.e1rm, epley1RM(s.weight ?? 0, s.reps ?? 0));
        b.setVolume = Math.max(b.setVolume, setVolume(s));
        session += setVolume(s);
      }
    }
    b.sessionVolume = Math.max(b.sessionVolume, session);
  }
  return found ? b : null;
}
