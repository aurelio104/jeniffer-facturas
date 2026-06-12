import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Proveedores } from './pages/Proveedores';
import { Facturas } from './pages/Facturas';
import { FacturaForm } from './pages/FacturaForm';
import { Pagos } from './pages/Pagos';
import { Maestra } from './pages/Maestra';
import { Tasas } from './pages/Tasas';
import { Resumen } from './pages/Resumen';
import { Auditoria } from './pages/Auditoria';
import { TabIslrAdmin } from './pages/TabIslrAdmin';
import { AdminCatalogos } from './pages/AdminCatalogos';
import { UsuariosAdmin } from './pages/UsuariosAdmin';
import { Exportar } from './pages/Exportar';
import { isAdmin, isAuthenticated } from './lib/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const ok = isAuthenticated();
  if (!ok) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/proveedores" element={<RequireAuth><Proveedores /></RequireAuth>} />
      <Route path="/facturas" element={<RequireAuth><Facturas /></RequireAuth>} />
      <Route path="/facturas/nueva" element={<RequireAuth><FacturaForm /></RequireAuth>} />
      <Route path="/facturas/:id" element={<RequireAuth><FacturaForm /></RequireAuth>} />
      <Route path="/pagos" element={<RequireAuth><Pagos /></RequireAuth>} />
      <Route path="/maestra" element={<RequireAuth><Maestra /></RequireAuth>} />
      <Route path="/tasas" element={<RequireAuth><Tasas /></RequireAuth>} />
      <Route path="/resumen" element={<RequireAuth><Resumen /></RequireAuth>} />
      <Route path="/auditoria" element={<RequireAuth><Auditoria /></RequireAuth>} />
      <Route path="/exportar" element={<RequireAuth><Exportar /></RequireAuth>} />
      <Route path="/admin/catalogos" element={<RequireAuth><RequireAdmin><AdminCatalogos /></RequireAdmin></RequireAuth>} />
      <Route path="/admin/usuarios" element={<RequireAuth><RequireAdmin><UsuariosAdmin /></RequireAdmin></RequireAuth>} />
      <Route path="/tab-islr" element={<RequireAuth><RequireAdmin><TabIslrAdmin /></RequireAdmin></RequireAuth>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
