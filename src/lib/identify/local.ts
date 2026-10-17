import { seedKeywords, seedSpanishName } from '../../db/seedEs';
import type { Exercise } from '../../db/types';
import { makeT } from '../../i18n';
import type { IdentifyMatch } from './types';

// Words that carry no information about the movement.
const STOP = new Set(
  ('a al algo asi como con de del el ella en es esa ese eso esta este esto hacia hago hay la las le lo los me mi mis muy no o ' +
    'para pero poco por que se sin sobre su sus te tipo un una uno unos y ya yo the and with of to my i it on in an is ' +
    'ejercicio ejercicios entrenador entreno hacer hace hacemos hacia vez veces luego despues primero mientras').split(' '),
);

// Collapse common synonyms onto one canonical word before stemming.
const SYNONYMS: Record<string, string> = {
  acostado: 'tumbado', echado: 'tumbado', estirado: 'tumbado', recostado: 'tumbado', lying: 'tumbado',
  jalar: 'tirar', jalo: 'tirar', jalando: 'tirar', tiro: 'tirar', tirando: 'tirar', pull: 'tirar', traccion: 'tirar',
  empujo: 'empujar', empujando: 'empujar', push: 'empujar', press: 'empujar', presionar: 'empujar',
  cable: 'polea', cables: 'polea', poleas: 'polea', pesas: 'mancuerna', pesa: 'mancuerna', dumbbell: 'mancuerna',
  barbell: 'barra', machine: 'maquina', aparato: 'maquina', maquinas: 'maquina',
  rusa: 'kettlebell', goma: 'banda', elastico: 'banda', elastica: 'banda', liga: 'banda',
  culo: 'gluteo', nalgas: 'gluteo', gemelo: 'gemelos', pantorrilla: 'gemelos', pantorrillas: 'gemelos',
  abdominales: 'abdomen', abs: 'abdomen', barriga: 'abdomen', tripa: 'abdomen', core: 'abdomen',
  espalda: 'espalda', dorsal: 'espalda', dorsales: 'espalda', hombro: 'hombros', deltoides: 'hombros',
  muslo: 'piernas', muslos: 'piernas', pierna: 'piernas', cuadriceps: 'cuadriceps', femoral: 'isquios', femorales: 'isquios',
  arriba: 'arriba', subo: 'subir', subiendo: 'subir', levanto: 'levantar', levantando: 'levantar', bajo: 'bajar', bajando: 'bajar',
  doblo: 'doblar', flexiono: 'doblar', flexionar: 'doblar', estiro: 'estirar', extiendo: 'estirar', extender: 'estirar',
  agachado: 'inclinado', inclinandome: 'inclinado', doblado: 'inclinado', paralelas: 'paralelas',
  silla: 'sentado', sentada: 'sentado', sentarse: 'sentado', parado: 'pie', parada: 'pie', standing: 'pie',
};

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s-]/g, ' ');
}

/** Crude stemmer: prefix of 5 letters makes "empujo", "empujar", "empujando" collide. */
function stem(word: string): string {
  return word.length <= 5 ? word.replace(/s$/, '') : word.slice(0, 5);
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => stem(normalize(SYNONYMS[w] ?? w).trim()));
}

interface Doc {
  id: string;
  /** stem -> weight (names count more than keywords) */
  terms: Map<string, number>;
}

function buildDoc(ex: Exercise): Doc {
  const terms = new Map<string, number>();
  const add = (text: string | undefined, weight: number) => {
    if (!text) return;
    for (const t of tokens(text)) terms.set(t, Math.max(terms.get(t) ?? 0, weight));
  };
  const es = makeT('es');
  const en = makeT('en');
  add(seedKeywords(ex.id), 1);
  add(ex.description, 1.2);
  add(es(`muscle.${ex.primaryMuscle}`), 0.8);
  add(en(`muscle.${ex.primaryMuscle}`), 0.8);
  add(es(`equipment.${ex.equipment}`), 1);
  add(ex.equipment, 1);
  add(ex.name, 1.5);
  add(seedSpanishName(ex.id), 1.5);
  for (const a of ex.aliases ?? []) add(a, 2);
  return { id: ex.id, terms };
}

/**
 * Offline fallback: TF-IDF-style keyword scoring against names, aliases, your saved
 * descriptions and a hand-written vocabulary of how each movement looks.
 */
export function identifyLocally(description: string, exercises: Exercise[], limit = 5): IdentifyMatch[] {
  const query = [...new Set(tokens(description))];
  if (query.length === 0) return [];
  const docs = exercises.map(buildDoc);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + docs.length / (1 + (df.get(t) ?? 0)));
  const maxScore = query.reduce((s, t) => s + idf(t) * 2, 0);

  const scored = docs
    .map((d) => {
      let score = 0;
      const hits: string[] = [];
      for (const t of query) {
        const w = d.terms.get(t);
        if (w) { score += w * idf(t); hits.push(t); }
      }
      return { id: d.id, score, hits };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => ({
    exerciseId: s.id,
    confidence: Math.min(0.95, s.score / maxScore + 0.1),
    reason: s.hits.join(', '),
  }));
}
