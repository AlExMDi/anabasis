import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (v: string) => void;
};

/** Text input that writes on every keystroke but only resyncs from props when not focused. */
export function TextField({ value, onCommit, ...rest }: Props) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  return (
    <input
      {...rest}
      value={text}
      onFocus={(e) => { focused.current = true; rest.onFocus?.(e); }}
      onBlur={(e) => { focused.current = false; rest.onBlur?.(e); }}
      onChange={(e) => { setText(e.target.value); onCommit(e.target.value); }}
    />
  );
}
