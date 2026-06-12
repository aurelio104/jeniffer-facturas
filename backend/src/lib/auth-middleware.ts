import type { NextFunction, Request, Response } from 'express';
import { validateToken, type AuthUser } from '../services/auth-service.js';

export type AuthedRequest = Request & { authUser?: AuthUser };

const OPEN_PATHS = new Set(['/health', '/auth/login']);

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next();

  const path = req.path.replace(/\/$/, '') || '/';
  if (OPEN_PATHS.has(path)) return next();

  const header = req.headers.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : null;

  if (!token) return res.status(401).json({ error: 'Sesión requerida' });

  const user = await validateToken(token);
  if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });

  req.authUser = user;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.authUser?.rol !== 'admin') {
    return res.status(403).json({ error: 'Requiere rol administrador' });
  }
  next();
}
