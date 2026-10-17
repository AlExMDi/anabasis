import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../../db/seed';
import { libraryListing, parseClaudeOutput } from './claude';
import { IdentifyError } from './types';

const BENCH = 'seed-bench-press';

describe('parseClaudeOutput', () => {
  it('keeps only ids that exist, deduped and clamped', () => {
    const out = parseClaudeOutput(JSON.stringify({
      matches: [
        { exerciseId: BENCH, confidence: 1.4, reason: 'barra al pecho' },
        { exerciseId: 'made-up', confidence: 0.9, reason: '' },
        { exerciseId: BENCH, confidence: 0.2, reason: 'dup' },
      ],
      newExercise: { suggest: false },
      question: '',
    }), SEED_EXERCISES);
    expect(out.matches).toEqual([{ exerciseId: BENCH, confidence: 1, reason: 'barra al pecho' }]);
    expect(out.newExercise).toBeNull();
    expect(out.question).toBeNull();
  });

  it('sanitizes a new-exercise suggestion', () => {
    const out = parseClaudeOutput(JSON.stringify({
      matches: [],
      newExercise: { suggest: true, nameEs: '  Almeja con goma ', nameEn: 'Banded clamshell', primaryMuscle: 'butt', equipment: 'band', reason: 'r' },
      question: null,
    }), SEED_EXERCISES);
    expect(out.newExercise).toEqual({ nameEs: 'Almeja con goma', nameEn: 'Banded clamshell', primaryMuscle: 'full body', equipment: 'band', reason: 'r' });
  });

  it('rejects invalid or empty answers', () => {
    expect(() => parseClaudeOutput('not json', SEED_EXERCISES)).toThrow(IdentifyError);
    expect(() => parseClaudeOutput('{"matches":[{"exerciseId":"nope"}]}', SEED_EXERCISES)).toThrow(IdentifyError);
  });
});

describe('libraryListing', () => {
  it('lists every exercise with its id, without leaking secrets', () => {
    const text = libraryListing(SEED_EXERCISES);
    for (const e of SEED_EXERCISES) expect(text).toContain(e.id);
    expect(text).not.toMatch(/sk-ant-/);
  });
});
