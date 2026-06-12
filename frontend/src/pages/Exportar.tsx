import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FilterSelect } from '../components/FilterSelect';
import { MoneyValue } from '../components/MoneyValue';
import { exportApi, proveedoresApi, downloadBlob, type ExportInfo } from '../services/api';

type Periodo = 'semanal' | 'mensual' | 'trimestral' | 'semestral';

const PERIODOS: { id: Periodo; label: string; hint: string }[] = [
  { id: 'semanal', label: 'Semanal', hint: 'Semana actual (lun → hoy)' },
  { id: 'mensual', label: 'Mensual', hint: 'Mes calendario actual' },
  { id: 'trimestral', label: 'Trimestral', hint: 'Trimestre actual' },
  { id: 'semestral', label: 'Semestral', hint: 'Semestre actual' }
];

export function Exportar() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [rif, setRif] = useState('');
  const [proveedores, setProveedores] = useState<{ rif: string; nombre: string }[]>([]);
  const [info, setInfo] = useState<ExportInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    proveedoresApi.list().then((p) =>
      setProveedores(p.map((x) => ({ rif: x.rif, nombre: x.nombre })))
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    exportApi
      .info(periodo, rif || undefined)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [periodo, rif]);

  const download = async (format: 'excel' | 'pdf') => {
    setMsg('');
    try {
      const blob =
        format === 'excel'
          ? await exportApi.excel(periodo, rif || undefined)
          : await exportApi.pdf(periodo, rif || undefined);
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      downloadBlob(blob, `jeniffer-${periodo}-${new Date().toISOString().slice(0, 10)}.${ext}`);
      setMsg(`Exportación ${format.toUpperCase()} descargada`);
    } catch {
      setMsg('Error al generar el archivo');
    }
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Exportar datos"
        subtitle="Facturas, pagos, maestra y proveedores por período"
      />

      <div className="filter-bar">
        <FilterSelect
          label="Proveedor (opcional)"
          value={rif}
          onChange={setRif}
          options={[
            { value: '', label: 'Todos los proveedores' },
            ...proveedores.map((p) => ({ value: p.rif, label: `${p.rif} — ${p.nombre}` }))
          ]}
        />
      </div>

      <div className="export-grid">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`export-period-card ${periodo === p.id ? 'export-period-card-active' : ''}`}
            onClick={() => setPeriodo(p.id)}
          >
            <span className="export-period-title">{p.label}</span>
            <span className="export-period-hint">{p.hint}</span>
          </button>
        ))}
      </div>

      {info && (
        <div className="ios-glass-card">
          <div className="panel-header panel-header-accent-green">
            <h2>Vista previa del período</h2>
            <span className="panel-meta">{info.meta.label}</span>
          </div>
          <div className="kpi-grid" style={{ marginBottom: '0' }}>
            <div className="kpi-card">
              <div className="kpi-value">{info.resumen.facturas}</div>
              <div className="kpi-label">Facturas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{info.resumen.pagos}</div>
              <div className="kpi-label">Pagos</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={info.resumen.totalFacturadoBs} size="lg" /></div>
              <div className="kpi-label">Facturado Bs</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value"><MoneyValue value={info.resumen.totalPagadoBs} size="lg" /></div>
              <div className="kpi-label">Pagado Bs</div>
            </div>
          </div>
          <p className="text-sm text-muted mt-3">
            El Excel incluye hojas: Resumen, Facturas, Pagos, Maestra y Proveedores.
            El PDF incluye resumen y tablas principales (detalle completo en Excel).
          </p>
        </div>
      )}

      <div className="ios-glass-card">
        <div className="panel-header panel-header-accent-rose">
          <h2>Descargar</h2>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="ios-btn ios-btn-primary"
            disabled={loading}
            onClick={() => download('excel')}
          >
            Excel (.xlsx)
          </button>
          <button
            type="button"
            className="ios-btn ios-btn-ghost"
            disabled={loading}
            onClick={() => download('pdf')}
          >
            PDF
          </button>
        </div>
        {msg && <p className="alert-success mt-3">{msg}</p>}
      </div>
    </HeroTemplate>
  );
}
