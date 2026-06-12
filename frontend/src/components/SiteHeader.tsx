import { Link, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, LogOut } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { AlertBell } from './AlertBell';
import { authApi } from '../services/api';
import { clearSession, getSession } from '../lib/auth';

type HeaderVariant = 'login' | 'app';

export function SiteHeader({ variant = 'app' }: { variant?: HeaderVariant }) {
  const navigate = useNavigate();
  const user = getSession();

  const logout = async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <header className="site-header-global fixed top-0 left-0 right-0 z-[100]">
      <div className="h-16 flex items-center justify-between gap-3 px-4 max-w-[var(--content-max)] mx-auto w-full">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0 no-underline">
          <div className="site-logo">
            <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--green-text)' }} />
          </div>
          <span className="site-brand hidden sm:inline text-sm">Jeniffer Facturas</span>
        </Link>

        {variant === 'app' && (
          <>
            <GlobalSearch />
            <div className="flex items-center gap-2 shrink-0">
              <AlertBell />
              {user && (
                <span className="site-user hidden md:inline tabular-nums">
                  {user.nombre}
                  <span className="site-user-role"> · </span>
                  {user.rol}
                </span>
              )}
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl border border-transparent hover:border-[var(--border-medium)] hover:bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--rose-text)] transition-colors"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
