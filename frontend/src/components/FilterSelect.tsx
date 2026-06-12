type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
};

export function FilterSelect({ label, value, onChange, options, className }: Props) {
  return (
    <div className={['field-group field-group-inline', className].filter(Boolean).join(' ')}>
      <label className="field-label">{label}</label>
      <div className="field-select-wrap">
        <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
