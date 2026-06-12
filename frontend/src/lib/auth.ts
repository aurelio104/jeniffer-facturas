export type SessionUser = { id: string; username: string; nombre: string; rol: string };

const USER_KEY = 'jeniffer_user';
const TOKEN_KEY = 'jeniffer_token';
const AUTH_KEY = 'jeniffer_auth';

export function getSession(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(user: SessionUser, token: string) {
  localStorage.setItem(AUTH_KEY, '1');
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
  // Limpiar claves antiguas
  localStorage.removeItem('yennifer_auth');
  localStorage.removeItem('yennifer_user');
  localStorage.removeItem('yennifer_token');
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('yennifer_auth');
  localStorage.removeItem('yennifer_user');
  localStorage.removeItem('yennifer_token');
}

export function isAdmin() {
  return getSession()?.rol === 'admin';
}

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === '1' && getToken();
}
