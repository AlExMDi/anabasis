import type { AiSecret, Exercise, Lang } from '../../db/types';
import { identifyWithClaude } from './claude';
import { identifyLocally } from './local';
import { IdentifyError, type IdentifyResult } from './types';

export * from './types';

/**
 * Claude when a key is saved and we're online; otherwise (or if the network
 * fails) the offline keyword matcher, so identifying never dead-ends at the gym.
 * Auth/rate/refusal errors are surfaced instead, because they need the user's attention.
 */
export async function identifyExercise(description: string, exercises: Exercise[], secret: AiSecret | null, lang: Lang): Promise<IdentifyResult> {
  const local = (fallbackReason: IdentifyResult['fallbackReason']): IdentifyResult => ({
    source: 'local',
    matches: identifyLocally(description, exercises),
    newExercise: null,
    question: null,
    fallbackReason,
  });
  if (!secret?.apiKey) return local('no-key');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return local('offline');
  try {
    return { source: 'claude', ...(await identifyWithClaude(description, exercises, { apiKey: secret.apiKey, model: secret.model, lang })) };
  } catch (err) {
    if (err instanceof IdentifyError && (err.code === 'network' || err.code === 'overloaded')) return local('network');
    throw err;
  }
}
