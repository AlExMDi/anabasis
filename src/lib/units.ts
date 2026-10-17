import type { Unit } from '../db/types';
import { getFormatLocale } from './format';

export const KG_PER_LB = 0.45359237;

/** Converts a stored kg value to the display unit, rounded to 2 decimals. */
export function toDisplayWeight(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(v * 100) / 100;
}

/** Converts a value typed in the display unit back to kg for storage. */
export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function weightStep(unit: Unit): number {
  return unit === 'kg' ? 2.5 : 5;
}

export function formatWeight(kg: number | null, unit: Unit): string {
  if (kg === null) return '–';
  return `${formatNumber(toDisplayWeight(kg, unit))} ${unit}`;
}

export function formatNumber(n: number, maxDecimals = 2): string {
  return n.toLocaleString(getFormatLocale(), { maximumFractionDigits: maxDecimals });
}

/** Large totals (volume) read better without decimals. */
export function formatVolume(kg: number, unit: Unit): string {
  return `${Math.round(toDisplayWeight(kg, unit)).toLocaleString(getFormatLocale())} ${unit}`;
}

/** Value for an editable field: no grouping separators, locale decimal mark. */
export function formatInputNumber(n: number): string {
  const s = String(Math.round(n * 100) / 100);
  return getFormatLocale().startsWith('es') ? s.replace('.', ',') : s;
}

/** Parses user input, accepting a comma as decimal separator (es-ES iOS keyboards). */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return Number.NaN;
  return Number(t);
}
