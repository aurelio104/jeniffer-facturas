import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth-middleware.js';
import { logAuditoria } from '../services/auditoria.js';
import { paramString } from '../lib/params.js';

const router = Router();

const schema = z.object({
  rif: z.string().min(3),
  nombre: z.string().min(2),
  tipoIslr: z.string(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  numCuenta: z.string().optional(),
  banco: z.string().optional(),
  titular: z.string().optional(),
  idTitular: z.string().optional(),
  retencionIva: z.string().optional(),
  estacion: z.string().optional(),
  referido: z.string().optional(),
  servicio: z.string().optional(),
  notas: z.string().optional()
});

router.get('/', async (_req, res) => {
  const list = await prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } });
  res.json(list);
});

router.get('/:rif', async (req, res) => {
  const p = await prisma.proveedor.findUnique({ where: { rif: req.params.rif } });
  if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(p);
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const existing = await prisma.proveedor.findUnique({ where: { rif: data.rif } });
  if (existing) return res.status(409).json({ error: 'RIF ya registrado' });

  const p = await prisma.proveedor.create({
    data: { ...data, retencionIva: data.retencionIva ?? '100%' }
  });
  await logAuditoria('PROVEEDOR_CREADO', `${p.rif} ${p.nombre}`);
  res.status(201).json(p);
});

router.put('/:rif', async (req, res) => {
  const data = schema.parse(req.body);
  const p = await prisma.proveedor.update({
    where: { rif: req.params.rif },
    data: { ...data, retencionIva: data.retencionIva ?? '100%' }
  });
  await logAuditoria('PROVEEDOR_ACTUALIZADO', `${p.rif}`);
  res.json(p);
});

router.delete('/:rif', requireAdmin, async (req, res) => {
  const rif = paramString(req.params.rif);
  try {
    await prisma.proveedor.delete({ where: { rif } });
    await logAuditoria('PROVEEDOR_ELIMINADO', rif);
    res.status(204).end();
  } catch {
    res.status(400).json({ error: 'No se puede eliminar: el proveedor tiene facturas asociadas' });
  }
});

export default router;
