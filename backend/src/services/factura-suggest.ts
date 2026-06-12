import { prisma } from '../lib/prisma.js';
import { listAnticiposAbiertos } from './pagos-service.js';

export async function suggestFacturaPorRif(rif: string) {
  const prov = await prisma.proveedor.findUnique({ where: { rif } });
  const ultima = await prisma.factura.findFirst({
    where: { rif },
    orderBy: { fecha: 'desc' }
  });

  let conceptosIslr: { concepto: string; monto: number }[] = [];
  if (ultima?.detalleIslr) {
    try {
      conceptosIslr = JSON.parse(ultima.detalleIslr) as { concepto: string; monto: number }[];
    } catch { /* ignore */ }
  }

  return {
    proveedor: prov,
    ultimaFactura: ultima
      ? {
          tipo: ultima.tipo,
          estacion: ultima.estacion,
          causado: ultima.causado,
          diasCredito: ultima.diasCredito,
          moneda: ultima.moneda,
          conceptosIslr
        }
      : null
  };
}

export async function checkFacturaDuplicada(tipo: string, numero: string, rif: string) {
  const dup = await prisma.factura.findFirst({
    where: { tipo, numero, rif }
  });
  return { duplicada: Boolean(dup), id: dup?.id };
}

export async function suggestPagoPorRif(rif: string) {
  const prov = await prisma.proveedor.findUnique({ where: { rif } });
  const anticipos = await listAnticiposAbiertos(rif);
  const facturas = await prisma.factura.findMany({
    where: { rif },
    orderBy: { fecha: 'desc' },
    take: 20
  });
  return {
    proveedor: prov,
    banco: prov?.banco ?? '',
    anticiposAbiertos: anticipos.length,
    facturasPendientes: facturas.length
  };
}
