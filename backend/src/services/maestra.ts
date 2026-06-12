import { prisma } from '../lib/prisma.js';

export interface MaestraRow {
  id: string;
  tipo: string;
  numero: string;
  rif: string;
  proveedor: string;
  fecha: string;
  moneda: string;
  tasaRegistro: number | null;
  totalBs: number;
  totalUsd: number | null;
  netoBs: number;
  netoUsd: number | null;
  iva16: number;
  retIva: number;
  retIslr: number;
  montoAPagar: number;
  montoAPagarUsd: number | null;
  pagadoBs: number;
  pagadoUsd: number | null;
  saldoBs: number;
  saldoUsd: number | null;
  difCambiariaUsd: number | null;
  diasVencida: number;
  vencida: boolean;
  recibidoFisico: string;
  retencionEnviada: string;
  registrado: string;
  pagado: string;
  parcial: string;
  estado: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Última tasa usada en un pago del documento (ControlInterno.UltimaTasaPago). */
function ultimaTasaPago(
  pagosFactura: Array<{ tasa: number | null; pagadoBs: number | null; fecha: Date }>
): number {
  const conTasa = pagosFactura.filter((p) => (p.tasa ?? 0) > 0 && (p.pagadoBs ?? 0) > 0);
  if (conTasa.length === 0) return 0;
  const ultimo = conTasa.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
  return ultimo.tasa ?? 0;
}

function diasVencida(fecha: Date, diasCredito: number): number {
  const venc = new Date(fecha);
  venc.setDate(venc.getDate() + diasCredito);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  if (hoy <= venc) return 0;
  return Math.floor((hoy.getTime() - venc.getTime()) / (86400000));
}

export async function construirMaestra(filtroRif?: string): Promise<MaestraRow[]> {
  const facturas = await prisma.factura.findMany({
    where: filtroRif ? { rif: filtroRif } : undefined,
    orderBy: { fecha: 'desc' }
  });

  const pagos = await prisma.pago.findMany();
  const rows: MaestraRow[] = [];

  for (const f of facturas) {
    const docKey = `${f.tipo}-${f.numero}`;
    const pagosFactura = pagos.filter(
      (p) =>
        p.facturaId === f.id ||
        p.documento === docKey ||
        p.documento === f.numero ||
        (p.rif === f.rif && p.documento.includes(f.numero))
    );

    const pagadoBs = pagosFactura.reduce((s, p) => s + (p.pagadoBs ?? 0), 0);
    const pagadoUsd = pagosFactura.reduce((s, p) => s + (p.pagadoUsd ?? 0), 0);
    const saldoBs = Math.max(0, f.montoAPagar - pagadoBs);
    const saldoUsd =
      f.montoAPagarUsd != null ? Math.max(0, f.montoAPagarUsd - pagadoUsd) : null;

    const registrado = 'Sí';
    let estado = 'PENDIENTE';
    let pagadoEst = 'Pendiente';
    let parcial = 'No';
    if (saldoBs <= 0.01 && f.montoAPagar > 0) {
      estado = 'PAGADA';
      pagadoEst = 'Sí';
    } else if (pagadoBs > 0) {
      estado = 'PARCIAL';
      pagadoEst = 'Parcial';
      parcial = 'Sí';
    }

    const dias = diasVencida(f.fecha, f.diasCredito);
    const netoUsdVal = f.montoAPagarUsd ?? null;
    let difCambiariaUsd: number | null = null;
    const tasaPago = ultimaTasaPago(pagosFactura);
    if (tasaPago > 0 && pagadoBs > 0 && netoUsdVal != null && netoUsdVal > 0) {
      difCambiariaUsd = round2(pagadoBs / tasaPago - netoUsdVal);
    }

    rows.push({
      id: f.id,
      tipo: f.tipo,
      numero: f.numero,
      rif: f.rif,
      proveedor: f.proveedorNombre,
      fecha: f.fecha.toISOString().slice(0, 10),
      moneda: f.moneda,
      tasaRegistro: f.tasaRegistro,
      totalBs: f.totalBs,
      totalUsd: f.totalUsd,
      netoBs: f.montoAPagar,
      netoUsd: f.montoAPagarUsd,
      iva16: f.iva16,
      retIva: f.retencionIva,
      retIslr: f.retencionIslr,
      montoAPagar: f.montoAPagar,
      montoAPagarUsd: f.montoAPagarUsd,
      pagadoBs: round2(pagadoBs),
      pagadoUsd: pagadoUsd > 0 ? round2(pagadoUsd) : null,
      saldoBs: round2(saldoBs),
      saldoUsd: saldoUsd != null ? round2(saldoUsd) : null,
      difCambiariaUsd,
      diasVencida: dias,
      vencida: dias > 0 && estado !== 'PAGADA',
      recibidoFisico: f.recibidoFisico,
      retencionEnviada: f.retencionEnviada,
      registrado,
      pagado: pagadoEst,
      parcial,
      estado
    });
  }

  return rows;
}

export async function buscarGlobal(q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const maestra = await construirMaestra();
  return maestra
    .filter(
      (r) =>
        r.numero.toLowerCase().includes(term) ||
        r.rif.toLowerCase().includes(term) ||
        r.proveedor.toLowerCase().includes(term) ||
        `${r.tipo}-${r.numero}`.toLowerCase().includes(term)
    )
    .slice(0, 40);
}

export async function resumenProveedor(rif: string) {
  const maestra = await construirMaestra(rif);
  const proveedor = await prisma.proveedor.findUnique({ where: { rif } });

  const totalFacturado = maestra.reduce((s, r) => s + r.totalBs, 0);
  const totalesAgg = await prisma.factura.aggregate({
    where: { rif },
    _sum: { iva16: true, retencionIva: true, retencionIslr: true }
  });

  const totalPagado = maestra.reduce((s, r) => s + r.pagadoBs, 0);
  const saldo = maestra.reduce((s, r) => s + r.saldoBs, 0);
  const difCambiaria = maestra.reduce((s, r) => s + (r.difCambiariaUsd ?? 0), 0);

  return {
    proveedor,
    maestra,
    totales: {
      facturado: round2(totalFacturado),
      neto: round2(maestra.reduce((s, r) => s + r.netoBs, 0)),
      iva: round2(totalesAgg._sum.iva16 ?? 0),
      retIva: round2(totalesAgg._sum.retencionIva ?? 0),
      retIslr: round2(totalesAgg._sum.retencionIslr ?? 0),
      pagado: round2(totalPagado),
      saldo: round2(saldo),
      difCambiariaUsd: round2(difCambiaria)
    }
  };
}

export async function dashboardStats() {
  const maestra = await construirMaestra();
  const pendientes = maestra.filter((r) => r.estado === 'PENDIENTE').length;
  const parciales = maestra.filter((r) => r.estado === 'PARCIAL').length;
  const pagadas = maestra.filter((r) => r.estado === 'PAGADA').length;
  const saldoTotal = maestra.reduce((s, r) => s + r.saldoBs, 0);
  const sinFisico = maestra.filter((r) => r.recibidoFisico !== 'Sí').length;
  const sinRetencion = maestra.filter((r) => r.retencionEnviada !== 'Sí').length;
  const vencidas = maestra.filter((r) => r.vencida).length;

  const topSaldos = [...maestra]
    .filter((r) => r.saldoBs > 0)
    .sort((a, b) => b.saldoBs - a.saldoBs)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      rif: r.rif,
      proveedor: r.proveedor,
      documento: `${r.tipo}-${r.numero}`,
      saldoBs: r.saldoBs
    }));

  return {
    totalFacturas: maestra.length,
    pendientes,
    parciales,
    pagadas,
    saldoTotal: round2(saldoTotal),
    sinFisico,
    sinRetencion,
    vencidas,
    topSaldos
  };
}
