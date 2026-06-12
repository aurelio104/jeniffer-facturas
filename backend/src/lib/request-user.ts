import type { Request } from 'express';
import type { AuthedRequest } from './auth-middleware.js';

export function getRequestUser(req: Request): string {
  const authed = req as AuthedRequest;
  if (authed.authUser?.username) return authed.authUser.username;
  const h = req.headers['x-usuario'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  const body = req.body as { usuario?: string } | undefined;
  if (body?.usuario) return body.usuario;
  return 'local';
}
