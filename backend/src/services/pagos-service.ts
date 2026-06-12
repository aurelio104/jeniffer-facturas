import { prisma } from '../lib/prisma.js';
import { obtenerTasaDelDia } from './tasas.js';

export async function getPagosFactura(facturaId: string) {
  const f = await prisma.factura.findUnique({ where: { id: facturaId } });
  if (!f) return null;
  const docKey = `${f.tipo}-${f.numero}`;
  const pagos = await prisma.pago.findMany({
    where: {
      OR: [
        { facturaId },
        { rif: f.rif, documento: docKey },
        { rif: f.rif, documento: f.numero }
      ]
    }
  });
  return { factura: f, pagos };
}

export async function calcularSaldoFactura(facturaId: string) {
  const data = await getPagosFactura(facturaId);
  if (!data) return null;
  const { factura: f, pagos } = data;
  const pagadoBs = pagos.reduce((s, p) => s + (p.pagadoBs ?? 0), 0);
  const pagadoUsd = pagos.reduce((s, p) => s + (p.pagadoUsd ?? 0), 0);
  const saldoBs = Math.max(0, round2(f.montoAPagar - pagadoBs));
  const saldoUsd =
    f.montoAPagarUsd != null ? Math.max(0, round2(f.montoAPagarUsd - pagadoUsd)) : null;
  return {
    facturaId: f.id,
    documento: `${f.tipo}-${f.numero}`,
    montoAPagar: f.montoAPagar,
    montoAPagarUsd: f.montoAPagarUsd,
    pagadoBs: round2(pagadoBs),
    pagadoUsd: pagadoUsd > 0 ? round2(pagadoUsd) : null,
    saldoBs,
    saldoUsd
  };
}

export async function listAnticiposAbiertos(rif?: string) {
  const pagos = await prisma.pago.findMany({
    where: {
      estadoAnticipo: 'Abierto',
      ...(rif ? { rif } : {})
    },
    orderBy: { fecha: 'desc' }
  });
  return pagos;
}

export function validarMontoPago(
  saldoBs: number,
  pagadoBs: number,
  esAnticipo: boolean
): { ok: boolean; error?: string } {
  if (pagadoBs <= 0) return { ok: false, error: 'El monto debe ser mayor a cero' };
  if (!esAnticipo && pagadoBs > saldoBs + 0.01) {
    return { ok: false, error: `El pago supera el saldo (${round2(saldoBs)} Bs)` };
  }
  return { ok: true };
}

export async function aplicarAnticipo(
  anticipoId: string,
  facturaId: string,
  montoBs: number
): Promise<void> {
  const anticipo = await prisma.pago.findUnique({ where: { id: anticipoId } });
  if (!anticipo || anticipo.estadoAnticipo !== 'Abierto') {
    throw new Error('Anticipo no válido');
  }
  const saldo = await calcularSaldoFactura(facturaId);
  if (!saldo) throw new Error('Factura no encontrada');
  const aplicar = Math.min(montoBs, saldo.saldoBs, anticipo.pagadoBs ?? montoBs);
  await prisma.pago.update({
    where: { id: anticipoId },
    data: {
      anticipoAplicado: round2((anticipo.anticipoAplicado ?? 0) + aplicar),
      estadoAnticipo: aplicar >= (anticipo.pagadoBs ?? 0) - 0.01 ? 'Cerrado' : 'Abierto',
      facturaId
    }
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
