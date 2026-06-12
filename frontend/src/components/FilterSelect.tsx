import { SearchSelectField } from './SearchSelectField';

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
    <SearchSelectField
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      className={['field-group-inline', className].filter(Boolean).join(' ')}
    />
  );
}
