import type { Proveedor } from '../services/api';
import { SearchSelectField } from './SearchSelectField';

type Props = {
  label?: string;
  value: string;
  proveedores: Proveedor[];
  onChange: (rif: string) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
};

export function ProveedorSearchField({
  label = 'RIF proveedor',
  value,
  proveedores,
  onChange,
  disabled,
  required,
  hint,
  placeholder = 'Buscar por RIF o nombre…'
}: Props) {
  const options = proveedores.map((p) => ({
    value: p.rif,
    label: `${p.rif} — ${p.nombre}`
  }));

  return (
    <SearchSelectField
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      required={required}
      hint={hint}
      placeholder={placeholder}
    />
  );
}
