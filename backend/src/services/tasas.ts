import { prisma } from '../lib/prisma.js';
import { obtenerTasasDia } from './bcv-service.js';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export type TasaUpsert = {
  usd: number;
  eur?: number | null;
};

/** Guarda tasas USD/EUR en BD local (histórico BCV). */
export async function upsertTasaLocal(fecha: Date, data: TasaUpsert) {
  const day = startOfDay(fecha);
  await prisma.tasa.upsert({
    where: { fecha: day },
    create: {
      fecha: day,
      valor: data.usd,
      valorEur: data.eur ?? null
    },
    update: {
      valor: data.usd,
      ...(data.eur != null && { valorEur: data.eur })
    }
  });
}

/** Tasa BCV viva (módulo Costos) + sync del día en SQLite. */
export async function sincronizarTasaHoy(): Promise<{
  valor: number;
  valorEur: number;
  fecha: string | null;
  nombre: string;
  nombreEur: string;
  fuente: string;
}> {
  const tasas = await obtenerTasasDia();
  const valor = tasas.usd.tasa;
  const valorEur = tasas.eur.tasa;
  await upsertTasaLocal(new Date(), { usd: valor, eur: valorEur });
  return {
    valor,
    valorEur,
    fecha: tasas.usd.fecha,
    nombre: tasas.usd.nombre,
    nombreEur: tasas.eur.nombre,
    fuente: tasas.meta.fuenteActiva
  };
}

export async function listarHistorico(meses = 3) {
  const hasta = startOfDay(new Date());
  const desde = startOfDay(new Date(hasta));
  desde.setMonth(desde.getMonth() - meses);
  return prisma.tasa.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
    orderBy: { fecha: 'desc' }
  });
}

export async function obtenerTasaDelDia(fecha: Date): Promise<number> {
  const day = startOfDay(fecha);
  const today = startOfDay(new Date());

  if (isSameDay(day, today)) {
    const live = await sincronizarTasaHoy();
    return live.valor;
  }

  const exact = await prisma.tasa.findUnique({ where: { fecha: day } });
  if (exact) return exact.valor;

  const anterior = await prisma.tasa.findFirst({
    where: { fecha: { lte: day } },
    orderBy: { fecha: 'desc' }
  });
  if (anterior) return anterior.valor;

  const posterior = await prisma.tasa.findFirst({
    where: { fecha: { gte: day } },
    orderBy: { fecha: 'asc' }
  });
  if (posterior) return posterior.valor;

  const tasas = await obtenerTasasDia();
  return tasas.usd.tasa;
}

export async function obtenerTasaEurDelDia(fecha: Date): Promise<number | null> {
  const day = startOfDay(fecha);
  const today = startOfDay(new Date());

  if (isSameDay(day, today)) {
    const live = await sincronizarTasaHoy();
    return live.valorEur;
  }

  const exact = await prisma.tasa.findUnique({ where: { fecha: day } });
  if (exact?.valorEur != null) return exact.valorEur;

  const anterior = await prisma.tasa.findFirst({
    where: { fecha: { lte: day }, valorEur: { not: null } },
    orderBy: { fecha: 'desc' }
  });
  if (anterior?.valorEur != null) return anterior.valorEur;

  const tasas = await obtenerTasasDia();
  return tasas.eur.tasa;
}
