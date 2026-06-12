import { prisma } from '../lib/prisma.js';
import { construirMaestra } from './maestra.js';

async function diasPorVencerConfig(): Promise<number> {
  const row = await prisma.configItem.findFirst({
    where: { categoria: 'alerta_config' },
    orderBy: { orden: 'asc' }
  });
  const n = parseInt(row?.valor ?? '7', 10);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

function diasParaVencer(fecha: Date, diasCredito: number): number {
  const venc = new Date(fecha);
  venc.setDate(venc.getDate() + diasCredito);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  return Math.floor((venc.getTime() - hoy.getTime()) / 86400000);
}

type AlertaInput = {
  tipo: string;
  prioridad: number;
  titulo: string;
  detalle?: string;
  facturaId: string;
  rif: string;
  proveedor: string;
  documento: string;
  saldoBs: number;
  diasVencida?: number;
};

async function upsertAlerta(input: AlertaInput) {
  const existing = await prisma.alerta.findUnique({
    where: { tipo_facturaId: { tipo: input.tipo, facturaId: input.facturaId } }
  });
  if (existing?.descartada) return;

  await prisma.alerta.upsert({
    where: { tipo_facturaId: { tipo: input.tipo, facturaId: input.facturaId } },
    create: {
      tipo: input.tipo,
      prioridad: input.prioridad,
      titulo: input.titulo,
      detalle: input.detalle,
      facturaId: input.facturaId,
      rif: input.rif,
      proveedor: input.proveedor,
      documento: input.documento,
      saldoBs: input.saldoBs,
      diasVencida: input.diasVencida ?? 0
    },
    update: {
      prioridad: input.prioridad,
      titulo: input.titulo,
      detalle: input.detalle,
      saldoBs: input.saldoBs,
      diasVencida: input.diasVencida ?? 0,
      leida: existing?.leida ?? false
    }
  });
}

/** Regenera alertas operativas desde BD maestra (prioridad = saldo × urgencia). */
export async function regenerarAlertas(): Promise<number> {
  const porVencerDias = await diasPorVencerConfig();
  const facturas = await prisma.factura.findMany();
  const maestra = await construirMaestra();
  const maestraMap = new Map(maestra.map((r) => [r.id, r]));
  let count = 0;

  for (const f of facturas) {
    const row = maestraMap.get(f.id);
    if (!row || row.estado === 'PAGADA' || row.saldoBs <= 0) continue;

    const doc = `${f.tipo}-${f.numero}`;
    const diasRest = diasParaVencer(f.fecha, f.diasCredito);

    if (row.diasVencida > 0) {
      await upsertAlerta({
        tipo: 'VENCIDA',
        prioridad: row.saldoBs * (1 + row.diasVencida / 10),
        titulo: `${doc} vencida ${row.diasVencida} días`,
        detalle: `${row.proveedor} · saldo ${row.saldoBs.toFixed(2)} Bs`,
        facturaId: f.id,
        rif: f.rif,
        proveedor: row.proveedor,
        documento: doc,
        saldoBs: row.saldoBs,
        diasVencida: row.diasVencida
      });
      count++;
    } else if (diasRest >= 0 && diasRest <= porVencerDias) {
      await upsertAlerta({
        tipo: 'POR_VENCER',
        prioridad: row.saldoBs * (1 + (porVencerDias - diasRest) / 10),
        titulo: `${doc} vence en ${diasRest} días`,
        detalle: `${row.proveedor} · saldo ${row.saldoBs.toFixed(2)} Bs`,
        facturaId: f.id,
        rif: f.rif,
        proveedor: row.proveedor,
        documento: doc,
        saldoBs: row.saldoBs,
        diasVencida: 0
      });
      count++;
    }

    if (f.recibidoFisico !== 'Sí') {
      await upsertAlerta({
        tipo: 'SIN_FISICO',
        prioridad: row.saldoBs * 0.5,
        titulo: `${doc} sin físico`,
        detalle: row.proveedor,
        facturaId: f.id,
        rif: f.rif,
        proveedor: row.proveedor,
        documento: doc,
        saldoBs: row.saldoBs
      });
      count++;
    }

    if (f.retencionEnviada !== 'Sí') {
      await upsertAlerta({
        tipo: 'SIN_RETENCION',
        prioridad: row.saldoBs * 0.4,
        titulo: `${doc} sin retención enviada`,
        detalle: row.proveedor,
        facturaId: f.id,
        rif: f.rif,
        proveedor: row.proveedor,
        documento: doc,
        saldoBs: row.saldoBs
      });
      count++;
    }
  }

  // Limpiar alertas obsoletas (factura pagada o tipo ya no aplica)
  const facturaMap = new Map(facturas.map((f) => [f.id, f]));
  const activas = await prisma.alerta.findMany({ where: { descartada: false } });
  for (const a of activas) {
    if (!a.facturaId) continue;
    const row = maestraMap.get(a.facturaId);
    const fac = facturaMap.get(a.facturaId);
    if (!row || !fac || row.estado === 'PAGADA' || row.saldoBs <= 0) {
      await prisma.alerta.delete({ where: { id: a.id } });
      continue;
    }
    if (a.tipo === 'VENCIDA' && row.diasVencida <= 0) {
      await prisma.alerta.delete({ where: { id: a.id } });
    }
    if (
      a.tipo === 'POR_VENCER' &&
      (row.diasVencida > 0 || diasParaVencer(fac.fecha, fac.diasCredito) > porVencerDias)
    ) {
      await prisma.alerta.delete({ where: { id: a.id } });
    }
    if (a.tipo === 'SIN_FISICO' && fac.recibidoFisico === 'Sí') {
      await prisma.alerta.delete({ where: { id: a.id } });
    }
    if (a.tipo === 'SIN_RETENCION' && fac.retencionEnviada === 'Sí') {
      await prisma.alerta.delete({ where: { id: a.id } });
    }
  }

  return count;
}

export async function listarAlertas(soloActivas = true) {
  return prisma.alerta.findMany({
    where: soloActivas ? { descartada: false } : undefined,
    orderBy: [{ leida: 'asc' }, { prioridad: 'desc' }, { createdAt: 'desc' }],
    take: 100
  });
}

export async function contarAlertasNoLeidas() {
  return prisma.alerta.count({ where: { leida: false, descartada: false } });
}

export async function marcarLeida(id: string) {
  return prisma.alerta.update({ where: { id }, data: { leida: true } });
}

export async function marcarTodasLeidas() {
  await prisma.alerta.updateMany({
    where: { leida: false, descartada: false },
    data: { leida: true }
  });
}

export async function descartarAlerta(id: string) {
  return prisma.alerta.update({
    where: { id },
    data: { descartada: true, leida: true }
  });
}
