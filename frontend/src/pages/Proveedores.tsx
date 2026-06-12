import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { proveedoresApi, maestraApi, type Proveedor } from '../services/api';
import { AdminOnly } from '../components/AdminOnly';

const empty: Partial<Proveedor> = {
  rif: '',
  nombre: '',
  tipoIslr: 'PNR',
  retencionIva: '100%'
};

export function Proveedores() {
  const [list, setList] = useState<Proveedor[]>([]);
  const [form, setForm] = useState<Partial<Proveedor>>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [tiposIslr, setTiposIslr] = useState<string[]>(['PNR', 'PJD', 'PJND', 'PNNR']);
  const [retencionesIva, setRetencionesIva] = useState<string[]>(['100%', '75%', 'EXENTA']);
  const [estaciones, setEstaciones] = useState<string[]>([]);
  const [bancos, setBancos] = useState<string[]>([]);

  const load = () => proveedoresApi.list().then(setList);
  useEffect(() => {
    load();
    maestraApi.config('tipo_islr').then((c) => c.length && setTiposIslr(c.map((x) => x.valor)));
    maestraApi.config('retencion_iva').then((c) => c.length && setRetencionesIva(c.map((x) => x.valor)));
    maestraApi.config('estacion').then((c) => setEstaciones(c.map((x) => x.valor)));
    maestraApi.config('banco').then((c) => setBancos(c.map((x) => x.valor)));
  }, []);

  const openNew = () => {
    setForm(empty);
    setEditing(null);
    setModalOpen(true);
    setMsg('');
  };

  const edit = (p: Proveedor) => {
    setForm(p);
    setEditing(p.rif);
    setModalOpen(true);
    setMsg('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      if (editing) {
        await proveedoresApi.update(editing, form);
        setMsg('Proveedor actualizado');
      } else {
        await proveedoresApi.create(form);
        setMsg('Proveedor creado');
      }
      setForm(empty);
      setEditing(null);
      load();
      setTimeout(() => setModalOpen(false), 600);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error ?? 'Error al guardar');
    }
  };

  const remove = async (rif: string) => {
    if (!confirm(`¿Eliminar proveedor ${rif}?`)) return;
    try {
      await proveedoresApi.delete(rif);
      load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error ?? 'No se pudo eliminar (puede tener facturas asociadas)');
    }
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Proveedores"
        subtitle={`${list.length} registrados`}
        actions={
          <button type="button" className="ios-btn ios-btn-primary ios-btn-sm" onClick={openNew}>
            + Nuevo proveedor
          </button>
        }
      />

      <div className="ios-glass-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>RIF</th>
                <th>Nombre</th>
                <th className="col-center">ISLR</th>
                <th className="col-center">IVA</th>
                <th className="col-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="row-clickable" onClick={() => edit(p)}>
                  <td className="col-text">{p.rif}</td>
                  <td>{p.nombre}</td>
                  <td className="col-center"><span className="badge badge-parcial">{p.tipoIslr}</span></td>
                  <td className="col-center">{p.retencionIva}</td>
                  <td className="col-center">
                    <div className="table-actions">
                      <button type="button" className="link-green" onClick={(e) => { e.stopPropagation(); edit(p); }}>
                        Editar
                      </button>
                      <AdminOnly>
                        <button type="button" className="link-rose" onClick={(e) => { e.stopPropagation(); remove(p.rif); }}>
                          Eliminar
                        </button>
                      </AdminOnly>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        size="lg"
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="proveedor-form" className="ios-btn ios-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="proveedor-form" onSubmit={save} className="form-grid">
          <FormField label="RIF" value={form.rif ?? ''} onChange={(e) => setForm({ ...form, rif: e.target.value })} disabled={!!editing} required />
          <FormField label="Nombre" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          <FormField as="select" label="Tipo ISLR" value={form.tipoIslr ?? 'PNR'} onChange={(e) => setForm({ ...form, tipoIslr: e.target.value })} options={
            tiposIslr.map((t) => ({ value: t, label: t }))
          } />
          <FormField as="select" label="Retención IVA" value={form.retencionIva ?? '100%'} onChange={(e) => setForm({ ...form, retencionIva: e.target.value })} options={
            retencionesIva.map((t) => ({ value: t, label: t }))
          } />
          <FormField as="select" label="Banco" value={form.banco ?? ''} onChange={(e) => setForm({ ...form, banco: e.target.value })} options={[
            { value: '', label: '—' },
            ...bancos.map((b) => ({ value: b, label: b }))
          ]} />
          <FormField as="select" label="Estación" value={form.estacion ?? ''} onChange={(e) => setForm({ ...form, estacion: e.target.value })} options={[
            { value: '', label: '—' },
            ...estaciones.map((e) => ({ value: e, label: e }))
          ]} />
          <FormField label="Nº cuenta" value={form.numCuenta ?? ''} onChange={(e) => setForm({ ...form, numCuenta: e.target.value })} />
          <FormField label="Titular" value={form.titular ?? ''} onChange={(e) => setForm({ ...form, titular: e.target.value })} />
          <FormField label="ID titular" value={form.idTitular ?? ''} onChange={(e) => setForm({ ...form, idTitular: e.target.value })} />
          <FormField label="Dirección" value={form.direccion ?? ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <FormField label="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormField label="Teléfono" value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          {msg && <p className="form-grid-span-3 alert-success">{msg}</p>}
        </form>
      </Modal>
    </HeroTemplate>
  );
}
