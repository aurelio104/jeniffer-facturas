import { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> & {
  label: string;
  as?: 'input' | 'select';
  options?: { value: string; label: string; key?: string }[];
  hint?: string;
};

export function FormField({ label, as = 'input', options, hint, className, ...props }: Props) {
  const inputClass = ['field-input', className].filter(Boolean).join(' ');

  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {as === 'select' ? (
        <div className="field-select-wrap">
          <select className={inputClass} {...(props as InputHTMLAttributes<HTMLSelectElement>)}>
            {options?.map((o, i) => (
              <option key={o.key ?? `${o.value}-${i}`} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <input className={inputClass} {...props} />
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
