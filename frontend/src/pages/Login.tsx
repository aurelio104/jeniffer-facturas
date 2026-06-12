import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroTemplate } from '../components/HeroTemplate';
import { FormField } from '../components/FormField';
import { authApi } from '../services/api';
import { setSession } from '../lib/auth';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { user, token } = await authApi.login(username, password);
      setSession(user, token);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number }; code?: string };
      if (!ax.response || ax.code === 'ERR_NETWORK') {
        setError(
          'No hay conexión con el servidor. Abra: jeniffer-facturas-aurelio104-d09b8633.koyeb.app'
        );
      } else if (ax.response.status && ax.response.status >= 500) {
        setError(
          'Error del servidor (500). Use la app en Koyeb: jeniffer-facturas-aurelio104-d09b8633.koyeb.app'
        );
      } else {
        setError('Usuario o contraseña incorrectos');
      }
    }
  };

  return (
    <HeroTemplate variant="login">
      <div className="ios-glass-card ios-glass-card--lg max-w-md mx-auto" style={{ marginTop: '2rem' }}>
        <h1 className="text-xl font-bold mb-1" style={{
          background: 'linear-gradient(135deg, var(--text-primary), var(--green-dark), var(--rose-dark))',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent'
        }}>
          Control de Facturas
        </h1>
        <p className="text-sm mb-2 text-secondary">
          Ingresa tus credenciales
        </p>
        <p className="text-xs mb-6 text-muted">
          App en{' '}
          <a
            className="link-green"
            href="https://jeniffer-facturas-aurelio104-d09b8633.koyeb.app"
            target="_blank"
            rel="noreferrer"
          >
            jeniffer-facturas.koyeb.app
          </a>
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin o jeniffer"
            autoComplete="username"
            required
          />
          <FormField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
          />
          {error && <p className="alert-error">{error}</p>}
          <button type="submit" className="ios-btn ios-btn-primary w-full mt-2">
            Entrar
          </button>
        </form>
      </div>
    </HeroTemplate>
  );
}
