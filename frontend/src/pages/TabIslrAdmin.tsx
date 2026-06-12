import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { adminApi, type TabIslr } from '../services/api';

const emptyRow: Partial<TabIslr> = {
  concepto: '',
  basePnr: undefined,
  pnr: undefined,
  pagosMinBs: undefined,
  sustraendoBs: undefined,
  basePjd: undefined,
  pjd: undefined,
  basePjnd: undefined,
  pjnd: undefined,
  basePnnr: undefined,
  pnnr: undefined
};

export function TabIslrAdmin() {
  const [rows, setRows] = useState<TabIslr[]>([]);
  const [msg, setMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<TabIslr>>(emptyRow);
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => adminApi.tabIslr().then(setRows);

  useEffect(() => {
    load();
  }, []);

  const num = (v: string) => (v === '' ? undefined : parseFloat(v));

  const openNew = () => {
    setForm(emptyRow);
    setEditing(null);
    setModalOpen(true);
  };

  const saveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      if (editing) {
        await adminApi.updateTabIslr(editing, form);
        setMsg('Concepto actualizado');
      } else {
        await adminApi.createTabIslr(form);
        setMsg('Concepto creado');
      }
      load();
      setTimeout(() => setModalOpen(false), 500);
    } catch {
      setMsg('Error al guardar');
    }
  };

  const remove = async (r: TabIslr) => {
    if (!confirm(`¿Eliminar concepto «${r.concepto}»?`)) return;
    await adminApi.deleteTabIslr(r.id);
    load();
  };

  const saveInline = async (row: TabIslr) => {
    setMsg('');
    await adminApi.updateTabIslr(row.id, row);
    setMsg('Tabla ISLR actualizada');
    load();
  };

  const updateField = (id: string, field: keyof TabIslr, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: value === '' ? undefined : parseFloat(value) } : r
      )
    );
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Tabla ISLR"
        subtitle="Conceptos, bases y porcentajes por tipo de contribuyente"
        actions={
          <button type="button" className="ios-btn ios-btn-primary ios-btn-sm" onClick={openNew}>
            + Nuevo concepto
          </button>
        }
      />

      <div className="ios-glass-card">
        <div className="data-table-wrap">
          <table className="data-table data-table-compact">
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="col-num">Base PNR</th>
                <th className="col-num">PNR %</th>
                <th className="col-num">Base PJD</th>
                <th className="col-num">PJD %</th>
                <th className="col-num">Base PJND</th>
                <th className="col-num">PJND %</th>
                <th className="col-num">Base PNNR</th>
                <th className="col-num">PNNR %</th>
                <th className="col-center"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="col-text font-medium">{r.concepto}</td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.basePnr ?? ''} onChange={(e) => updateField(r.id, 'basePnr', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.pnr ?? ''} onChange={(e) => updateField(r.id, 'pnr', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.basePjd ?? ''} onChange={(e) => updateField(r.id, 'basePjd', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.pjd ?? ''} onChange={(e) => updateField(r.id, 'pjd', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.basePjnd ?? ''} onChange={(e) => updateField(r.id, 'basePjnd', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.pjnd ?? ''} onChange={(e) => updateField(r.id, 'pjnd', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.basePnnr ?? ''} onChange={(e) => updateField(r.id, 'basePnnr', e.target.value)} />
                  </td>
                  <td className="col-num">
                    <input className="field-input field-input-sm text-right" type="number" step="0.01"
                      value={r.pnnr ?? ''} onChange={(e) => updateField(r.id, 'pnnr', e.target.value)} />
                  </td>
                  <td className="col-center">
                    <div className="table-actions">
                      <button type="button" className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => saveInline(r)}>
                        Guardar
                      </button>
                      <button type="button" className="link-rose" onClick={() => remove(r)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <p className="alert-success mt-3">{msg}</p>}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar concepto ISLR' : 'Nuevo concepto ISLR'}
        size="lg"
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="tab-islr-form" className="ios-btn ios-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="tab-islr-form" onSubmit={saveModal} className="form-grid">
          <FormField
            label="Concepto"
            value={form.concepto ?? ''}
            onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            required
            className="form-grid-span-3"
          />
          <FormField label="Base PNR" type="number" step="0.01" value={form.basePnr ?? ''}
            onChange={(e) => setForm({ ...form, basePnr: num(e.target.value) })} />
          <FormField label="PNR %" type="number" step="0.01" value={form.pnr ?? ''}
            onChange={(e) => setForm({ ...form, pnr: num(e.target.value) })} />
          <FormField label="Pagos mín. Bs" type="number" step="0.01" value={form.pagosMinBs ?? ''}
            onChange={(e) => setForm({ ...form, pagosMinBs: num(e.target.value) })} />
          <FormField label="Sustraendo Bs" type="number" step="0.01" value={form.sustraendoBs ?? ''}
            onChange={(e) => setForm({ ...form, sustraendoBs: num(e.target.value) })} />
          <FormField label="Base PJD" type="number" step="0.01" value={form.basePjd ?? ''}
            onChange={(e) => setForm({ ...form, basePjd: num(e.target.value) })} />
          <FormField label="PJD %" type="number" step="0.01" value={form.pjd ?? ''}
            onChange={(e) => setForm({ ...form, pjd: num(e.target.value) })} />
          <FormField label="Base PJND" type="number" step="0.01" value={form.basePjnd ?? ''}
            onChange={(e) => setForm({ ...form, basePjnd: num(e.target.value) })} />
          <FormField label="PJND %" type="number" step="0.01" value={form.pjnd ?? ''}
            onChange={(e) => setForm({ ...form, pjnd: num(e.target.value) })} />
          <FormField label="Base PNNR" type="number" step="0.01" value={form.basePnnr ?? ''}
            onChange={(e) => setForm({ ...form, basePnnr: num(e.target.value) })} />
          <FormField label="PNNR %" type="number" step="0.01" value={form.pnnr ?? ''}
            onChange={(e) => setForm({ ...form, pnnr: num(e.target.value) })} />
        </form>
      </Modal>
    </HeroTemplate>
  );
}
