import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth-middleware.js';
import { logAuditoria } from '../services/auditoria.js';
import { getRequestUser } from '../lib/request-user.js';
import { calcularIvaYNeto, calcularIslr, type ConceptoIslrInput } from '../services/islr.js';
import {
  normalizarConceptosIslr,
  validarSumaConceptosIslr
} from '../services/factura-calc.js';
import { obtenerTasaDelDia } from '../services/tasas.js';
import { suggestFacturaPorRif, checkFacturaDuplicada } from '../services/factura-suggest.js';
import { refreshAlertasDebounced } from '../services/scheduler.js';
import { paramString } from '../lib/params.js';

const router = Router();

const conceptoSchema = z.object({ concepto: z.string(), monto: z.number() });

const schema = z.object({
  tipo: z.string(),
  numero: z.string(),
  rif: z.string(),
  proveedorNombre: z.string(),
  fecha: z.string(),
  causado: z.string().optional(),
  concepto: z.string().optional(),
  diasCredito: z.number().optional(),
  moneda: z.string().optional(),
  tasaRegistro: z.number().optional().nullable(),
  totalBs: z.number(),
  totalUsd: z.number().optional().nullable(),
  exentoBs: z.number().optional(),
  descripcionIslr: z.string().optional(),
  conceptosIslr: z.array(conceptoSchema).optional(),
  estacion: z.string().optional(),
  recibidoFisico: z.string().optional(),
  retencionEnviada: z.string().optional()
});

async function buildFacturaData(input: z.infer<typeof schema>, existingId?: string) {
  const prov = await prisma.proveedor.findUnique({ where: { rif: input.rif } });
  const tipoIslr = prov?.tipoIslr ?? 'PNR';
  const retIva = prov?.retencionIva ?? '100%';

  const fecha = new Date(input.fecha);
  const tasa =
    input.tasaRegistro ??
  (input.moneda === 'USD' ? await obtenerTasaDelDia(fecha) : await obtenerTasaDelDia(fecha));

  let totalBs = input.totalBs;
  let totalUsd = input.totalUsd;

  if (input.moneda === 'USD' && totalUsd && tasa) {
    totalBs = totalUsd * tasa;
  } else if (input.moneda === 'Bs' && tasa) {
    totalUsd = totalBs / tasa;
  }

  const conceptosRaw: ConceptoIslrInput[] = input.conceptosIslr ?? [];
  const validacion = validarSumaConceptosIslr(
    conceptosRaw,
    totalBs,
    input.exentoBs ?? 0
  );
  if (!validacion.ok) {
    throw new Error(validacion.error ?? 'Conceptos ISLR inválidos');
  }
  const conceptos = normalizarConceptosIslr(
    conceptosRaw,
    totalBs,
    input.exentoBs ?? 0,
    input.tipo
  );
  const islr = await calcularIslr(tipoIslr, conceptos, totalBs);
  const iva = calcularIvaYNeto(
    totalBs,
    input.exentoBs ?? 0,
    retIva,
    islr.retencionIslr,
    tasa,
    input.moneda ?? 'Bs'
  );

  return {
    tipo: input.tipo,
    numero: input.numero,
    rif: input.rif,
    proveedorId: prov?.id,
    proveedorNombre: input.proveedorNombre,
    fecha,
    estacion: input.estacion,
    causado: input.causado,
    concepto: input.concepto,
    diasCredito: input.diasCredito ?? 0,
    moneda: input.moneda ?? 'Bs',
    tasaRegistro: tasa,
    totalBs: round2(totalBs),
    totalUsd: totalUsd != null ? round2(totalUsd) : null,
    exentoBs: input.exentoBs ?? 0,
    descripcionIslr:
      input.descripcionIslr ??
      (islr.descripcionAuditoria || (conceptos.length === 0 ? 'SIN ISLR' : islr.detalle)),
    detalleIslr: JSON.stringify(conceptos),
    baseIslr: islr.baseIslr,
    retencionIslr: islr.retencionIslr,
    grabadoBs: iva.grabadoBs,
    baseImponible: iva.baseImponible,
    iva16: iva.iva16,
    retencionIva: iva.retencionIva,
    montoAPagar: iva.montoAPagar,
    montoAPagarUsd: iva.montoAPagarUsd,
    recibidoFisico: input.recibidoFisico ?? 'Pendiente',
    retencionEnviada: input.retencionEnviada ?? 'Pendiente'
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

router.get('/', async (req, res) => {
  const rif = req.query.rif as string | undefined;
  const list = await prisma.factura.findMany({
    where: rif ? { rif } : undefined,
    orderBy: { fecha: 'desc' }
  });
  res.json(list);
});

router.get('/suggest/:rif', async (req, res) => {
  res.json(await suggestFacturaPorRif(req.params.rif));
});

router.get('/check-duplicada', async (req, res) => {
  const tipo = String(req.query.tipo ?? '');
  const numero = String(req.query.numero ?? '');
  const rif = String(req.query.rif ?? '');
  if (!tipo || !numero || !rif) {
    return res.status(400).json({ error: 'tipo, numero y rif requeridos' });
  }
  res.json(await checkFacturaDuplicada(tipo, numero, rif));
});

router.get('/buscar/:q', async (req, res) => {
  const q = req.params.q.toLowerCase();
  const list = await prisma.factura.findMany({
    where: {
      OR: [
        { numero: { contains: q } },
        { proveedorNombre: { contains: q } },
        { rif: { contains: q } }
      ]
    },
    take: 50,
    orderBy: { fecha: 'desc' }
  });
  res.json(list);
});

router.post('/preview', async (req, res) => {
  const input = schema.parse(req.body);
  const prov = await prisma.proveedor.findUnique({ where: { rif: input.rif } });
  try {
    const data = await buildFacturaData(input);
    res.json({
    ...data,
    tipoIslrAplicado: prov?.tipoIslr ?? 'PNR',
    retencionIvaAplicada: prov?.retencionIva ?? '100%',
    conceptosIslrNormalizados: JSON.parse(data.detalleIslr ?? '[]')
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error en cálculo';
    res.status(400).json({ error: msg });
  }
});

router.get('/:id', async (req, res) => {
  const f = await prisma.factura.findUnique({ where: { id: req.params.id } });
  if (!f) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(f);
});

router.post('/', async (req, res) => {
  const input = schema.parse(req.body);
  const dup = await prisma.factura.findFirst({
    where: { tipo: input.tipo, numero: input.numero, rif: input.rif }
  });
  if (dup) return res.status(409).json({ error: 'Factura duplicada' });

  let data;
  try {
    data = await buildFacturaData(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error en cálculo';
    return res.status(400).json({ error: msg });
  }
  const f = await prisma.factura.create({ data });
  await logAuditoria('FACTURA_CREADA', `${f.tipo}-${f.numero}`, getRequestUser(req));
  refreshAlertasDebounced();
  res.status(201).json(f);
});

router.put('/:id', async (req, res) => {
  const input = schema.parse(req.body);
  let data;
  try {
    data = await buildFacturaData(input, req.params.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error en cálculo';
    return res.status(400).json({ error: msg });
  }
  const f = await prisma.factura.update({ where: { id: req.params.id }, data });
  await logAuditoria('FACTURA_ACTUALIZADA', `${f.tipo}-${f.numero}`, getRequestUser(req));
  refreshAlertasDebounced();
  res.json(f);
});

router.patch('/:id/checklist', async (req, res) => {
  const { recibidoFisico, retencionEnviada } = req.body;
  const f = await prisma.factura.update({
    where: { id: req.params.id },
    data: {
      ...(recibidoFisico != null && { recibidoFisico }),
      ...(retencionEnviada != null && { retencionEnviada })
    }
  });
  refreshAlertasDebounced();
  res.json(f);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = paramString(req.params.id);
  await prisma.factura.delete({ where: { id } });
  await logAuditoria('FACTURA_ELIMINADA', id, getRequestUser(req));
  refreshAlertasDebounced();
  res.status(204).end();
});

export default router;
