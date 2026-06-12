import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Proveedor } from '../services/api';

function normalizeText(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-\s]/g, '');
}

function scoreProveedor(p: Proveedor, query: string): number {
  const q = query.trim();
  if (!q) return 1;

  const qNorm = normalizeText(q);
  const rifNorm = normalizeText(p.rif);
  const rifLower = p.rif.toLowerCase();
  const nombreLower = p.nombre.toLowerCase();
  const qLower = q.toLowerCase();

  if (rifNorm === qNorm || rifLower === qLower) return 100;
  if (rifNorm.startsWith(qNorm) || rifLower.startsWith(qLower)) return 80;
  if (nombreLower.startsWith(qLower)) return 70;

  const tokens = qLower.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => nombreLower.includes(t))) return 65;

  if (nombreLower.includes(qLower)) return 50;
  if (rifNorm.includes(qNorm) || rifLower.includes(qLower)) return 40;
  return 0;
}

function filterProveedores(proveedores: Proveedor[], query: string, limit = 12) {
  const q = query.trim();
  if (!q) return proveedores.slice(0, limit);

  return proveedores
    .map((p) => ({ p, score: scoreProveedor(p, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.nombre.localeCompare(b.p.nombre))
    .slice(0, limit)
    .map((x) => x.p);
}

function proveedorLabel(p: Proveedor) {
  return `${p.rif} — ${p.nombre}`;
}

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
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => proveedores.find((p) => p.rif === value),
    [proveedores, value]
  );

  const results = useMemo(
    () => filterProveedores(proveedores, inputValue),
    [proveedores, inputValue]
  );

  useEffect(() => {
    if (!open) {
      setInputValue(selected ? proveedorLabel(selected) : value);
    }
  }, [value, selected, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [inputValue, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (p: Proveedor) => {
    onChange(p.rif);
    setInputValue(proveedorLabel(p));
    setOpen(false);
    inputRef.current?.blur();
  };

  const commitInput = () => {
    const exact = proveedores.find(
      (p) =>
        p.rif === inputValue.trim() ||
        proveedorLabel(p).toLowerCase() === inputValue.trim().toLowerCase()
    );
    if (exact) {
      pick(exact);
      return;
    }
    if (results.length === 1) {
      pick(results[0]);
      return;
    }
    setInputValue(selected ? proveedorLabel(selected) : value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setInputValue(selected ? proveedorLabel(selected) : value);
    }
  };

  return (
    <div className="field-group proveedor-search" ref={ref}>
      <label className="field-label">{label}</label>
      <div className={`proveedor-search-wrap${open ? ' is-open' : ''}`}>
        <Search className="proveedor-search-icon" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className="proveedor-search-input"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (selected) setInputValue(proveedorLabel(selected));
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!ref.current?.contains(document.activeElement)) commitInput();
            }, 120);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
      </div>
      {open && !disabled && results.length > 0 && (
        <div className="search-dropdown proveedor-search-dropdown">
          {results.map((p, i) => (
            <button
              key={p.rif}
              type="button"
              className={`proveedor-search-option${i === activeIndex ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
            >
              <span>
                <strong>{p.rif}</strong>
                <span className="text-secondary"> · {p.nombre}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && !disabled && inputValue.trim() && results.length === 0 && (
        <div className="search-dropdown proveedor-search-dropdown">
          <p className="proveedor-search-empty">Sin coincidencias</p>
        </div>
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
