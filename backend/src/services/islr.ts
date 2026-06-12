import { prisma } from '../lib/prisma.js';

export type TipoIslr = 'PNR' | 'PJD' | 'PJND' | 'PNNR' | string;

export interface ConceptoIslrInput {
  concepto: string;
  monto: number;
}

export async function calcularIslr(
  tipoIslr: TipoIslr,
  conceptos: ConceptoIslrInput[],
  totalFactura: number
): Promise<{ baseIslr: number; retencionIslr: number; detalle: string }> {
  const tablas = await prisma.tabIslr.findMany({ orderBy: { orden: 'asc' } });
  let baseTotal = 0;
  let retTotal = 0;
  const partes: string[] = [];

  for (const c of conceptos) {
    if (!c.concepto || c.monto <= 0) continue;
    const row = tablas.find((t) => t.concepto.toLowerCase() === c.concepto.toLowerCase());
    if (!row) {
      partes.push(`${c.concepto}: ${c.monto.toFixed(2)} (sin tabla)`);
      continue;
    }

    const tipo = tipoIslr.toUpperCase();
    let base = 0;
    let pct = 0;
    let sustraendo = 0;
    let pagosMin = 0;

    if (tipo === 'PNR') {
      base = row.basePnr ?? 0;
      pct = row.pnr ?? 0;
      pagosMin = row.pagosMinBs ?? 0;
      sustraendo = row.sustraendoBs ?? 0;
    } else if (tipo === 'PJD') {
      base = row.basePjd ?? 0;
      pct = row.pjd ?? 0;
    } else if (tipo === 'PJND') {
      base = row.basePjnd ?? 0;
      pct = row.pjnd ?? 0;
    } else if (tipo === 'PNNR') {
      base = row.basePnnr ?? 0;
      pct = row.pnnr ?? 0;
    }

    const baseCalc = c.monto * (base / 100);
    let ret = baseCalc * (pct / 100);
    if (tipo === 'PNR' && totalFactura >= pagosMin && sustraendo > 0) {
      ret = Math.max(0, ret - sustraendo);
    }
    baseTotal += baseCalc;
    retTotal += ret;
    partes.push(`${c.concepto}: base ${baseCalc.toFixed(2)} ret ${ret.toFixed(2)}`);
  }

  return {
    baseIslr: round2(baseTotal),
    retencionIslr: round2(retTotal),
    detalle: partes.join(' | ')
  };
}

export function calcularIvaYNeto(
  totalBs: number,
  exentoBs: number,
  retencionIvaPct: string,
  retencionIslr: number,
  tasa?: number | null,
  moneda?: string
): {
  grabadoBs: number;
  baseImponible: number;
  iva16: number;
  retencionIva: number;
  montoAPagar: number;
  montoAPagarUsd: number | null;
} {
  const grabado = Math.max(0, totalBs - exentoBs);
  const baseImponible = grabado / 1.16;
  const iva16 = grabado - baseImponible;

  let retIvaPct = 1;
  const r = retencionIvaPct.toUpperCase();
  if (r.includes('75')) retIvaPct = 0.75;
  else if (r.includes('EXENT')) retIvaPct = 0;

  const retencionIva = iva16 * retIvaPct;
  const montoAPagar = totalBs - retencionIva - retencionIslr;

  let montoAPagarUsd: number | null = null;
  if (moneda === 'USD' && tasa && tasa > 0) {
    montoAPagarUsd = round2(montoAPagar / tasa);
  } else if (moneda === 'Bs' && tasa && tasa > 0) {
    montoAPagarUsd = round2(montoAPagar / tasa);
  }

  return {
    grabadoBs: round2(grabado),
    baseImponible: round2(baseImponible),
    iva16: round2(iva16),
    retencionIva: round2(retencionIva),
    montoAPagar: round2(montoAPagar),
    montoAPagarUsd
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
