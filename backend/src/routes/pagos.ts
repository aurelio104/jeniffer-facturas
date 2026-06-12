import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth-middleware.js';
import { logAuditoria } from '../services/auditoria.js';
import { obtenerTasaDelDia } from '../services/tasas.js';
import { getRequestUser } from '../lib/request-user.js';
import {
  calcularSaldoFactura,
  listAnticiposAbiertos,
  validarMontoPago,
  aplicarAnticipo
} from '../services/pagos-service.js';
import { suggestPagoPorRif } from '../services/factura-suggest.js';
import { refreshAlertasDebounced } from '../services/scheduler.js';
import { paramString } from '../lib/params.js';

const router = Router();

const schema = z.object({
  fecha: z.string(),
  rif: z.string(),
  proveedor: z.string(),
  documento: z.string(),
  banco: z.string(),
  referencia: z.string(),
  pagadoBs: z.number().optional().nullable(),
  pagadoUsd: z.number().optional().nullable(),
  tasa: z.number().optional().nullable(),
  observacion: z.string().optional(),
  estadoAnticipo: z.string().optional(),
  anticipoAplicado: z.number().optional().nullable(),
  facturaId: z.string().optional().nullable(),
  anticipoId: z.string().optional().nullable()
});

router.get('/', async (req, res) => {
  const rif = req.query.rif as string | undefined;
  res.json(
    await prisma.pago.findMany({
      where: rif ? { rif } : undefined,
      orderBy: { fecha: 'desc' }
    })
  );
});

router.get('/suggest/:rif', async (req, res) => {
  res.json(await suggestPagoPorRif(req.params.rif));
});

router.get('/anticipos', async (req, res) => {
  const rif = req.query.rif as string | undefined;
  res.json(await listAnticiposAbiertos(rif));
});

router.get('/saldo/:facturaId', async (req, res) => {
  const saldo = await calcularSaldoFactura(req.params.facturaId);
  if (!saldo) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(saldo);
});

router.post('/', async (req, res) => {
  const input = schema.parse(req.body);
  const usuario = getRequestUser(req);

  const dup = await prisma.pago.findFirst({
    where: { referencia: input.referencia, banco: input.banco, rif: input.rif }
  });
  if (dup) return res.status(409).json({ error: 'Referencia duplicada para este banco y RIF' });

  const esAnticipo =
    input.estadoAnticipo === 'Abierto' ||
    input.documento.toUpperCase() === 'ANTICIPO' ||
    !input.facturaId;

  if (input.facturaId && input.pagadoBs) {
    const saldo = await calcularSaldoFactura(input.facturaId);
    if (saldo) {
      const v = validarMontoPago(saldo.saldoBs, input.pagadoBs, esAnticipo);
      if (!v.ok) return res.status(400).json({ error: v.error });
    }
  }

  const fecha = new Date(input.fecha);
  let tasa = input.tasa ?? await obtenerTasaDelDia(fecha);
  let pagadoBs = input.pagadoBs;
  let pagadoUsd = input.pagadoUsd;
  if (pagadoUsd && !pagadoBs) pagadoBs = pagadoUsd * tasa;
  if (pagadoBs && !pagadoUsd && tasa) pagadoUsd = pagadoBs / tasa;

  const p = await prisma.pago.create({
    data: {
      fecha,
      rif: input.rif,
      proveedor: input.proveedor,
      documento: input.documento,
      banco: input.banco,
      referencia: input.referencia,
      pagadoBs,
      pagadoUsd,
      tasa,
      observacion: input.observacion,
      estadoAnticipo: esAnticipo ? 'Abierto' : input.estadoAnticipo,
      anticipoAplicado: input.anticipoAplicado,
      facturaId: input.facturaId
    }
  });

  if (input.anticipoId && input.facturaId && pagadoBs) {
    await aplicarAnticipo(input.anticipoId, input.facturaId, pagadoBs);
  }

  await logAuditoria('PAGO_REGISTRADO', `${input.documento} ref ${input.referencia}`, usuario);
  refreshAlertasDebounced();
  res.status(201).json(p);
});

const updateSchema = schema.partial().extend({
  fecha: z.string().optional(),
  rif: z.string().optional(),
  proveedor: z.string().optional(),
  documento: z.string().optional(),
  banco: z.string().optional(),
  referencia: z.string().optional()
});

router.put('/:id', requireAdmin, async (req, res) => {
  const id = paramString(req.params.id);
  const input = updateSchema.parse(req.body);
  const existing = await prisma.pago.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  const rif = input.rif ?? existing.rif;
  const banco = input.banco ?? existing.banco;
  const referencia = input.referencia ?? existing.referencia;

  if (referencia !== existing.referencia || banco !== existing.banco || rif !== existing.rif) {
    const dup = await prisma.pago.findFirst({
      where: { referencia, banco, rif, NOT: { id } }
    });
    if (dup) return res.status(409).json({ error: 'Referencia duplicada para este banco y RIF' });
  }

  const fecha = input.fecha ? new Date(input.fecha) : existing.fecha;
  let tasa = input.tasa ?? existing.tasa;
  let pagadoBs = input.pagadoBs ?? existing.pagadoBs;
  let pagadoUsd = input.pagadoUsd ?? existing.pagadoUsd;

  if (input.pagadoUsd != null && input.pagadoBs == null && tasa) {
    pagadoBs = input.pagadoUsd * tasa;
  }
  if (input.pagadoBs != null && input.pagadoUsd == null && tasa) {
    pagadoUsd = input.pagadoBs / tasa;
  }
  if (!tasa && (input.fecha || input.pagadoBs != null || input.pagadoUsd != null)) {
    tasa = await obtenerTasaDelDia(fecha);
  }

  const p = await prisma.pago.update({
    where: { id },
    data: {
      ...(input.fecha != null && { fecha }),
      ...(input.rif != null && { rif }),
      ...(input.proveedor != null && { proveedor: input.proveedor }),
      ...(input.documento != null && { documento: input.documento }),
      ...(input.banco != null && { banco }),
      ...(input.referencia != null && { referencia }),
      ...(input.observacion !== undefined && { observacion: input.observacion }),
      ...(input.estadoAnticipo !== undefined && { estadoAnticipo: input.estadoAnticipo }),
      ...(input.facturaId !== undefined && { facturaId: input.facturaId }),
      pagadoBs,
      pagadoUsd,
      tasa
    }
  });

  await logAuditoria('PAGO_ACTUALIZADO', `${p.documento} ref ${p.referencia}`, getRequestUser(req));
  refreshAlertasDebounced();
  res.json(p);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = paramString(req.params.id);
  await prisma.pago.delete({ where: { id } });
  await logAuditoria('PAGO_ELIMINADO', id, getRequestUser(req));
  refreshAlertasDebounced();
  res.status(204).end();
});

export default router;
