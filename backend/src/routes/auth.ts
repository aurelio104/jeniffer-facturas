import { Router } from 'express';
import { login, logout, seedUsers } from '../services/auth-service.js';
import type { AuthedRequest } from '../lib/auth-middleware.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  await seedUsers();
  const result = await login(username, password);
  if (!result) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ ok: true, user: result.user, token: result.token });
});

router.post('/logout', async (req, res) => {
  const header = req.headers.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : null;
  if (token) await logout(token);
  res.json({ ok: true });
});

router.get('/me', async (req: AuthedRequest, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'No autorizado' });
  res.json({ user: req.authUser });
});

export default router;
