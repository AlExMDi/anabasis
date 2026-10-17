import { describe, expect, it } from 'vitest';
import { set, workout } from '../test/factories';
import { completedSetCount, epley1RM, exerciseHistory, exerciseVolume, setVolume, workoutVolume } from './calc';

describe('epley1RM', () => {
  it('applies w × (1 + reps/30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley1RM(80, 5)).toBeCloseTo(93.333, 3);
    expect(epley1RM(60, 30)).toBe(120);
  });
  it('returns the weight itself for a single rep', () => {
    expect(epley1RM(140, 1)).toBe(140);
  });
  it('returns 0 for missing or non-positive input', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(-10, 5)).toBe(0);
    expect(epley1RM(Number.NaN, 5)).toBe(0);
  });
});

describe('volume', () => {
  it('multiplies weight by reps, treating null as 0', () => {
    expect(setVolume({ weight: 100, reps: 5 })).toBe(500);
    expect(setVolume({ weight: null, reps: 12 })).toBe(0);
  });

  it('counts only completed, non-warm-up sets', () => {
    const w = workout('w1', 0, {
      bench: [
        set(40, 10, { type: 'warmup' }),
        set(100, 5),
        set(100, 5, { type: 'failure' }),
        set(80, 8, { type: 'drop' }),
        set(100, 5, { completed: false }),
      ],
      squat: [set(140, 3)],
    });
    expect(exerciseVolume(w.exercises[0]!)).toBe(500 + 500 + 640);
    expect(workoutVolume(w)).toBe(1640 + 420);
    expect(completedSetCount(w)).toBe(5);
  });
});

describe('exerciseHistory', () => {
  it('summarises each session oldest-first and skips sessions without working sets', () => {
    const ws = [
      workout('b', 2000, { bench: [set(100, 5), set(90, 10)] }),
      workout('a', 1000, { bench: [set(95, 5)] }),
      workout('c', 3000, { bench: [set(50, 10, { type: 'warmup' })] }),
      workout('d', 4000, { squat: [set(100, 5)] }),
    ];
    const h = exerciseHistory(ws, 'bench');
    expect(h.map((x) => x.workoutId)).toEqual(['a', 'b']);
    expect(h[1]!.bestWeight).toBe(100);
    expect(h[1]!.best1RM).toBeCloseTo(120); // 90 × (1 + 10/30)
    expect(h[1]!.bestSet).toEqual({ weight: 90, reps: 10 });
    expect(h[1]!.volume).toBe(1400);
  });
});
