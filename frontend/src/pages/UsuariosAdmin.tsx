import { useEffect, useState } from 'react';
import { HeroTemplate } from '../components/HeroTemplate';
import { AppNav } from '../components/AppNav';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { adminApi, type AuthUser } from '../services/api';
import { getSession } from '../lib/auth';

const empty = { username: '', nombre: '', password: '', rol: 'operador' };

export function UsuariosAdmin() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const me = getSession();

  const load = () => adminApi.users().then(setUsers);

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
    setMsg('');
    setErr('');
  };

  const openEdit = (u: AuthUser) => {
    setEditing(u);
    setForm({ username: u.username, nombre: u.nombre, password: '', rol: u.rol });
    setModalOpen(true);
    setMsg('');
    setErr('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      if (editing) {
        await adminApi.updateUser(editing.id, {
          nombre: form.nombre,
          rol: form.rol,
          ...(form.password ? { password: form.password } : {})
        });
        setMsg('Usuario actualizado');
      } else {
        await adminApi.createUser(form);
        setMsg('Usuario creado');
      }
      await load();
      setModalOpen(false);
      setForm(empty);
      setEditing(null);
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error ?? 'Error al guardar');
    }
  };

  const remove = async (u: AuthUser) => {
    if (!confirm(`¿Eliminar usuario «${u.username}»?`)) return;
    try {
      await adminApi.deleteUser(u.id);
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
        title="Usuarios"
        subtitle="Cuentas y roles del sistema"
        actions={
          <button type="button" className="ios-btn ios-btn-primary ios-btn-sm" onClick={openNew}>
            + Nuevo usuario
          </button>
        }
      />

      {msg && <p className="alert-success mb-3">{msg}</p>}

      <div className="ios-glass-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th className="col-center">Rol</th>
                <th className="col-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="col-text">{u.username}</td>
                  <td>{u.nombre}</td>
                  <td className="col-center">
                    <span className={`badge ${u.rol === 'admin' ? 'badge-pagada' : 'badge-parcial'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="col-center">
                    <div className="table-actions">
                      <button type="button" className="link-green" onClick={() => openEdit(u)}>Editar</button>
                      {u.id !== me?.id && (
                        <button type="button" className="link-rose" onClick={() => remove(u)}>Eliminar</button>
                      )}
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
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        footer={
          <>
            <button type="button" className="ios-btn ios-btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="user-form" className="ios-btn ios-btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={save} className="form-grid form-grid-1" autoComplete="off">
          <FormField
            label="Usuario"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={!!editing}
            required
            autoComplete="off"
            name="new-user-username"
          />
          <FormField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            autoComplete="name"
            name="new-user-nombre"
          />
          <FormField
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
            autoComplete="new-password"
            name="new-user-password"
          />
          <FormField
            as="select"
            label="Rol"
            value={form.rol}
            onChange={(e) => setForm({ ...form, rol: e.target.value })}
            options={[
              { value: 'operador', label: 'Operador' },
              { value: 'admin', label: 'Administrador' }
            ]}
          />
          {err && <p className="alert-error">{err}</p>}
        </form>
      </Modal>
    </HeroTemplate>
  );
}
