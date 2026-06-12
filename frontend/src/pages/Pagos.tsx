import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { ProveedorSearchField } from '../components/ProveedorSearchField';
import { FormCheckbox } from '../components/FormCheckbox';
import { MoneyValue } from '../components/MoneyValue';
import { MoneyInputField } from '../components/MoneyInputField';
import { Modal } from '../components/Modal';
import {
  pagosApi,
  proveedoresApi,
  facturasApi,
  tasasApi,
  maestraApi,
  type Pago,
  type Proveedor,
  type Factura,
  type SaldoFactura
} from '../services/api';
import { AdminOnly } from '../components/AdminOnly';

export function Pagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [anticipos, setAnticipos] = useState<Pago[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [bancos, setBancos] = useState<string[]>([]);
  const [tasa, setTasa] = useState(0);
  const [saldo, setSaldo] = useState<SaldoFactura | null>(null);
  const [msg, setMsg] = useState('');
  const [hint, setHint] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editPago, setEditPago] = useState<Pago | null>(null);
  const [editForm, setEditForm] = useState({
    fecha: '',
    rif: '',
    proveedor: '',
    documento: '',
    banco: '',
    referencia: '',
    pagadoBs: 0,
    pagadoUsd: 0,
    observacion: ''
  });

  const onPagadoBsChange = (n: number) => {
    setPagadoBs(n);
    if (tasa > 0) setPagadoUsd(n / tasa);
  };

  const onPagadoUsdChange = (n: number) => {
    setPagadoUsd(n);
    if (tasa > 0) setPagadoBs(n * tasa);
  };

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rif, setRif] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [facturaId, setFacturaId] = useState('');
  const [banco, setBanco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [pagadoBs, setPagadoBs] = useState(0);
  const [pagadoUsd, setPagadoUsd] = useState(0);
  const [observacion, setObservacion] = useState('');
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [anticipoId, setAnticipoId] = useState('');

  const load = () => {
    pagosApi.list().then(setPagos);
    pagosApi.anticipos().then(setAnticipos);
  };

  useEffect(() => {
    load();
    proveedoresApi.list().then(setProveedores);
    facturasApi.list().then(setFacturas);
    tasasApi.hoy().then((t) => setTasa(t.valor));
    maestraApi.config('banco').then((c) => setBancos(c.map((x) => x.valor)));
  }, []);

  const onRif = async (v: string) => {
    setRif(v);
    setHint('');
    const p = proveedores.find((x) => x.rif === v);
    if (p) {
      setProveedor(p.nombre);
      setBanco(p.banco ?? '');
    }
    facturasApi.list(v).then(setFacturas);
    pagosApi.anticipos(v).then(setAnticipos);
    if (!v) return;
    try {
      const s = await pagosApi.suggest(v);
      if (s.banco && !banco) setBanco(s.banco);
      const parts: string[] = [];
      if (s.facturasPendientes > 0) parts.push(`${s.facturasPendientes} factura(s) del proveedor`);
      if (s.anticiposAbiertos > 0) parts.push(`${s.anticiposAbiertos} anticipo(s) abierto(s)`);
      if (parts.length) setHint(parts.join(' · '));
    } catch { /* ignore */ }
  };

  const onFacturaSelect = async (id: string) => {
    setFacturaId(id);
    setEsAnticipo(false);
    if (!id) {
      setDocumento('');
      setSaldo(null);
      return;
    }
    const f = facturas.find((x) => x.id === id);
    if (f) setDocumento(`${f.tipo}-${f.numero}`);
  };

  useEffect(() => {
    if (!facturaId || esAnticipo) {
      setSaldo(null);
      return;
    }
    pagosApi.saldo(facturaId).then((s) => {
      setSaldo(s);
      if (s.saldoBs > 0) {
        setPagadoBs(s.saldoBs);
        if (tasa > 0) setPagadoUsd(s.saldoBs / tasa);
      }
    });
  }, [facturaId, esAnticipo, tasa]);

  const doSubmit = async () => {
    setMsg('');
    try {
      await pagosApi.create({
        fecha,
        rif,
        proveedor,
        documento: esAnticipo ? 'ANTICIPO' : documento,
        banco,
        referencia,
        tasa,
        pagadoBs: pagadoBs > 0 ? pagadoBs : null,
        pagadoUsd: pagadoUsd > 0 ? pagadoUsd : null,
        observacion,
        facturaId: esAnticipo ? null : facturaId || null,
        estadoAnticipo: esAnticipo ? 'Abierto' : undefined,
        anticipoId: anticipoId || null
      });
      setMsg(esAnticipo ? 'Anticipo registrado' : 'Pago registrado');
      setConfirmOpen(false);
      setReferencia('');
      setPagadoBs(0);
      setPagadoUsd(0);
      setAnticipoId('');
      load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error ?? 'Error');
      setConfirmOpen(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmOpen(true);
  };

  const openEdit = (p: Pago) => {
    setEditPago(p);
    setEditForm({
      fecha: p.fecha.slice(0, 10),
      rif: p.rif,
      proveedor: p.proveedor,
      documento: p.documento,
      banco: p.banco,
      referencia: p.referencia,
      pagadoBs: p.pagadoBs ?? 0,
      pagadoUsd: p.pagadoUsd ?? 0,
      observacion: p.observacion ?? ''
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPago) return;
    await pagosApi.update(editPago.id, {
      fecha: editForm.fecha,
      rif: editForm.rif,
      proveedor: editForm.proveedor,
      documento: editForm.documento,
      banco: editForm.banco,
      referencia: editForm.referencia,
      pagadoBs: editForm.pagadoBs > 0 ? editForm.pagadoBs : null,
      pagadoUsd: editForm.pagadoUsd > 0 ? editForm.pagadoUsd : null,
      observacion: editForm.observacion
    });
    setEditPago(null);
    load();
  };

  const removePago = async (p: Pago) => {
    if (!confirm(`¿Eliminar pago ref ${p.referencia}?`)) return;
    await pagosApi.delete(p.id);
    load();
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader title="Registro de pagos" subtitle={hint || 'Pagos, parciales y anticipos'} />

      <form onSubmit={submit} className="ios-glass-card form-grid">
        <FormField label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <ProveedorSearchField
          label="RIF"
          value={rif}
          proveedores={proveedores}
          onChange={onRif}
          required
        />
        <FormField label="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />

        <div className="form-grid-span-3">
          <FormCheckbox
            id="anticipo"
            label="Registrar como anticipo"
            checked={esAnticipo}
            onChange={(checked) => {
              setEsAnticipo(checked);
              if (checked) setFacturaId('');
            }}
          />
        </div>

        {!esAnticipo && (
          <FormField
            as="select"
            label="Documento"
            value={facturaId}
            onChange={(e) => onFacturaSelect(e.target.value)}
            options={[
              { value: '', label: 'Seleccionar factura…', key: 'doc-empty' },
              ...facturas.map((f) => ({
                value: f.id,
                key: f.id,
                label: `${f.tipo}-${f.numero} · ${f.rif}`
              }))
            ]}
          />
        )}

        {saldo && !esAnticipo && (
          <div className="field-highlight">
            <span className="field-label">Saldo pendiente</span>
            <MoneyValue value={saldo.saldoBs} size="lg" />
          </div>
        )}

        {!esAnticipo && anticipos.length > 0 && (
          <FormField as="select" label="Aplicar anticipo" value={anticipoId}
            onChange={(e) => setAnticipoId(e.target.value)} options={[
              { value: '', label: 'Sin anticipo' },
              ...anticipos.map((a) => ({
                value: a.id,
                key: a.id,
                label: `${a.referencia} — ${a.pagadoBs ?? 0} Bs`
              }))
            ]} />
        )}

        <FormField as="select" label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} options={[
          { value: '', label: '—' },
          ...bancos.map((b) => ({ value: b, label: b })),
          ...(banco && !bancos.includes(banco) ? [{ value: banco, label: banco }] : [])
        ]} />
        <FormField label="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} required />
        <MoneyInputField label="Pagado Bs" value={pagadoBs} onChange={onPagadoBsChange} required />
        <MoneyInputField label="Pagado USD" value={pagadoUsd} onChange={onPagadoUsdChange} />
        <FormField label="Observación" value={observacion} onChange={(e) => setObservacion(e.target.value)} />

        <div className="form-grid-span-3 form-actions">
          <button type="submit" className="ios-btn ios-btn-primary">Registrar</button>
          {msg && <span className="alert-success">{msg}</span>}
        </div>
      </form>

      {anticipos.length > 0 && (
        <div className="ios-glass-card">
          <div className="panel-header panel-header-accent-rose">
            <h2>Anticipos abiertos</h2>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>RIF</th>
                  <th>Ref</th>
                  <th className="col-num">Bs</th>
                  <th className="col-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {anticipos.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.fecha).toLocaleDateString('es-VE')}</td>
                    <td>{a.rif}</td>
                    <td>{a.referencia}</td>
                    <td className="col-num"><MoneyValue value={a.pagadoBs} size="sm" /></td>
                    <td className="col-center"><span className="badge badge-parcial">{a.estadoAnticipo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ios-glass-card">
        <div className="panel-header panel-header-accent-green">
          <h2>Historial de pagos</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Doc</th>
                <th>Proveedor</th>
                <th>Ref</th>
                <th className="col-num">Bs</th>
                <th className="col-num">USD</th>
                <AdminOnly><th className="col-center">Admin</th></AdminOnly>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.fecha).toLocaleDateString('es-VE')}</td>
                  <td className="col-text">{p.documento}</td>
                  <td>{p.proveedor}</td>
                  <td>{p.referencia}</td>
                  <td className="col-num"><MoneyValue value={p.pagadoBs} size="sm" /></td>
                  <td className="col-num"><MoneyValue value={p.pagadoUsd} size="sm" /></td>
                  <AdminOnly>
                    <td className="col-center">
                      <div className="table-actions">
                        <button type="button" className="link-green" onClick={() => openEdit(p)}>Editar</button>
                        <button type="button" className="link-rose" onClick={() => removePago(p)}>Eliminar</button>
                      </div>
                    </td>
                  </AdminOnly>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={editPago != null}
        onClose={() => setEditPago(null)}
        title="Editar pago"
        subtitle={editPago?.referencia}
        size="lg"
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setEditPago(null)}>
              Cancelar
            </button>
            <button type="submit" form="edit-pago-form" className="ios-btn ios-btn-primary">
              Guardar cambios
            </button>
          </>
        }
      >
        <form id="edit-pago-form" onSubmit={saveEdit} className="form-grid">
          <FormField label="Fecha" type="date" value={editForm.fecha}
            onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })} />
          <FormField label="RIF" value={editForm.rif}
            onChange={(e) => setEditForm({ ...editForm, rif: e.target.value })} />
          <FormField label="Proveedor" value={editForm.proveedor}
            onChange={(e) => setEditForm({ ...editForm, proveedor: e.target.value })} />
          <FormField label="Documento" value={editForm.documento}
            onChange={(e) => setEditForm({ ...editForm, documento: e.target.value })} />
          <FormField as="select" label="Banco" value={editForm.banco}
            onChange={(e) => setEditForm({ ...editForm, banco: e.target.value })} options={[
              { value: '', label: '—' },
              ...bancos.map((b) => ({ value: b, label: b }))
            ]} />
          <FormField label="Referencia" value={editForm.referencia}
            onChange={(e) => setEditForm({ ...editForm, referencia: e.target.value })} />
          <MoneyInputField label="Pagado Bs" value={editForm.pagadoBs}
            onChange={(n) => setEditForm({
              ...editForm,
              pagadoBs: n,
              pagadoUsd: tasa > 0 ? n / tasa : editForm.pagadoUsd
            })} />
          <MoneyInputField label="Pagado USD" value={editForm.pagadoUsd}
            onChange={(n) => setEditForm({
              ...editForm,
              pagadoUsd: n,
              pagadoBs: tasa > 0 ? n * tasa : editForm.pagadoBs
            })} />
          <FormField label="Observación" value={editForm.observacion}
            onChange={(e) => setEditForm({ ...editForm, observacion: e.target.value })} />
        </form>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar registro"
        subtitle={esAnticipo ? 'Anticipo' : documento}
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-btn ios-btn-primary" onClick={doSubmit}>
              Confirmar
            </button>
          </>
        }
      >
        <div className="detail-grid">
          <div className="detail-item"><label>Proveedor</label><span>{proveedor}</span></div>
          <div className="detail-item"><label>Referencia</label><span>{referencia}</span></div>
          <div className="detail-item"><label>Banco</label><span>{banco}</span></div>
          <div className="detail-item">
            <label>Monto Bs</label>
            <MoneyValue value={pagadoBs} size="lg" />
          </div>
          {pagadoUsd > 0 && (
            <div className="detail-item">
              <label>Monto USD</label>
              <MoneyValue value={pagadoUsd} />
            </div>
          )}
        </div>
      </Modal>
    </HeroTemplate>
  );
}
