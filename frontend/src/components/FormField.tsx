import { InputHTMLAttributes } from 'react';
import { SearchSelectField } from './SearchSelectField';

type Props = InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> & {
  label: string;
  as?: 'input' | 'select';
  options?: { value: string; label: string; key?: string }[];
  hint?: string;
};

export function FormField({ label, as = 'input', options, hint, className, ...props }: Props) {
  const inputClass = ['field-input', className].filter(Boolean).join(' ');

  if (as === 'select') {
    return (
      <SearchSelectField
        label={label}
        value={(props.value as string) ?? ''}
        options={options ?? []}
        onChange={(v) => {
          const handler = props.onChange as ((e: { target: { value: string } }) => void) | undefined;
          handler?.({ target: { value: v } });
        }}
        disabled={props.disabled}
        required={props.required}
        hint={hint}
        className={className}
      />
    );
  }

  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input className={inputClass} {...props} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
