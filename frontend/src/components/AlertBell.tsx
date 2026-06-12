import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { alertasApi, type Alerta } from '../services/api';
import { pagosUrl } from '../lib/navigation';
import { subscribeAppRefresh } from '../lib/app-refresh';
import { MoneyValue } from './MoneyValue';

function tipoBadge(tipo: string) {
  if (tipo === 'VENCIDA') return 'badge-vencida';
  if (tipo === 'POR_VENCER') return 'badge-pendiente';
  if (tipo === 'SIN_FISICO') return 'badge-parcial';
  return 'badge-pendiente';
}

export function AlertBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Alerta[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    alertasApi.count().then((c) => setCount(c.count));
    alertasApi.list().then(setItems);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const unsub = subscribeAppRefresh(load);
    return () => {
      clearInterval(t);
      unsub();
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const leer = async (id: string) => {
    await alertasApi.leer(id);
    load();
  };

  const descartar = async (id: string) => {
    await alertasApi.descartar(id);
    load();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="alert-bell-btn"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label="Alertas"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && <span className="alert-bell-badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="alert-dropdown">
          <div className="alert-dropdown-header">
            <strong>Alertas</strong>
            <button type="button" className="link-green" onClick={() => alertasApi.leerTodas().then(load)}>
              Marcar leídas
            </button>
          </div>
          <div className="alert-dropdown-body">
            {items.length === 0 && (
              <p className="text-sm text-muted p-3">Sin alertas pendientes</p>
            )}
            {items.map((a) => (
              <div key={a.id} className={`alert-item ${a.leida ? 'alert-item-read' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`badge ${tipoBadge(a.tipo)} mr-1`}>{a.tipo.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium">{a.titulo}</span>
                    {a.detalle && <p className="text-xs text-muted mt-0.5">{a.detalle}</p>}
                    {a.saldoBs != null && (
                      <p className="text-xs mt-0.5">
                        Saldo: <MoneyValue value={a.saldoBs} size="sm" />
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {a.facturaId && (
                      <>
                        <Link
                          to={pagosUrl({ facturaId: a.facturaId, rif: a.rif })}
                          className="link-green text-xs"
                          onClick={() => setOpen(false)}
                        >
                          Pagar
                        </Link>
                        <Link
                          to={`/facturas/${a.facturaId}`}
                          className="text-xs text-muted"
                          onClick={() => setOpen(false)}
                        >
                          Editar
                        </Link>
                      </>
                    )}
                    {!a.leida && (
                      <button type="button" className="link-rose text-xs" onClick={() => leer(a.id)}>
                        Leída
                      </button>
                    )}
                    <button type="button" className="text-xs text-muted" onClick={() => descartar(a.id)}>
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="alert-dropdown-footer">
            <Link to="/maestra" className="link-green text-xs" onClick={() => setOpen(false)}>
              Ir a BD Maestra
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
