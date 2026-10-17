import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase } from '../db/db';
import { SEED_EXERCISES } from '../db/seed';
import { DEFAULT_SETTINGS } from '../db/types';
import { set, workout } from '../test/factories';
import { BACKUP_VERSION, buildBackup, exportBackup, parseBackupText, readAllData, restoreBackup, validateBackup, type BackupData } from './backup';
import { workoutsToCsv } from './csv';

function sampleData(): BackupData {
  return {
    exercises: [
      ...SEED_EXERCISES.slice(0, 3),
      { id: 'custom-1', name: 'Zercher Squat', primaryMuscle: 'quadriceps', equipment: 'barbell', isCustom: true, createdAt: 5, restSeconds: 120 },
    ],
    routines: [
      {
        id: 'r1', name: 'Push', notes: '', createdAt: 1, updatedAt: 2,
        exercises: [{ id: 're1', exerciseId: SEED_EXERCISES[0]!.id, sets: [{ id: 'rs1', weight: 60, reps: 8, type: 'normal' }] }],
      },
    ],
    workouts: [workout('w1', 1_700_000_000_000, { [SEED_EXERCISES[0]!.id]: [set(100, 5)], 'custom-1': [set(80, 8, { rpe: 8.5 })] })],
    settings: { ...DEFAULT_SETTINGS, unit: 'lb', defaultRestSeconds: 120 },
  };
}

describe('validateBackup', () => {
  it('accepts a well-formed backup and strips unknown keys', () => {
    const file = buildBackup(sampleData());
    const json = JSON.parse(JSON.stringify(file));
    json.data.exercises[0].evil = '<script>';
    const res = validateBackup(json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.workouts).toHaveLength(1);
      expect(res.data.settings.unit).toBe('lb');
      expect('evil' in res.data.exercises[0]!).toBe(false);
    }
  });

  it.each([
    ['not an object', 42, /not a JSON object/],
    ['wrong app', { app: 'other', version: 1, data: {} }, /not an Anabasis backup/],
    ['future version', { app: 'anabasis', version: BACKUP_VERSION + 1, data: {} }, /Unsupported backup version/],
    ['missing data', { app: 'anabasis', version: 1 }, /missing its "data"/],
  ])('rejects %s', (_label, input, pattern) => {
    const res = validateBackup(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join('\n')).toMatch(pattern);
  });

  it('reports field-level errors with paths', () => {
    const json = JSON.parse(JSON.stringify(buildBackup(sampleData())));
    json.data.workouts[0].exercises[0].sets[0].reps = -3;
    json.data.workouts[0].exercises[0].sets[0].type = 'mega';
    json.data.exercises[1].primaryMuscle = 'nose';
    json.data.routines[0].exercises[0].exerciseId = 'missing';
    json.data.workouts.push({ ...json.data.workouts[0] }); // duplicate id
    const res = validateBackup(json);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const all = res.errors.join('\n');
    expect(all).toContain('data.workouts[0].exercises[0].sets[0].reps');
    expect(all).toContain('data.workouts[0].exercises[0].sets[0].type');
    expect(all).toContain('data.exercises[1].primaryMuscle');
    expect(all).toContain('unknown exercise "missing"');
    expect(all).toContain('duplicate id "w1"');
  });

  it('rejects a completed workout without an end time', () => {
    const json = JSON.parse(JSON.stringify(buildBackup(sampleData())));
    json.data.workouts[0].endedAt = null;
    const res = validateBackup(json);
    expect(res.ok).toBe(false);
  });

  it('handles invalid JSON text without throwing', () => {
    const res = parseBackupText('{ nope');
    expect(res).toEqual({ ok: false, errors: ['File is not valid JSON.'] });
  });
});

describe('export / restore round trip', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('exports everything, records the backup date, and restores it exactly', async () => {
    const data = sampleData();
    await restoreBackup(data);

    const now = new Date('2026-10-01T10:00:00Z');
    const file = await exportBackup(now);
    expect(file.app).toBe('anabasis');
    expect(file.exportedAt).toBe(now.toISOString());
    expect(file.data.settings.lastBackupAt).toBe(now.getTime());
    expect((await db.settings.get('app'))!.lastBackupAt).toBe(now.getTime());

    // Simulate a fresh device: wipe, then import the serialised file.
    await resetDatabase();
    expect(await db.workouts.count()).toBe(0);
    const parsed = parseBackupText(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await restoreBackup(parsed.data);

    const restored = await readAllData();
    const byId = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
    expect(byId(restored.exercises)).toEqual(byId(data.exercises));
    expect(restored.routines).toEqual(data.routines);
    expect(restored.workouts).toEqual(data.workouts);
    expect(restored.settings).toEqual({ ...data.settings, lastBackupAt: now.getTime() });
  });

  it('leaves existing data untouched when a restore fails midway', async () => {
    await restoreBackup(sampleData());
    const bad = sampleData();
    bad.workouts.push({ ...bad.workouts[0]! }); // duplicate primary key -> bulkAdd throws
    await expect(restoreBackup(bad)).rejects.toThrow();
    expect(await db.workouts.count()).toBe(1);
    expect(await db.routines.count()).toBe(1);
  });
});

describe('workoutsToCsv', () => {
  it('writes one row per set, converts units and escapes text', () => {
    const data = sampleData();
    data.workouts[0]!.name = 'Push, "heavy"';
    const csv = workoutsToCsv(data.workouts, data.exercises, 'kg').trim().split('\n');
    expect(csv[0]).toContain('weight_kg');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain('"Push, ""heavy"""');
    expect(csv[1]).toContain(',Bench Press,1,normal,100,5,,yes,116.67');
    const lb = workoutsToCsv(data.workouts, data.exercises, 'lb');
    expect(lb).toContain('weight_lb');
    expect(lb).toContain(',220.46,5,');
  });
});
