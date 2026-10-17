import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber, parseDecimal } from '../lib/units';

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  min?: number;
  max: number;
  integer?: boolean;
  placeholder?: string;
  suffix?: string;
  className?: string;
}

/**
 * Numeric input with − / + steppers. Keeps its own text while focused so partial
 * input like "82," survives re-renders driven by IndexedDB live queries; only
 * valid numbers are reported upward.
 */
export function NumberField({ label, value, onChange, step, min = 0, max, integer, placeholder, suffix, className }: Props) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : formatPlain(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  // Latest text, read synchronously so rapid taps on +/− compound even before
  // the IndexedDB round trip re-renders us with the new value.
  const textRef = useRef(text);
  const setTextBoth = (t: string) => { textRef.current = t; setText(t); };

  useEffect(() => {
    if (!focused.current) {
      setTextBoth(value === null ? '' : formatPlain(value));
      setInvalid(false);
    }
  }, [value]);

  const commitText = (t: string) => {
    setTextBoth(t);
    const n = parseDecimal(t);
    if (n === null) { setInvalid(false); onChange(null); return; }
    const ok = !Number.isNaN(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
    setInvalid(!ok);
    if (ok) onChange(n);
  };

  const bump = (dir: 1 | -1) => {
    const current = parseDecimal(textRef.current);
    const base = current ?? (placeholder ? parseDecimal(placeholder) : null) ?? 0;
    const raw = Number.isNaN(base) ? 0 : base;
    let next = Math.round((raw + dir * step) * 1000) / 1000;
    next = Math.min(max, Math.max(min, next));
    setTextBoth(formatPlain(next));
    setInvalid(false);
    onChange(next);
  };

  return (
    <div className={`stepper ${className ?? ''}`} data-invalid={invalid}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-1)}>−</button>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        pattern={integer ? '[0-9]*' : undefined}
        autoComplete="off"
        enterKeyHint="done"
        placeholder={placeholder}
        value={text}
        aria-invalid={invalid}
        onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
        onBlur={() => {
          focused.current = false;
          if (invalid || text.trim() === '') setTextBoth(value === null ? '' : formatPlain(value));
          setInvalid(false);
        }}
        onChange={(e) => commitText(e.target.value)}
      />
      {suffix && <span className="stepper__unit">{suffix}</span>}
      <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(1)}>+</button>
    </div>
  );
}

function formatPlain(n: number): string {
  return formatNumber(n, 2).replace(/,/g, '');
}
