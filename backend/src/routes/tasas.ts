import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth-middleware.js';
import {
  invalidateBcvCache,
  obtenerBcvStatus,
  obtenerTasasDia
} from '../services/bcv-service.js';
import {
  listarHistorico,
  obtenerTasaDelDia,
  sincronizarTasaHoy,
  upsertTasaLocal
} from '../services/tasas.js';
import { rebuildHistoricoBcv } from '../services/bcv-historico.js';
import { paramString } from '../lib/params.js';

const router = Router();

router.get('/', async (req, res) => {
  const meses = Number(req.query.meses) || 3;
  const list = await listarHistorico(meses);
  res.json(list);
});

/** Tasa del día — BCV en vivo (mismo servicio que Costos). */
router.get('/hoy', async (_req, res) => {
  const live = await sincronizarTasaHoy();
  res.json({
    fecha: new Date().toISOString().slice(0, 10),
    valor: live.valor,
    valorEur: live.valorEur,
    fechaValor: live.fecha,
    nombre: live.nombre,
    nombreEur: live.nombreEur,
    fuente: live.fuente
  });
});

/** Respuesta completa BCV (compatible con Costos /api/bcv/tasas). */
router.get('/bcv', async (_req, res) => {
  try {
    const tasas = await obtenerTasasDia();
    res.json({ ok: true, tasas });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'No se pudo obtener tasas BCV'
    });
  }
});

router.get('/bcv/status', async (_req, res) => {
  try {
    const status = await obtenerBcvStatus(true);
    res.json({ ok: true, ...status });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'No se pudo obtener diagnóstico BCV'
    });
  }
});

router.post('/bcv/refresh', async (_req, res) => {
  try {
    invalidateBcvCache();
    const status = await obtenerBcvStatus(true);
    await upsertTasaLocal(new Date(), {
      usd: status.tasas.usd.tasa,
      eur: status.tasas.eur.tasa
    });
    res.json({ ok: true, ...status });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'No se pudo refrescar BCV'
    });
  }
});

/** Limpia histórico y reconstruye últimos 3 meses desde XLS oficiales BCV + tasa viva. */
router.post('/bcv/rebuild-historico', requireAdmin, async (_req, res) => {
  try {
    invalidateBcvCache();
    const result = await rebuildHistoricoBcv(3);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'No se pudo reconstruir histórico BCV'
    });
  }
});

router.get('/dia/:fecha', async (req, res) => {
  const d = new Date(req.params.fecha);
  const valor = await obtenerTasaDelDia(d);
  res.json({ fecha: req.params.fecha, valor });
});

router.post('/', requireAdmin, async (req, res) => {
  const { fecha, valor, valorEur } = z.object({
    fecha: z.string(),
    valor: z.number().positive(),
    valorEur: z.number().positive().optional().nullable()
  }).parse(req.body);

  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);

  const t = await prisma.tasa.upsert({
    where: { fecha: d },
    create: { fecha: d, valor, valorEur: valorEur ?? null },
    update: { valor, ...(valorEur != null && { valorEur }) }
  });
  res.status(201).json(t);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const id = paramString(req.params.id);
  const { valor, valorEur } = z.object({
    valor: z.number().positive(),
    valorEur: z.number().positive().optional().nullable()
  }).parse(req.body);

  const t = await prisma.tasa.update({
    where: { id },
    data: { valor, ...(valorEur !== undefined && { valorEur }) }
  });
  res.json(t);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = paramString(req.params.id);
  await prisma.tasa.delete({ where: { id } });
  res.status(204).end();
});

export default router;
