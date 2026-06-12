import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { MoneyValue } from '../components/MoneyValue';
import { maestraApi, proveedoresApi, downloadBlob, type ResumenProveedor } from '../services/api';
import { FilterSelect } from '../components/FilterSelect';

export function Resumen() {
  const [proveedores, setProveedores] = useState<{ rif: string; nombre: string }[]>([]);
  const [rif, setRif] = useState('');
  const [data, setData] = useState<ResumenProveedor | null>(null);

  useEffect(() => {
    proveedoresApi.list().then((p) => {
      setProveedores(p.map((x) => ({ rif: x.rif, nombre: x.nombre })));
      if (p.length) setRif(p[0].rif);
    });
  }, []);

  useEffect(() => {
    if (!rif) return;
    maestraApi.resumen(rif).then(setData);
  }, [rif]);

  const exportCsv = async () => {
    if (!rif) return;
    const blob = await maestraApi.exportResumen(rif);
    downloadBlob(blob, `resumen-${rif}.csv`);
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Resumen por proveedor"
        subtitle={data?.proveedor?.nombre}
        actions={
          <button type="button" className="ios-btn ios-btn-rose ios-btn-sm" onClick={exportCsv}>
            Exportar CSV
          </button>
        }
      />

      <div className="filter-bar">
        <FilterSelect
          label="Proveedor"
          value={rif}
          onChange={setRif}
          options={proveedores.map((p) => ({ value: p.rif, label: `${p.rif} — ${p.nombre}` }))}
        />
      </div>

      {data && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.facturado} size="lg" /></div>
              <div className="kpi-label">Facturado Bs</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.neto} size="lg" /></div>
              <div className="kpi-label">Neto a pagar</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.iva} size="lg" /></div>
              <div className="kpi-label">IVA</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.retIva} size="lg" /></div>
              <div className="kpi-label">Ret. IVA</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.retIslr} size="lg" /></div>
              <div className="kpi-label">Ret. ISLR</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.pagado} size="lg" /></div>
              <div className="kpi-label">Pagado</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={data.totales.saldo} size="lg" /></div>
              <div className="kpi-label">Saldo</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">
                <MoneyValue value={data.totales.difCambiariaUsd} size="lg" showSign />
              </div>
              <div className="kpi-label">Dif. cambiaria USD</div>
            </div>
          </div>

          <div className="ios-glass-card">
            <div className="panel-header panel-header-accent-green">
              <h2>Detalle documentos</h2>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Doc</th>
                    <th className="col-num">Saldo Bs</th>
                    <th className="col-num">IVA</th>
                    <th className="col-num">Ret IVA</th>
                    <th className="col-num">Ret ISLR</th>
                    <th className="col-num">Dif USD</th>
                    <th className="col-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.maestra.map((r) => (
                    <tr key={r.id} className={r.vencida ? 'row-vencida' : ''}>
                      <td className="col-text">{r.tipo}-{r.numero}</td>
                      <td className="col-num"><MoneyValue value={r.saldoBs} size="sm" /></td>
                      <td className="col-num"><MoneyValue value={r.iva16} size="sm" /></td>
                      <td className="col-num"><MoneyValue value={r.retIva} size="sm" /></td>
                      <td className="col-num"><MoneyValue value={r.retIslr} size="sm" /></td>
                      <td className="col-num">
                        <MoneyValue value={r.difCambiariaUsd} size="sm" showSign />
                      </td>
                      <td className="col-center">
                        <span className={`badge ${r.estado === 'PAGADA' ? 'badge-pagada' : r.estado === 'PARCIAL' ? 'badge-parcial' : 'badge-pendiente'}`}>
                          {r.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </HeroTemplate>
  );
}
