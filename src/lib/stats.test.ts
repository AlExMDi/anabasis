import { describe, expect, it } from 'vitest';
import type { Exercise } from '../db/types';
import { set, workout } from '../test/factories';
import { addWeeks, monthCalendar, monthGrid, muscleSets, weekComparison, weekStart, weekStreak, weeklySeries } from './stats';

// Wednesday 15 Oct 2025, local time.
const NOW = new Date(2025, 9, 15, 12).getTime();
const at = (y: number, m: number, d: number) => new Date(y, m, d, 18).getTime();

describe('weeks', () => {
  it('start on Monday at local midnight', () => {
    const s = new Date(weekStart(NOW));
    expect([s.getDay(), s.getDate(), s.getHours()]).toEqual([1, 13, 0]);
    // Sunday belongs to the previous Monday's week.
    expect(new Date(weekStart(at(2025, 9, 19))).getDate()).toBe(13);
  });

  it('addWeeks survives a DST change', () => {
    const s = weekStart(at(2025, 9, 20)); // week containing the late-October EU switch
    expect(new Date(addWeeks(s, 1)).getHours()).toBe(0);
    expect(new Date(addWeeks(s, 1)).getDay()).toBe(1);
  });
});

describe('weekStreak', () => {
  it('counts consecutive weeks, current week optional', () => {
    const ws = [workout('a', at(2025, 9, 6), {}), workout('b', at(2025, 8, 30), {}), workout('c', at(2025, 8, 16), {})];
    // Nothing yet this week: streak continues from last week (2 weeks: 6 Oct, 29 Sep).
    expect(weekStreak(ws, NOW)).toBe(2);
    expect(weekStreak([...ws, workout('d', at(2025, 9, 14), {})], NOW)).toBe(3);
    expect(weekStreak([workout('x', at(2025, 8, 1), {})], NOW)).toBe(0);
  });
});

describe('weekComparison & weeklySeries', () => {
  it('splits totals by week', () => {
    const ws = [
      workout('a', at(2025, 9, 14), { e: [set(100, 5), set(100, 5, { completed: false })] }),
      workout('b', at(2025, 9, 8), { e: [set(50, 10)] }),
    ];
    const { thisWeek, lastWeek } = weekComparison(ws, NOW);
    expect(thisWeek).toMatchObject({ workouts: 1, volume: 500, sets: 1 });
    expect(lastWeek).toMatchObject({ workouts: 1, volume: 500, sets: 1 });
    const series = weeklySeries(ws, 4, NOW);
    expect(series).toHaveLength(4);
    expect(series.map((s) => s.workouts)).toEqual([0, 0, 1, 1]);
  });
});

describe('calendar', () => {
  it('grids a month starting on Monday', () => {
    const cells = monthGrid(2025, 9); // 1 Oct 2025 is a Wednesday
    expect(cells.slice(0, 3)).toEqual([null, null, 1]);
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
  });

  it('groups workouts by day of the month', () => {
    const days = monthCalendar([workout('a', at(2025, 9, 14), {}), workout('b', at(2025, 9, 14), {}), workout('c', at(2025, 10, 1), {})], 2025, 9);
    expect([...days.keys()]).toEqual([14]);
    expect(days.get(14)).toHaveLength(2);
  });
});

describe('muscleSets', () => {
  it('counts completed working sets per primary muscle', () => {
    const ex = new Map<string, Exercise>([
      ['bench', { id: 'bench', name: 'Bench', primaryMuscle: 'chest', equipment: 'barbell', isCustom: false, createdAt: 0 }],
      ['row', { id: 'row', name: 'Row', primaryMuscle: 'upper back', equipment: 'barbell', isCustom: false, createdAt: 0 }],
    ]);
    const ws = [workout('a', at(2025, 9, 14), { bench: [set(1, 1), set(1, 1), set(1, 1, { type: 'warmup' })], row: [set(1, 1)] })];
    expect(muscleSets(ws, ex, weekStart(NOW), addWeeks(weekStart(NOW), 1))).toEqual([
      { muscle: 'chest', sets: 2 },
      { muscle: 'upper back', sets: 1 },
    ]);
  });
});
