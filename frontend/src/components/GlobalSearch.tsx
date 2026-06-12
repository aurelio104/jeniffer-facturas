import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { maestraApi, type MaestraRow } from '../services/api';
import { MoneyValue } from './MoneyValue';

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MaestraRow[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      maestraApi.buscar(q).then(setResults);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <div className="search-input-wrap">
        <Search className="w-4 h-4 search-icon" />
        <input
          type="search"
          placeholder="Buscar factura, RIF, proveedor…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((r) => (
            <Link
              key={r.id}
              to={`/facturas/${r.id}`}
              onClick={() => setOpen(false)}
            >
              <span>
                <strong>{r.tipo}-{r.numero}</strong>
                <span className="text-secondary"> · {r.proveedor}</span>
              </span>
              <MoneyValue value={r.saldoBs} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
