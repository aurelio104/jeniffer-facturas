import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { MoneyValue } from '../components/MoneyValue';
import { Modal } from '../components/Modal';
import { FilterSelect } from '../components/FilterSelect';
import { maestraApi, proveedoresApi, facturasApi, type MaestraRow } from '../services/api';
import { pagosUrl } from '../lib/navigation';
import { emitAppRefresh, subscribeAppRefresh } from '../lib/app-refresh';

function estadoBadge(estado: string) {
  const cls = estado === 'PAGADA' ? 'badge-pagada' : estado === 'PARCIAL' ? 'badge-parcial' : 'badge-pendiente';
  return <span className={`badge ${cls}`}>{estado}</span>;
}

export function Maestra() {
  const [rows, setRows] = useState<MaestraRow[]>([]);
  const [rifFilter, setRifFilter] = useState('');
  const [proveedores, setProveedores] = useState<{ rif: string; nombre: string }[]>([]);
  const [selected, setSelected] = useState<MaestraRow | null>(null);

  const load = (rif?: string) => maestraApi.list(rif || undefined).then(setRows);

  useEffect(() => {
    load();
    proveedoresApi.list().then((p) => setProveedores(p.map((x) => ({ rif: x.rif, nombre: x.nombre }))));
    return subscribeAppRefresh(() => load(rifFilter || undefined));
  }, [rifFilter]);

  const toggleCheck = async (id: string, field: 'recibidoFisico' | 'retencionEnviada', current: string) => {
    const val = current === 'Sí' ? 'Pendiente' : 'Sí';
    await facturasApi.checklist(id, { [field]: val });
    load(rifFilter || undefined);
    emitAppRefresh();
    if (selected?.id === id) {
      setSelected((s) => s ? { ...s, [field]: val } : null);
    }
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader title="BD Maestra" subtitle="Checklist, saldos y diferencial cambiario" />

      <div className="filter-bar">
        <FilterSelect
          label="Proveedor"
          value={rifFilter}
          onChange={(v) => {
            setRifFilter(v);
            load(v || undefined);
          }}
          options={[
            { value: '', label: 'Todos los proveedores' },
            ...proveedores.map((p) => ({ value: p.rif, label: `${p.rif} — ${p.nombre}` }))
          ]}
        />
      </div>

      <div className="ios-glass-card">
        <div className="panel-header panel-header-accent-green">
          <h2>Registro maestro</h2>
          <span className="panel-meta">{rows.length} documentos</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Doc</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th className="col-num">Neto</th>
                <th className="col-num">IVA</th>
                <th className="col-num">Ret IVA</th>
                <th className="col-num">Ret ISLR</th>
                <th className="col-num">Pagado</th>
                <th className="col-num">Saldo</th>
                <th className="col-num">Dif USD</th>
                <th className="col-center">Días</th>
                <th className="col-center">Físico</th>
                <th className="col-center">Ret.</th>
                <th className="col-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`row-clickable ${r.vencida ? 'row-vencida' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <td className="col-text">{r.tipo}-{r.numero}</td>
                  <td className="max-w-[140px] truncate">{r.proveedor}</td>
                  <td>{r.fecha}</td>
                  <td className="col-num"><MoneyValue value={r.netoBs} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={r.iva16} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={r.retIva} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={r.retIslr} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={r.pagadoBs} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={r.saldoBs} size="sm" /></td>
                  <td className="col-num">
                    <MoneyValue value={r.difCambiariaUsd} size="sm" showSign />
                  </td>
                  <td className="col-center">
                    {r.diasVencida > 0 ? (
                      <span className="badge badge-vencida">{r.diasVencida}d</span>
                    ) : '—'}
                  </td>
                  <td className="col-center">
                    <button
                      type="button"
                      className={`badge ${r.recibidoFisico === 'Sí' ? 'badge-si' : 'badge-pendiente'}`}
                      onClick={(e) => { e.stopPropagation(); toggleCheck(r.id, 'recibidoFisico', r.recibidoFisico); }}
                    >
                      {r.recibidoFisico}
                    </button>
                  </td>
                  <td className="col-center">
                    <button
                      type="button"
                      className={`badge ${r.retencionEnviada === 'Sí' ? 'badge-si' : 'badge-pendiente'}`}
                      onClick={(e) => { e.stopPropagation(); toggleCheck(r.id, 'retencionEnviada', r.retencionEnviada); }}
                    >
                      {r.retencionEnviada}
                    </button>
                  </td>
                  <td className="col-center">{estadoBadge(r.estado)}</td>
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
        subtitle={selected?.proveedor}
        size="lg"
        footer={
          <>
            <Link to={`/facturas/${selected?.id}`} className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
              Editar
            </Link>
            <Link
              to={selected ? pagosUrl({ facturaId: selected.id, rif: selected.rif }) : '/pagos'}
              className="ios-btn ios-btn-primary ios-btn-sm no-underline"
            >
              Registrar pago
            </Link>
          </>
        }
      >
        {selected && (
          <div className="detail-grid">
            <div className="detail-item">
              <label>RIF</label>
              <span>{selected.rif}</span>
            </div>
            <div className="detail-item">
              <label>Fecha</label>
              <span>{selected.fecha}</span>
            </div>
            <div className="detail-item">
              <label>Neto a pagar</label>
              <MoneyValue value={selected.netoBs} />
            </div>
            <div className="detail-item">
              <label>Saldo Bs</label>
              <MoneyValue value={selected.saldoBs} size="lg" />
            </div>
            <div className="detail-item">
              <label>IVA 16%</label>
              <MoneyValue value={selected.iva16} />
            </div>
            <div className="detail-item">
              <label>Ret. IVA</label>
              <MoneyValue value={selected.retIva} />
            </div>
            <div className="detail-item">
              <label>Ret. ISLR</label>
              <MoneyValue value={selected.retIslr} />
            </div>
            <div className="detail-item">
              <label>Pagado</label>
              <MoneyValue value={selected.pagadoBs} />
            </div>
            <div className="detail-item">
              <label>Dif. cambiaria USD</label>
              <MoneyValue value={selected.difCambiariaUsd} showSign />
            </div>
            <div className="detail-item">
              <label>Días vencida</label>
              <span>{selected.diasVencida > 0 ? `${selected.diasVencida} días` : 'Al día'}</span>
            </div>
            <div className="detail-item">
              <label>Estado</label>
              <span>{estadoBadge(selected.estado)}</span>
            </div>
            <div className="detail-item">
              <label>Tasa registro</label>
              <MoneyValue value={selected.tasaRegistro} />
            </div>
          </div>
        )}
      </Modal>
    </HeroTemplate>
  );
}
