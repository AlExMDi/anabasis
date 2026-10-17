import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../db/seed';
import { seedKeywords, seedSpanishName } from '../db/seedEs';
import { EQUIPMENT, MUSCLES } from '../db/types';
import { en } from './en';
import { es } from './es';
import { exerciseName, makeT } from './index';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('have the same keys and placeholders', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect([k, vars(es[k])]).toEqual([k, vars(en[k])]);
  });

  it('label every muscle and equipment', () => {
    const t = makeT('es');
    for (const m of MUSCLES) expect(t(`muscle.${m}`)).not.toMatch(/^muscle\./);
    for (const q of EQUIPMENT) expect(t(`equipment.${q}`)).not.toMatch(/^equipment\./);
  });

  it('interpolates and pluralizes', () => {
    const t = makeT('es');
    expect(t('history.prCount.one', { n: 1 })).toContain('1');
  });
});

describe('Spanish seed data', () => {
  it('covers every seed exercise with a name and keywords', () => {
    for (const e of SEED_EXERCISES) {
      expect(seedSpanishName(e.id), e.name).toBeTruthy();
      expect(seedKeywords(e.id).length, e.name).toBeGreaterThan(0);
    }
  });

  it('uses the Spanish name only for seeds', () => {
    const seed = SEED_EXERCISES.find((e) => e.id === 'seed-bench-press')!;
    expect(exerciseName(seed, 'es')).not.toBe(seed.name);
    expect(exerciseName(seed, 'en')).toBe(seed.name);
    expect(exerciseName({ id: 'c', name: 'Mi ejercicio', isCustom: true }, 'en')).toBe('Mi ejercicio');
  });
});
