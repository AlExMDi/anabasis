import type { Exercise, Muscle, Workout } from '../db/types';
import { isWorkingSet, workoutDuration, workoutVolume } from './calc';


/** Local midnight of the Monday that starts ts's week (weeks start on Monday). */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

/** Calendar-aware (DST-safe) week shift. */
export function addWeeks(start: number, n: number): number {
  const d = new Date(start);
  d.setDate(d.getDate() + n * 7);
  return d.getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export interface PeriodTotals {
  workouts: number;
  durationMs: number;
  volume: number;
  sets: number;
}

function totals(ws: Workout[]): PeriodTotals {
  return ws.reduce<PeriodTotals>(
    (t, w) => ({
      workouts: t.workouts + 1,
      durationMs: t.durationMs + workoutDuration(w),
      volume: t.volume + workoutVolume(w),
      sets: t.sets + w.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0),
    }),
    { workouts: 0, durationMs: 0, volume: 0, sets: 0 },
  );
}

function completed(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => w.status === 'completed');
}

export function weekComparison(workouts: Workout[], now = Date.now()): { thisWeek: PeriodTotals; lastWeek: PeriodTotals } {
  const start = weekStart(now);
  const prev = addWeeks(start, -1);
  const done = completed(workouts);
  return {
    thisWeek: totals(done.filter((w) => w.startedAt >= start)),
    lastWeek: totals(done.filter((w) => w.startedAt >= prev && w.startedAt < start)),
  };
}

/**
 * Consecutive weeks with at least one workout. The current week counts if it has
 * one; if it doesn't yet, the streak is still alive from last week (you have until Sunday).
 */
export function weekStreak(workouts: Workout[], now = Date.now()): number {
  const weeks = new Set(completed(workouts).map((w) => weekStart(w.startedAt)));
  let cursor = weekStart(now);
  if (!weeks.has(cursor)) cursor = addWeeks(cursor, -1);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

/** Workout ids per local day of the given month (0-based month). */
export function monthCalendar(workouts: Workout[], year: number, month: number): Map<number, Workout[]> {
  const map = new Map<number, Workout[]>();
  for (const w of completed(workouts)) {
    const d = new Date(w.startedAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const list = map.get(d.getDate()) ?? [];
    list.push(w);
    map.set(d.getDate(), list);
  }
  return map;
}

/** Grid cells for a month view starting on Monday; null = padding. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Working sets per primary muscle within [from, to). Sorted high to low. */
export function muscleSets(workouts: Workout[], exercises: Map<string, Exercise>, from: number, to: number): { muscle: Muscle; sets: number }[] {
  const counts = new Map<Muscle, number>();
  for (const w of completed(workouts)) {
    if (w.startedAt < from || w.startedAt >= to) continue;
    for (const we of w.exercises) {
      const m = exercises.get(we.exerciseId)?.primaryMuscle;
      if (!m) continue;
      const n = we.sets.filter(isWorkingSet).length;
      if (n > 0) counts.set(m, (counts.get(m) ?? 0) + n);
    }
  }
  return [...counts.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

/** Totals for each of the last `weeks` weeks, oldest first (including the current one). */
export function weeklySeries(workouts: Workout[], weeks: number, now = Date.now()): ({ weekStart: number } & PeriodTotals)[] {
  const current = weekStart(now);
  const done = completed(workouts);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addWeeks(current, i - weeks + 1);
    const end = addWeeks(start, 1);
    return { weekStart: start, ...totals(done.filter((w) => w.startedAt >= start && w.startedAt < end)) };
  });
}

