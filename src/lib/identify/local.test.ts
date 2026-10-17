import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, slugify } from '../../db/seed';
import type { Exercise } from '../../db/types';
import { identifyLocally, normalize } from './local';

const top = (text: string, list: Exercise[] = SEED_EXERCISES) => identifyLocally(text, list, 3).map((m) => m.exerciseId);
const id = (en: string) => `seed-${slugify(en)}`;

describe('identifyLocally', () => {
  it('normalizes accents and case', () => {
    expect(normalize('Máquina ÑANDÚ')).toBe('maquina nandu');
  });

  it.each([
    ['tumbado en un banco plano bajando la barra al pecho y empujando hacia arriba', 'Bench Press'],
    ['sentado en una máquina tirando de una barra desde arriba hacia el pecho', 'Lat Pulldown'],
    ['de pie con mancuernas doblando los codos para subirlas, bíceps', 'Dumbbell Curl'],
    ['con la barra en la espalda bajar flexionando las rodillas como sentarse y subir', 'Squat'],
    ['de pie en la polea alta empujando la cuerda hacia abajo estirando los codos', 'Rope Pushdown'],
    ['sentado empujando una plataforma con los pies, prensa de piernas', 'Leg Press'],
  ])('finds "%s"', (text, expected) => {
    expect(top(text)).toContain(id(expected));
  });

  it('uses your own aliases and notes', () => {
    const custom: Exercise = {
      id: 'c1', name: 'Mystery move', primaryMuscle: 'glutes', equipment: 'band', isCustom: true, createdAt: 0,
      aliases: ['la almeja'], description: 'tumbado de lado con la goma en las rodillas abriendo la pierna',
    };
    const list = [...SEED_EXERCISES, custom];
    expect(top('la almeja', list)[0]).toBe('c1');
    expect(top('de lado con una goma en las rodillas abriendo', list)).toContain('c1');
  });

  it('returns nothing for noise', () => {
    expect(identifyLocally('el de ayer', SEED_EXERCISES)).toEqual([]);
  });

  it('confidences are within 0..1 and sorted', () => {
    const res = identifyLocally('remo con barra inclinado', SEED_EXERCISES);
    for (const m of res) expect(m.confidence).toBeGreaterThanOrEqual(0);
    for (const m of res) expect(m.confidence).toBeLessThanOrEqual(1);
    expect([...res].sort((a, b) => b.confidence - a.confidence)).toEqual(res);
  });
});
