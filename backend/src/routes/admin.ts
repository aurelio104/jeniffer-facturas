import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, type AuthedRequest } from '../lib/auth-middleware.js';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  listUsers,
  createUser,
  updateUser,
  deleteUser
} from '../services/auth-service.js';
import { logAuditoria } from '../services/auditoria.js';
import { getRequestUser } from '../lib/request-user.js';
import { paramString } from '../lib/params.js';

const router = Router();
router.use(requireAdmin);

router.get('/backup', (_req, res) => {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Base de datos no encontrada' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="jeniffer-backup-${stamp}.db"`);
  fs.createReadStream(dbPath).pipe(res);
});

const configSchema = z.object({
  categoria: z.string().min(1),
  valor: z.string().min(1),
  extra: z.string().optional().nullable(),
  orden: z.number().int().optional()
});

router.get('/config', async (req, res) => {
  const categoria = req.query.categoria as string | undefined;
  const items = await prisma.configItem.findMany({
    where: categoria ? { categoria } : undefined,
    orderBy: [{ categoria: 'asc' }, { orden: 'asc' }, { valor: 'asc' }]
  });
  res.json(items);
});

router.post('/config', async (req, res) => {
  const data = configSchema.parse(req.body);
  const dup = await prisma.configItem.findFirst({
    where: { categoria: data.categoria, valor: data.valor }
  });
  if (dup) return res.status(409).json({ error: 'Valor duplicado en esta categoría' });

  const maxOrden = await prisma.configItem.aggregate({
    where: { categoria: data.categoria },
    _max: { orden: true }
  });
  const item = await prisma.configItem.create({
    data: {
      categoria: data.categoria,
      valor: data.valor,
      extra: data.extra ?? null,
      orden: data.orden ?? (maxOrden._max.orden ?? 0) + 1
    }
  });
  await logAuditoria('CONFIG_CREADO', `${data.categoria}: ${data.valor}`, getRequestUser(req));
  res.status(201).json(item);
});

router.put('/config/:id', async (req, res) => {
  const data = configSchema.partial().parse(req.body);
  const current = await prisma.configItem.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: 'Elemento no encontrado' });

  if (data.valor && data.valor !== current.valor) {
    const dup = await prisma.configItem.findFirst({
      where: {
        categoria: data.categoria ?? current.categoria,
        valor: data.valor,
        NOT: { id: req.params.id }
      }
    });
    if (dup) return res.status(409).json({ error: 'Valor duplicado en esta categoría' });
  }

  const item = await prisma.configItem.update({
    where: { id: req.params.id },
    data: {
      ...(data.categoria != null && { categoria: data.categoria }),
      ...(data.valor != null && { valor: data.valor }),
      ...(data.extra !== undefined && { extra: data.extra }),
      ...(data.orden != null && { orden: data.orden })
    }
  });
  await logAuditoria('CONFIG_ACTUALIZADO', `${item.categoria}: ${item.valor}`, getRequestUser(req));
  res.json(item);
});

router.delete('/config/:id', async (req, res) => {
  const item = await prisma.configItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Elemento no encontrado' });
  await prisma.configItem.delete({ where: { id: req.params.id } });
  await logAuditoria('CONFIG_ELIMINADO', `${item.categoria}: ${item.valor}`, getRequestUser(req));
  res.status(204).end();
});

const userCreateSchema = z.object({
  username: z.string().min(2),
  nombre: z.string().min(2),
  password: z.string().min(4),
  rol: z.enum(['admin', 'operador'])
});

const userUpdateSchema = z.object({
  nombre: z.string().min(2).optional(),
  password: z.string().min(4).optional(),
  rol: z.enum(['admin', 'operador']).optional()
});

router.get('/users', async (_req, res) => {
  res.json(await listUsers());
});

router.post('/users', async (req, res) => {
  const data = userCreateSchema.parse(req.body);
  try {
    const user = await createUser(data);
    await logAuditoria('USUARIO_CREADO', user.username, getRequestUser(req));
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'Usuario ya existe' });
  }
});

router.put('/users/:id', async (req: AuthedRequest, res) => {
  const id = paramString(req.params.id);
  const data = userUpdateSchema.parse(req.body);
  if (req.authUser?.id === id && data.rol && data.rol !== 'admin') {
    return res.status(400).json({ error: 'No puedes quitarte el rol admin a ti mismo' });
  }
  try {
    const user = await updateUser(id, data);
    await logAuditoria('USUARIO_ACTUALIZADO', user.username, getRequestUser(req));
    res.json(user);
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

router.delete('/users/:id', async (req: AuthedRequest, res) => {
  const id = paramString(req.params.id);
  if (req.authUser?.id === id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  try {
    const user = await deleteUser(id);
    await logAuditoria('USUARIO_ELIMINADO', user.username, getRequestUser(req));
    res.status(204).end();
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

const tabIslrSchema = z.object({
  concepto: z.string().min(1),
  basePnr: z.number().optional().nullable(),
  pnr: z.number().optional().nullable(),
  pagosMinBs: z.number().optional().nullable(),
  sustraendoBs: z.number().optional().nullable(),
  basePjd: z.number().optional().nullable(),
  pjd: z.number().optional().nullable(),
  basePjnd: z.number().optional().nullable(),
  pjnd: z.number().optional().nullable(),
  basePnnr: z.number().optional().nullable(),
  pnnr: z.number().optional().nullable(),
  t2Pnr: z.boolean().optional(),
  t2Pjd: z.boolean().optional(),
  t2Pjnd: z.boolean().optional(),
  t2Pnnr: z.boolean().optional(),
  orden: z.number().int().optional()
});

router.get('/tab-islr', async (_req, res) => {
  res.json(await prisma.tabIslr.findMany({ orderBy: { orden: 'asc' } }));
});

router.post('/tab-islr', async (req, res) => {
  const data = tabIslrSchema.parse(req.body);
  const maxOrden = await prisma.tabIslr.aggregate({ _max: { orden: true } });
  const row = await prisma.tabIslr.create({
    data: {
      ...data,
      orden: data.orden ?? (maxOrden._max.orden ?? 0) + 1
    }
  });
  await logAuditoria('TAB_ISLR_CREADO', row.concepto, getRequestUser(req));
  res.status(201).json(row);
});

router.put('/tab-islr/:id', async (req, res) => {
  const data = tabIslrSchema.partial().parse(req.body);
  const row = await prisma.tabIslr.update({
    where: { id: req.params.id },
    data
  });
  await logAuditoria('TAB_ISLR_ACTUALIZADO', row.concepto, getRequestUser(req));
  res.json(row);
});

router.delete('/tab-islr/:id', async (req, res) => {
  const row = await prisma.tabIslr.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Concepto no encontrado' });
  await prisma.tabIslr.delete({ where: { id: req.params.id } });
  await logAuditoria('TAB_ISLR_ELIMINADO', row.concepto, getRequestUser(req));
  res.status(204).end();
});

export default router;
