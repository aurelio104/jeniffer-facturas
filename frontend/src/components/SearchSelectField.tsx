import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  filterOptions,
  optionLabel,
  type SearchOption
} from '../utils/search-select';

type Props = {
  label?: string;
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  className?: string;
};

export function SearchSelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  required,
  hint,
  placeholder = 'Buscar o seleccionar…',
  className
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const emptyOption = useMemo(
    () => options.find((o) => o.value === ''),
    [options]
  );

  const results = useMemo(
    () => filterOptions(options, inputValue),
    [options, inputValue]
  );

  const closedDisplay = useMemo(() => {
    if (!value) return '';
    return optionLabel(options, value);
  }, [options, value]);

  useEffect(() => {
    if (!open && !skipBlurCommitRef.current) {
      setInputValue(closedDisplay);
    }
  }, [closedDisplay, open]);

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

  const pick = (next: string, labelText?: string) => {
    skipBlurCommitRef.current = true;
    onChange(next);
    setInputValue(next ? labelText ?? optionLabel(options, next) : '');
    setOpen(false);
    inputRef.current?.blur();
    window.setTimeout(() => {
      skipBlurCommitRef.current = false;
    }, 200);
  };

  const commitInput = () => {
    if (skipBlurCommitRef.current) return;

    const trimmed = inputValue.trim();
    if (!trimmed) {
      // Tras elegir en la lista, el blur puede llegar antes de que el padre actualice value.
      if (value) {
        setInputValue(closedDisplay);
        setOpen(false);
        return;
      }
      if (emptyOption || !required) pick('');
      else setInputValue(closedDisplay);
      setOpen(false);
      return;
    }

    const byValue = options.find(
      (o) => o.value && o.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (byValue) {
      pick(byValue.value, byValue.label);
      return;
    }

    const byLabel = options.find(
      (o) => o.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (byLabel) {
      pick(byLabel.value, byLabel.label);
      return;
    }

    if (results.length === 1) {
      pick(results[0].value, results[0].label);
      return;
    }

    setInputValue(closedDisplay);
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
      pick(results[activeIndex].value, results[activeIndex].label);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setInputValue(closedDisplay);
    }
  };

  const groupClass = ['field-group search-select', className].filter(Boolean).join(' ');

  return (
    <div className={groupClass} ref={ref}>
      {label && <label className="field-label">{label}</label>}
      <div className={`search-select-wrap${open ? ' is-open' : ''}`}>
        <Search className="search-select-icon" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className="search-select-input"
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
            if (value) setInputValue(closedDisplay);
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
      {open && !disabled && (emptyOption || results.length > 0 || (inputValue.trim() && results.length === 0)) && (
        <div className="search-dropdown search-select-dropdown">
          {emptyOption && (
            <button
              type="button"
              className="search-select-option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick('', emptyOption.label)}
            >
              <span className="text-secondary">{emptyOption.label}</span>
            </button>
          )}
          {results.map((o, i) => (
            <button
              key={o.key ?? `${o.value}-${i}`}
              type="button"
              className={`search-select-option${i === activeIndex ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value, o.label)}
            >
              <span><strong>{o.label}</strong></span>
            </button>
          ))}
          {inputValue.trim() && results.length === 0 && (
            <p className="search-select-empty">Sin coincidencias</p>
          )}
        </div>
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
