import { describe, expect, it } from 'vitest';
import { set, workout } from '../test/factories';
import { allTimeBests, detectPRs, prsByWorkout } from './prs';

describe('detectPRs', () => {
  it('treats the first session as a baseline (no PRs)', () => {
    expect(detectPRs([workout('a', 1, { bench: [set(100, 5)] })])).toEqual([]);
  });

  it('detects each PR type once per session, on the best set', () => {
    const s1 = set(100, 5);
    const s2a = set(105, 3); // heaviest
    const s2b = set(95, 8); // best e1RM (120.3) and set volume (760)
    const ws = [workout('a', 1, { bench: [s1] }), workout('b', 2, { bench: [s2a, s2b] })];
    const prs = detectPRs(ws);
    const byType = Object.fromEntries(prs.map((p) => [p.type, p]));
    expect(Object.keys(byType).sort()).toEqual(['e1rm', 'sessionVolume', 'setVolume', 'weight']);
    expect(byType.weight).toMatchObject({ setId: s2a.id, value: 105, previous: 100, workoutId: 'b' });
    expect(byType.e1rm!.setId).toBe(s2b.id);
    expect(byType.setVolume).toMatchObject({ setId: s2b.id, value: 760, previous: 500 });
    expect(byType.sessionVolume).toMatchObject({ setId: null, value: 315 + 760 });
  });

  it('ignores ties, warm-ups and incomplete sets', () => {
    const ws = [
      workout('a', 1, { bench: [set(100, 5)] }),
      workout('b', 2, { bench: [set(100, 5), set(200, 1, { type: 'warmup' }), set(200, 1, { completed: false })] }),
    ];
    expect(detectPRs(ws)).toEqual([]);
  });

  it('replays chronologically regardless of input order and tracks exercises independently', () => {
    const ws = [
      workout('c', 3, { bench: [set(110, 5)], squat: [set(150, 5)] }),
      workout('a', 1, { bench: [set(100, 5)] }),
      workout('b', 2, { bench: [set(90, 5)], squat: [set(140, 5)] }),
    ];
    const prs = detectPRs(ws);
    expect(prs.every((p) => p.workoutId === 'c')).toBe(true);
    const map = prsByWorkout(prs);
    expect(map.get('c')!.filter((p) => p.exerciseId === 'bench')).toHaveLength(4);
    expect(map.get('c')!.filter((p) => p.exerciseId === 'squat')).toHaveLength(4);
  });

  it('skips active workouts', () => {
    const active = { ...workout('b', 2, { bench: [set(200, 5)] }), status: 'active' as const, endedAt: null };
    expect(detectPRs([workout('a', 1, { bench: [set(100, 5)] }), active])).toEqual([]);
  });
});

describe('allTimeBests', () => {
  it('returns null without history and the maxima otherwise', () => {
    expect(allTimeBests([], 'bench')).toBeNull();
    const b = allTimeBests([workout('a', 1, { bench: [set(100, 5), set(80, 10)] }), workout('b', 2, { bench: [set(102.5, 2)] })], 'bench');
    expect(b).toMatchObject({ weight: 102.5, setVolume: 800, sessionVolume: 1300 });
    expect(b!.e1rm).toBeCloseTo(116.667, 2);
  });
});
