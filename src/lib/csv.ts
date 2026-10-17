import type { Exercise, Unit, Workout } from '../db/types';
import { epley1RM } from './calc';
import { toDisplayWeight } from './units';

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote when needed; prefix formulas so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) && typeof v === 'string' ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per logged set of every completed workout. Weights use the chosen unit. */
export function workoutsToCsv(workouts: Workout[], exercises: Exercise[], unit: Unit): string {
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const header = [
    'workout_date', 'workout_name', 'duration_min', 'exercise', 'set_index', 'set_type',
    `weight_${unit}`, 'reps', 'rpe', 'completed', `est_1rm_${unit}`,
  ];
  const rows = [header.join(',')];
  const sorted = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    const duration = w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) : '';
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) => {
        const w1rm = s.weight !== null && s.reps ? toDisplayWeight(epley1RM(s.weight, s.reps), unit) : null;
        rows.push([
          cell(new Date(w.startedAt).toISOString()),
          cell(w.name),
          cell(duration),
          cell(names.get(ex.exerciseId) ?? ex.exerciseId),
          cell(i + 1),
          cell(s.type),
          cell(s.weight === null ? null : toDisplayWeight(s.weight, unit)),
          cell(s.reps),
          cell(s.rpe),
          cell(s.completed ? 'yes' : 'no'),
          cell(w1rm),
        ].join(','));
      });
    }
  }
  return rows.join('\n') + '\n';
}
