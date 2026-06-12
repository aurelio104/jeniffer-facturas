import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { CATALOG_TABS } from '../lib/catalogs';
import { adminApi, type ConfigItem } from '../services/api';

export function AdminCatalogos() {
  const [tab, setTab] = useState(CATALOG_TABS[0].id);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigItem | null>(null);
  const [valor, setValor] = useState('');
  const [extra, setExtra] = useState('');
  const [msg, setMsg] = useState('');

  const meta = CATALOG_TABS.find((t) => t.id === tab)!;

  const load = () => adminApi.config(tab).then(setItems);

  useEffect(() => {
    load();
    setMsg('');
  }, [tab]);

  const openNew = () => {
    setEditing(null);
    setValor('');
    setExtra('');
    setModalOpen(true);
  };

  const openEdit = (item: ConfigItem) => {
    setEditing(item);
    setValor(item.valor);
    setExtra(item.extra ?? '');
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      if (editing) {
        await adminApi.updateConfig(editing.id, {
          valor,
          extra: extra || null
        });
        setMsg('Elemento actualizado');
      } else {
        await adminApi.createConfig({ categoria: tab, valor, extra: extra || null });
        setMsg('Elemento creado');
      }
      load();
      setTimeout(() => setModalOpen(false), 500);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error ?? 'Error al guardar');
    }
  };

  const remove = async (item: ConfigItem) => {
    if (!confirm(`¿Eliminar «${item.valor}» de ${meta.label}?`)) return;
    try {
      await adminApi.deleteConfig(item.id);
      load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error ?? 'No se pudo eliminar');
    }
  };

  return (
    <HeroTemplate>
      <AppNav />
      <PageHeader
        title="Catálogos del sistema"
        subtitle="Listas usadas en facturas, pagos y proveedores"
        actions={
          <button type="button" className="ios-btn ios-btn-primary ios-btn-sm" onClick={openNew}>
            + Añadir
          </button>
        }
      />

      <div className="catalog-tabs">
        {CATALOG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`catalog-tab ${tab === t.id ? 'catalog-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="alert-success mb-3">{msg}</p>}

      <div className="ios-glass-card">
        <div className="panel-header panel-header-accent-green">
          <h2>{meta.label}</h2>
          <span className="panel-meta">{items.length} elementos</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Valor</th>
                {meta.extraLabel && <th>{meta.extraLabel}</th>}
                <th className="col-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="col-text">{item.valor}</td>
                  {meta.extraLabel && <td>{item.extra ?? '—'}</td>}
                  <td className="col-center">
                    <div className="table-actions">
                      <button type="button" className="link-green" onClick={() => openEdit(item)}>Editar</button>
                      <button type="button" className="link-rose" onClick={() => remove(item)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <p className="text-sm text-muted mt-2">Sin elementos. Usa «Añadir» para crear el primero.</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar elemento' : `Nuevo en ${meta.label}`}
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="catalog-form" className="ios-btn ios-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="catalog-form" onSubmit={save} className="form-grid form-grid-1">
          <FormField label="Valor" value={valor} onChange={(e) => setValor(e.target.value)} required />
          {meta.extraLabel && (
            <FormField label={meta.extraLabel} value={extra} onChange={(e) => setExtra(e.target.value)} />
          )}
        </form>
      </Modal>
    </HeroTemplate>
  );
}
