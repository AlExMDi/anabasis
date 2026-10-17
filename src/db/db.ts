import Dexie, { type EntityTable } from 'dexie';
import { SEED_EXERCISES } from './seed';
import type { AiSecret, Exercise, RestTimerState, Routine, Settings, Workout } from './types';

export class AnabasisDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  timers!: EntityTable<RestTimerState, 'id'>;
  secrets!: EntityTable<AiSecret, 'id'>;

  constructor(name = 'anabasis') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, primaryMuscle, isCustom',
      routines: 'id, updatedAt',
      workouts: 'id, status, startedAt',
      settings: 'id',
      timers: 'id',
    });
    // v2: language setting, exercise descriptions/aliases (unindexed, optional) and
    // a separate table for the AI key so backups can never include it.
    this.version(2).stores({ secrets: 'id' });
    // Runs only when the database is created for the first time.
    this.on('populate', (tx) => {
      void tx.table('exercises').bulkAdd(SEED_EXERCISES);
    });
  }
}

export const db = new AnabasisDB();

/** Clears every table and restores the seeded exercise library. */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.routines, db.workouts, db.settings, db.timers, db.secrets], async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.exercises.bulkAdd(SEED_EXERCISES);
  });
}
