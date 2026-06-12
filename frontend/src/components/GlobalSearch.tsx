import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { maestraApi, type MaestraRow } from '../services/api';
import { pagosUrl } from '../lib/navigation';
import { MoneyValue } from './MoneyValue';
import { Modal } from './Modal';

export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MaestraRow[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<MaestraRow | null>(null);
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

  const pickRow = (r: MaestraRow) => {
    setPicked(r);
    setOpen(false);
  };

  return (
    <>
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
              <button
                key={r.id}
                type="button"
                className="search-dropdown-action"
                onClick={() => pickRow(r)}
              >
                <span>
                  <strong>{r.tipo}-{r.numero}</strong>
                  <span className="text-secondary"> · {r.proveedor}</span>
                </span>
                <MoneyValue value={r.saldoBs} size="sm" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={picked != null}
        onClose={() => setPicked(null)}
        title={picked ? `${picked.tipo}-${picked.numero}` : ''}
        subtitle={picked?.proveedor}
        footer={
          picked && (
            <>
              <button
                type="button"
                className="ios-btn ios-btn-ghost"
                onClick={() => setPicked(null)}
              >
                Cancelar
              </button>
              {picked.saldoBs > 0.01 && (
                <button
                  type="button"
                  className="ios-btn ios-btn-primary"
                  onClick={() => {
                    navigate(pagosUrl({ facturaId: picked.id, rif: picked.rif }));
                    setPicked(null);
                  }}
                >
                  Registrar pago
                </button>
              )}
              <Link
                to={`/facturas/${picked.id}`}
                className="ios-btn ios-btn-ghost no-underline"
                onClick={() => setPicked(null)}
              >
                Editar factura
              </Link>
            </>
          )
        }
      >
        {picked && (
          <div className="detail-grid">
            <div className="detail-item">
              <label>Saldo pendiente</label>
              <MoneyValue value={picked.saldoBs} size="lg" />
            </div>
            <div className="detail-item">
              <label>Estado</label>
              <span>{picked.estado}</span>
            </div>
            <div className="detail-item">
              <label>Neto</label>
              <MoneyValue value={picked.netoBs} />
            </div>
            {picked.diasVencida > 0 && (
              <div className="detail-item">
                <label>Días vencida</label>
                <span>{picked.diasVencida} días</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
