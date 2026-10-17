import { EQUIPMENT, MUSCLES, type AiModel, type Exercise, type Lang } from '../../db/types';
import { seedSpanishName } from '../../db/seedEs';
import { IdentifyError, type IdentifyMatch, type IdentifyResult, type NewExerciseSuggestion } from './types';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matches', 'newExercise', 'question'],
  properties: {
    matches: {
      type: 'array',
      description: 'Up to 3 library exercises, best first. Empty if none fits.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['exerciseId', 'confidence', 'reason'],
        properties: {
          exerciseId: { type: 'string', description: 'An id from the library list.' },
          confidence: { type: 'number', description: '0 to 1.' },
          reason: { type: 'string', description: 'One short sentence in the user language.' },
        },
      },
    },
    newExercise: {
      type: 'object',
      additionalProperties: false,
      required: ['suggest', 'nameEs', 'nameEn', 'primaryMuscle', 'equipment', 'reason'],
      properties: {
        suggest: { type: 'boolean', description: 'true only if no library exercise fits well.' },
        nameEs: { type: 'string' },
        nameEn: { type: 'string' },
        primaryMuscle: { type: 'string', enum: [...MUSCLES] },
        equipment: { type: 'string', enum: [...EQUIPMENT] },
        reason: { type: 'string' },
      },
    },
    question: { type: 'string', description: 'A short clarifying question if the description is too vague, else "".' },
  },
} as const;

function systemPrompt(lang: Lang): string {
  const language = lang === 'es' ? 'Spanish (Spain)' : 'English';
  return [
    'You help someone log gym workouts. Their personal trainer shows them exercises without saying the name,',
    'so they describe what they did in their own words (often in Spanish, sometimes vague, sometimes dictated with typos).',
    'Pick the exercise(s) from the library that match the description.',
    '',
    'Guidance:',
    '- Reason about body position (standing, seated, lying face up/down, kneeling, hanging), equipment (barbell, dumbbells, cable/pulley, machine, band, bodyweight), the joint that moves and the direction of force.',
    '- Return up to 3 matches ordered by likelihood, with honest confidence: 0.8+ only when the description clearly fits one exercise.',
    '- If nothing in the library fits, set newExercise.suggest to true and propose a conventional gym name in Spanish and English, its primary muscle and equipment. Otherwise set suggest to false (fill the other fields with your best guess anyway).',
    '- If the description could be several quite different exercises, ask one short question in "question"; otherwise use "".',
    `- Write "reason" and "question" in ${language}, addressed to the user, one sentence each.`,
    '- Library entries may include notes the user wrote earlier ("notes:"); treat them as strong hints.',
  ].join('\n');
}

export function libraryListing(exercises: Exercise[]): string {
  return exercises
    .map((e) => {
      const parts = [e.id, e.name];
      const es = seedSpanishName(e.id);
      if (es && es !== e.name) parts.push(es);
      parts.push(e.primaryMuscle, e.equipment);
      if (e.aliases?.length) parts.push(`aka: ${e.aliases.join(' / ')}`);
      if (e.description) parts.push(`notes: ${e.description.replace(/\s+/g, ' ').slice(0, 200)}`);
      return parts.join(' | ');
    })
    .join('\n');
}

/** Validates the model output against the real library; never trusts ids blindly. */
export function parseClaudeOutput(text: string, exercises: Exercise[]): Omit<IdentifyResult, 'source'> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new IdentifyError('bad-output');
  }
  const obj = raw as { matches?: unknown; newExercise?: unknown; question?: unknown };
  const ids = new Set(exercises.map((e) => e.id));
  const matches: IdentifyMatch[] = [];
  if (Array.isArray(obj.matches)) {
    for (const m of obj.matches as Record<string, unknown>[]) {
      if (typeof m?.exerciseId !== 'string' || !ids.has(m.exerciseId)) continue;
      if (matches.some((x) => x.exerciseId === m.exerciseId)) continue;
      const c = typeof m.confidence === 'number' && Number.isFinite(m.confidence) ? m.confidence : 0.5;
      matches.push({ exerciseId: m.exerciseId, confidence: Math.min(1, Math.max(0, c)), reason: typeof m.reason === 'string' ? m.reason : '' });
    }
  }
  let newExercise: NewExerciseSuggestion | null = null;
  const n = obj.newExercise as Record<string, unknown> | undefined;
  if (n && n.suggest === true && typeof n.nameEs === 'string' && n.nameEs.trim()) {
    newExercise = {
      nameEs: n.nameEs.trim().slice(0, 80),
      nameEn: typeof n.nameEn === 'string' ? n.nameEn.trim().slice(0, 80) : '',
      primaryMuscle: (MUSCLES as readonly string[]).includes(n.primaryMuscle as string) ? (n.primaryMuscle as NewExerciseSuggestion['primaryMuscle']) : 'full body',
      equipment: (EQUIPMENT as readonly string[]).includes(n.equipment as string) ? (n.equipment as NewExerciseSuggestion['equipment']) : 'other',
      reason: typeof n.reason === 'string' ? n.reason : '',
    };
  }
  const question = typeof obj.question === 'string' && obj.question.trim() ? obj.question.trim() : null;
  if (matches.length === 0 && !newExercise && !question) throw new IdentifyError('bad-output');
  return { matches: matches.slice(0, 3), newExercise, question };
}

async function client(apiKey: string) {
  // Loaded on demand so the SDK isn't in the main bundle.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Bring-your-own-key: the key is the user's, stored only on their device, and
  // requests go straight from the phone to api.anthropic.com (no server of ours).
  return { Anthropic, client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 }) };
}

async function mapError(err: unknown): Promise<IdentifyError> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (err instanceof IdentifyError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new IdentifyError('auth');
  if (err instanceof Anthropic.RateLimitError) return new IdentifyError('rate');
  if (err instanceof Anthropic.APIConnectionError) return new IdentifyError('network');
  if (err instanceof Anthropic.InternalServerError) return new IdentifyError('overloaded');
  if (err instanceof Anthropic.APIError) return new IdentifyError('other', err.message);
  return new IdentifyError('network');
}

export interface ClaudeOptions {
  apiKey: string;
  model: AiModel;
  lang: Lang;
}

export async function identifyWithClaude(description: string, exercises: Exercise[], opts: ClaudeOptions): Promise<Omit<IdentifyResult, 'source'>> {
  try {
    const { client: c } = await client(opts.apiKey);
    const response = await c.beta.messages.create({
      model: opts.model,
      max_tokens: 8000,
      // Opus can decline via safety classifiers; "default" retries on Anthropic's
      // recommended fallback model. Haiku has no server-side fallback.
      ...(opts.model === 'claude-opus-5-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      // A short classification: low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: [
        { type: 'text', text: systemPrompt(opts.lang) },
        { type: 'text', text: `Library (id | name | Spanish name | primary muscle | equipment | …):\n${libraryListing(exercises)}` },
      ],
      messages: [{ role: 'user', content: `Description: ${description.trim()}` }],
    });
    if (response.stop_reason === 'refusal') throw new IdentifyError('refusal');
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return parseClaudeOutput(text, exercises);
  } catch (err) {
    throw await mapError(err);
  }
}

/** Cheap key check: retrieving a model costs nothing. */
export async function testApiKey(apiKey: string, model: AiModel): Promise<void> {
  try {
    const { client: c } = await client(apiKey);
    await c.models.retrieve(model);
  } catch (err) {
    throw await mapError(err);
  }
}
