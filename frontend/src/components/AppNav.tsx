import { NavLink } from 'react-router-dom';
import { isAdmin } from '../lib/auth';

const links = [
  { to: '/dashboard', label: 'Panel' },
  { to: '/maestra', label: 'BD Maestra' },
  { to: '/facturas', label: 'Facturas' },
  { to: '/pagos', label: 'Pagos' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/tasas', label: 'Tasas BCV' },
  { to: '/resumen', label: 'Resumen' },
  { to: '/auditoria', label: 'Auditoría' },
  { to: '/exportar', label: 'Exportar' }
];

export function AppNav() {
  const adminLinks = isAdmin()
    ? [
        { to: '/admin/catalogos', label: 'Catálogos' },
        { to: '/tab-islr', label: 'Tab ISLR' },
        { to: '/admin/usuarios', label: 'Usuarios' }
      ]
    : [];

  return (
    <nav className="app-nav">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          {l.label}
        </NavLink>
      ))}
      {adminLinks.map((l) => (
        <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
