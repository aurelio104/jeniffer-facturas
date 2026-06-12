import { useEffect, useState } from 'react';
import { fmtBs, parseBs } from '../services/api';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  className?: string;
  placeholder?: string;
};

function formatForEdit(n: number): string {
  if (!n) return '';
  const fixed = n.toFixed(2);
  const [int, dec] = fixed.split('.');
  return dec === '00' ? int : `${int},${dec}`;
}

export function MoneyInputField({
  label,
  value,
  onChange,
  disabled,
  required,
  hint,
  className,
  placeholder = '0,00'
}: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(value ? fmtBs(value) : '');
    }
  }, [value, focused]);

  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        className={['field-input money-input', className].filter(Boolean).join(' ')}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '');
          setText(raw);
          onChange(parseBs(raw));
        }}
        onFocus={() => {
          setFocused(true);
          setText(formatForEdit(value));
        }}
        onBlur={() => {
          setFocused(false);
          setText(value ? fmtBs(value) : '');
        }}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
