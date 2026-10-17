import type { Equipment, Muscle } from '../../db/types';

export interface IdentifyMatch {
  exerciseId: string;
  /** 0–1 */
  confidence: number;
  reason: string;
}

export interface NewExerciseSuggestion {
  nameEs: string;
  nameEn: string;
  primaryMuscle: Muscle;
  equipment: Equipment;
  reason: string;
}

export interface IdentifyResult {
  source: 'claude' | 'local';
  matches: IdentifyMatch[];
  newExercise: NewExerciseSuggestion | null;
  /** A follow-up question when the description is too vague to decide. */
  question: string | null;
  /** Why the local matcher was used instead of Claude, if it was. */
  fallbackReason?: 'no-key' | 'offline' | 'network' | 'error';
}

export type IdentifyErrorCode = 'auth' | 'rate' | 'network' | 'refusal' | 'bad-output' | 'overloaded' | 'other';

export class IdentifyError extends Error {
  constructor(public code: IdentifyErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'IdentifyError';
  }
}
