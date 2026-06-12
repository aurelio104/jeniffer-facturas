import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { MoneyValue } from '../components/MoneyValue';
import { Modal } from '../components/Modal';
import { maestraApi, tasasApi, adminApi, downloadBlob, type DashboardStats } from '../services/api';
import { isAdmin } from '../lib/auth';
import { pagosUrl } from '../lib/navigation';
import { subscribeAppRefresh } from '../lib/app-refresh';

export function Dashboard() {
  const [kpi, setKpi] = useState<DashboardStats | null>(null);
  const [tasa, setTasa] = useState<number | null>(null);
  const [tasaEur, setTasaEur] = useState<number | null>(null);
  const [tasaFuente, setTasaFuente] = useState<string | null>(null);
  const [showSaldos, setShowSaldos] = useState(false);

  const refreshKpi = () => {
    maestraApi.dashboard().then(setKpi);
    tasasApi.hoy().then((t) => {
      setTasa(t.valor);
      setTasaEur(t.valorEur ?? null);
      setTasaFuente(t.nombre ?? t.fuente ?? null);
    });
  };

  useEffect(() => {
    refreshKpi();
    return subscribeAppRefresh(refreshKpi);
  }, []);

  const backup = async () => {
    const blob = await adminApi.backup();
    downloadBlob(blob, 'jeniffer-backup.db');
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Panel de control"
        subtitle={
          tasa != null
            ? `BCV ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/USD${
                tasaEur != null ? ` · ${tasaEur.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/EUR` : ''
              }${tasaFuente ? ` · ${tasaFuente}` : ''}`
            : undefined
        }
      />

      {kpi && (
        <div className="kpi-grid">
          <div className="kpi-card kpi-card-interactive" onClick={() => setShowSaldos(true)}>
            <div className="kpi-value"><MoneyValue value={kpi.saldoTotal} size="lg" /></div>
            <div className="kpi-label">Saldo total Bs</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.totalFacturas}</div>
            <div className="kpi-label">Facturas</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.pendientes}</div>
            <div className="kpi-label">Pendientes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.parciales}</div>
            <div className="kpi-label">Parciales</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.pagadas}</div>
            <div className="kpi-label">Pagadas</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value kpi-value-rose">{kpi.vencidas}</div>
            <div className="kpi-label">Vencidas</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.sinFisico}</div>
            <div className="kpi-label">Sin físico</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.sinRetencion}</div>
            <div className="kpi-label">Sin retención</div>
          </div>
        </div>
      )}

      {kpi && kpi.topSaldos.length > 0 && (
        <div className="ios-glass-card">
          <div className="panel-header panel-header-accent-green">
            <h2>Top saldos pendientes</h2>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Documento</th>
                  <th className="col-num">Saldo Bs</th>
                </tr>
              </thead>
              <tbody>
                {kpi.topSaldos.map((r) => (
                  <tr key={r.id}>
                    <td className="col-text">{r.proveedor}</td>
                    <td>
                      <Link to={`/facturas/${r.id}`} className="link-green">{r.documento}</Link>
                      {' · '}
                      <Link to={pagosUrl({ facturaId: r.id, rif: r.rif })} className="link-muted text-xs">
                        Pagar
                      </Link>
                    </td>
                    <td className="col-num"><MoneyValue value={r.saldoBs} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ios-glass-card">
        <div className="panel-header panel-header-accent-rose">
          <h2>Acciones rápidas</h2>
        </div>
        <div className="page-actions">
          <Link to="/facturas/nueva" className="ios-btn ios-btn-primary ios-btn-sm no-underline">
            Nueva factura
          </Link>
          <Link to="/pagos" className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
            Registrar pago
          </Link>
          <Link to="/proveedores" className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
            Proveedor nuevo
          </Link>
          <Link to="/auditoria" className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
            Auditoría
          </Link>
          <Link to="/exportar" className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
            Exportar
          </Link>
          {isAdmin() && (
            <>
              <Link to="/admin/usuarios" className="ios-btn ios-btn-primary ios-btn-sm no-underline">
                + Usuario
              </Link>
              <Link to="/admin/catalogos" className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
                Catálogos
              </Link>
              <Link to="/tab-islr" className="ios-btn ios-btn-ghost ios-btn-sm no-underline">
                Tab ISLR
              </Link>
              <button type="button" className="ios-btn ios-btn-rose ios-btn-sm" onClick={backup}>
                Backup BD
              </button>
            </>
          )}
        </div>
      </div>

      <Modal
        open={showSaldos && kpi != null}
        onClose={() => setShowSaldos(false)}
        title="Saldos pendientes"
        subtitle="Facturas con mayor deuda"
        size="lg"
        footer={
          <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setShowSaldos(false)}>
            Cerrar
          </button>
        }
      >
        {kpi && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Documento</th>
                  <th className="col-num">Saldo Bs</th>
                </tr>
              </thead>
              <tbody>
                {kpi.topSaldos.map((r) => (
                  <tr key={r.id}>
                    <td className="col-text">{r.proveedor}</td>
                    <td>{r.documento}</td>
                    <td className="col-num"><MoneyValue value={r.saldoBs} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </HeroTemplate>
  );
}
