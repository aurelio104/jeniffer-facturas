import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { MoneyValue } from '../components/MoneyValue';
import { Modal } from '../components/Modal';
import { facturasApi, type Factura } from '../services/api';
import { isAdmin } from '../lib/auth';

export function Facturas() {
  const [list, setList] = useState<Factura[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Factura | null>(null);

  useEffect(() => {
    facturasApi.list().then(setList);
  }, []);

  const buscar = async () => {
    if (!q.trim()) return facturasApi.list().then(setList);
    setList(await facturasApi.buscar(q.trim()));
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Facturas"
        subtitle="Registro y consulta de documentos"
        actions={
          <Link to="/facturas/nueva" className="ios-btn ios-btn-primary ios-btn-sm no-underline">
            + Nueva factura
          </Link>
        }
      />

      <div className="search-bar">
        <div className="field-group field-group-inline">
          <label className="field-label" htmlFor="facturas-q">Buscar</label>
          <input
            id="facturas-q"
            className="field-input"
            placeholder="Número, RIF, proveedor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="ios-btn ios-btn-ghost" onClick={buscar}>Buscar</button>
      </div>

      <div className="ios-glass-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Doc</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th className="col-num">Total Bs</th>
                <th className="col-num">A pagar</th>
                <th className="col-num">ISLR</th>
                <th className="col-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id} className="row-clickable" onClick={() => setSelected(f)}>
                  <td className="col-text">{f.tipo}-{f.numero}</td>
                  <td>{f.proveedorNombre}</td>
                  <td>{new Date(f.fecha).toLocaleDateString('es-VE')}</td>
                  <td className="col-num"><MoneyValue value={f.totalBs} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={f.montoAPagar} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={f.retencionIslr} size="sm" /></td>
                  <td className="col-center">
                    <Link to={`/facturas/${f.id}`} className="link-green" onClick={(e) => e.stopPropagation()}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.tipo}-${selected.numero}` : ''}
        subtitle={selected?.proveedorNombre}
        footer={
          <>
            <Link to={`/facturas/${selected?.id}`} className="ios-btn ios-btn-primary ios-btn-sm no-underline">
              Abrir factura
            </Link>
            {isAdmin() && selected && (
              <button
                type="button"
                className="ios-btn ios-btn-rose ios-btn-sm"
                onClick={async () => {
                  if (!confirm(`¿Eliminar ${selected.tipo}-${selected.numero}?`)) return;
                  await facturasApi.delete(selected.id);
                  setSelected(null);
                  facturasApi.list().then(setList);
                }}
              >
                Eliminar
              </button>
            )}
          </>
        }
      >
        {selected && (
          <div className="detail-grid">
            <div className="detail-item"><label>RIF</label><span>{selected.rif}</span></div>
            <div className="detail-item"><label>Fecha</label><span>{new Date(selected.fecha).toLocaleDateString('es-VE')}</span></div>
            <div className="detail-item"><label>Total Bs</label><MoneyValue value={selected.totalBs} /></div>
            <div className="detail-item"><label>A pagar</label><MoneyValue value={selected.montoAPagar} size="lg" /></div>
            <div className="detail-item"><label>IVA</label><MoneyValue value={selected.iva16} /></div>
            <div className="detail-item"><label>Ret. IVA</label><MoneyValue value={selected.retencionIva} /></div>
            <div className="detail-item"><label>Ret. ISLR</label><MoneyValue value={selected.retencionIslr} /></div>
            <div className="detail-item"><label>Base ISLR</label><MoneyValue value={selected.baseIslr} /></div>
            <div className="detail-item"><label>Días crédito</label><span>{selected.diasCredito}</span></div>
            <div className="detail-item"><label>Físico</label><span>{selected.recibidoFisico}</span></div>
            <div className="detail-item"><label>Retención</label><span>{selected.retencionEnviada}</span></div>
          </div>
        )}
      </Modal>
    </HeroTemplate>
  );
}
