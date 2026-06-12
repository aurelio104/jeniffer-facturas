import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { MoneyValue } from '../components/MoneyValue';
import { AdminOnly } from '../components/AdminOnly';
import { tasasApi, type TasasDia } from '../services/api';

type TasaRow = { id: string; fecha: string; valor: number; valorEur?: number | null };

export function Tasas() {
  const [list, setList] = useState<TasaRow[]>([]);
  const [bcv, setBcv] = useState<TasasDia | null>(null);
  const [msg, setMsg] = useState('');
  const [loadingBcv, setLoadingBcv] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<TasaRow | null>(null);
  const [formFecha, setFormFecha] = useState('');
  const [formUsd, setFormUsd] = useState('');
  const [formEur, setFormEur] = useState('');

  const load = () => tasasApi.list(3).then(setList);

  const loadBcv = async (refresh = false) => {
    setLoadingBcv(true);
    try {
      const res = refresh ? await tasasApi.refreshBcv() : await tasasApi.bcv();
      setBcv(res.tasas);
      load();
    } catch {
      setMsg('No se pudo obtener tasa BCV');
    } finally {
      setLoadingBcv(false);
    }
  };

  const rebuild = async () => {
    setRebuilding(true);
    setMsg('');
    try {
      const r = await tasasApi.rebuildHistorico();
      setMsg(`Histórico actualizado: ${r.insertados} días (${r.desde} → ${r.hasta})`);
      load();
      loadBcv(true);
    } catch {
      setMsg('No se pudo reconstruir el histórico');
    } finally {
      setRebuilding(false);
    }
  };

  const openNew = () => {
    setEditRow(null);
    setFormFecha(new Date().toISOString().slice(0, 10));
    setFormUsd('');
    setFormEur('');
    setModalOpen(true);
  };

  const openEdit = (t: TasaRow) => {
    setEditRow(t);
    setFormFecha(t.fecha.slice(0, 10));
    setFormUsd(String(t.valor));
    setFormEur(t.valorEur != null ? String(t.valorEur) : '');
    setModalOpen(true);
  };

  const saveTasa = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(formUsd);
    const valorEur = formEur ? parseFloat(formEur) : undefined;
    if (editRow) {
      await tasasApi.update(editRow.id, valor, valorEur ?? null);
      setMsg('Tasa actualizada');
    } else {
      await tasasApi.create(formFecha, valor, valorEur);
      setMsg('Tasa registrada');
    }
    setModalOpen(false);
    load();
  };

  const removeTasa = async (t: TasaRow) => {
    if (!confirm(`¿Eliminar tasa del ${new Date(t.fecha).toLocaleDateString('es-VE')}?`)) return;
    await tasasApi.delete(t.id);
    load();
  };

  useEffect(() => {
    load();
    loadBcv();
  }, []);

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Tasas BCV"
        subtitle="Histórico USD y EUR — últimos 3 meses"
        actions={
          <div className="page-actions">
            <button
              type="button"
              className="ios-btn ios-btn-ghost ios-btn-sm"
              disabled={loadingBcv}
              onClick={() => loadBcv(true)}
            >
              {loadingBcv ? 'Actualizando…' : 'Refrescar hoy'}
            </button>
            <AdminOnly>
              <button type="button" className="ios-btn ios-btn-primary ios-btn-sm" onClick={openNew}>
                + Tasa manual
              </button>
              <button
                type="button"
                className="ios-btn ios-btn-rose ios-btn-sm"
                disabled={rebuilding}
                onClick={rebuild}
              >
                {rebuilding ? 'Reconstruyendo…' : 'Reconstruir 3 meses'}
              </button>
            </AdminOnly>
          </div>
        }
      />

      {bcv && (
        <div className="ios-glass-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="field-label mb-2">USD — dólar</p>
              <p className="text-3xl font-bold">
                <MoneyValue value={bcv.usd.tasa} size="lg" />
                <span className="text-lg font-normal text-muted ml-2">Bs/USD</span>
              </p>
              <p className="text-xs text-muted mt-2">
                {bcv.usd.nombre}
                {bcv.usd.fecha && ` · ${bcv.usd.fecha}`}
              </p>
            </div>
            <div>
              <p className="field-label mb-2 num-accent-rose">EUR — euro</p>
              <p className="text-3xl font-bold">
                <span className="num-value num-accent-rose num-lg">{bcv.eur.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-lg font-normal text-muted ml-2">Bs/EUR</span>
              </p>
              <p className="text-xs text-muted mt-2">
                {bcv.eur.nombre}
                {bcv.eur.fecha && ` · ${bcv.eur.fecha}`}
              </p>
            </div>
          </div>
          {bcv.meta?.fuenteActiva && (
            <p className="text-xs text-muted mt-4">Fuente: {bcv.meta.fuenteActiva}</p>
          )}
        </div>
      )}

      {msg && <p className="alert-success">{msg}</p>}

      <div className="ios-glass-card">
        <div className="panel-header panel-header-accent-green">
          <h2>Histórico (3 meses)</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha valor</th>
                <th className="col-num">USD venta Bs</th>
                <th className="col-num">EUR venta Bs</th>
                <AdminOnly><th className="col-center">Admin</th></AdminOnly>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.fecha).toLocaleDateString('es-VE')}</td>
                  <td className="col-num"><MoneyValue value={t.valor} size="sm" /></td>
                  <td className="col-num">
                    <span className="num-value num-accent-rose num-sm">
                      {t.valorEur != null ? t.valorEur.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </span>
                  </td>
                  <AdminOnly>
                    <td className="col-center">
                      <div className="table-actions">
                        <button type="button" className="link-green" onClick={() => openEdit(t)}>Editar</button>
                        <button type="button" className="link-rose" onClick={() => removeTasa(t)}>Eliminar</button>
                      </div>
                    </td>
                  </AdminOnly>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <p className="text-sm text-muted mt-2">Sin registros. Usa «Reconstruir 3 meses» (admin).</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Editar tasa' : 'Nueva tasa manual'}
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="tasa-form" className="ios-btn ios-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="tasa-form" onSubmit={saveTasa} className="form-grid form-grid-1">
          {!editRow && (
            <FormField label="Fecha" type="date" value={formFecha}
              onChange={(e) => setFormFecha(e.target.value)} required />
          )}
          <FormField label="USD Bs" type="number" step="0.0001" value={formUsd}
            onChange={(e) => setFormUsd(e.target.value)} required />
          <FormField label="EUR Bs (opcional)" type="number" step="0.0001" value={formEur}
            onChange={(e) => setFormEur(e.target.value)} />
        </form>
      </Modal>
    </HeroTemplate>
  );
}
