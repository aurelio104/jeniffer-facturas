type Props = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function FormCheckbox({ id, label, checked, onChange }: Props) {
  return (
    <div className="field-group field-group-checkbox">
      <label className="field-checkbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="field-checkbox-input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="field-checkbox-box" aria-hidden="true" />
        <span className="field-checkbox-label">{label}</span>
      </label>
    </div>
  );
}
