import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Equipment, Exercise, Lang, Muscle } from '../db/types';
import { seedSpanishName } from '../db/seedEs';
import { setFormatLocale } from '../lib/format';
import { en, type Dict } from './en';
import { es } from './es';

export type TKey = keyof Dict;
export type TFn = (key: TKey, vars?: Record<string, string | number>) => string;

const DICTS: Record<Lang, Dict> = { en, es };
export const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-ES' };

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function makeT(lang: Lang): TFn {
  const dict = DICTS[lang];
  return (key, vars) => {
    let s: string = dict[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

/** Name shown for an exercise: seeded ones have a Spanish translation; custom ones keep yours. */
export function exerciseName(ex: Pick<Exercise, 'id' | 'name' | 'isCustom'> | undefined, lang: Lang): string {
  if (!ex) return lang === 'es' ? 'Ejercicio desconocido' : 'Unknown exercise';
  if (lang === 'es' && !ex.isCustom) return seedSpanishName(ex.id) ?? ex.name;
  return ex.name;
}

export interface I18n {
  lang: Lang;
  locale: string;
  t: TFn;
  /** Plural helper: tn('home.streak', 3) picks 'home.streak.one' / '.other'. */
  tn: (base: string, n: number, vars?: Record<string, string | number>) => string;
  exName: (ex: Pick<Exercise, 'id' | 'name' | 'isCustom'> | undefined) => string;
  muscle: (m: Muscle) => string;
  equipment: (e: Equipment) => string;
}

function build(lang: Lang): I18n {
  const t = makeT(lang);
  return {
    lang,
    locale: LOCALES[lang],
    t,
    tn: (base, n, vars) => t(`${base}.${n === 1 ? 'one' : 'other'}` as TKey, { n, ...vars }),
    exName: (ex) => exerciseName(ex, lang),
    muscle: (m) => t(`muscle.${m}` as TKey),
    equipment: (e) => t(`equipment.${e}` as TKey),
  };
}

export const I18nContext = createContext<I18n>(build('en'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => build(lang), [lang]);
  // Formatting helpers are plain functions used everywhere; keep their locale in sync.
  setFormatLocale(value.locale);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
