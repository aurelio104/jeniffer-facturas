/**
 * URL base del API. En producción (Vercel u otro host) usa siempre el mismo dominio + /api.
 * VITE_API_URL solo aplica en desarrollo local (proxy Vite → 3020).
 */
export function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocal) {
      return `${origin}/api`;
    }
  }

  const raw = import.meta.env?.VITE_API_URL?.trim();
  const cleaned = raw?.replace(/\/$/, '');
  if (cleaned && !cleaned.includes('trycloudflare.com')) {
    return cleaned;
  }
  return '/api';
}
