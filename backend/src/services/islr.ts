import { prisma } from '../lib/prisma.js';

export type TipoIslr = 'PNR' | 'PJD' | 'PJND' | 'PNNR' | string;

export interface ConceptoIslrInput {
  concepto: string;
  monto: number;
}

export interface IslrCalcResult {
  baseIslr: number;
  retencionIslr: number;
  detalle: string;
  descripcionAuditoria: string;
}

const UT_VALOR = 43;

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Factor de base Excel: 1 = 100%, 0.9 = 90%; también acepta 100 = 100%. */
export function factorBaseTab(val: number | null | undefined): number {
  if (val == null || val <= 0) return 1;
  return val > 1 ? val / 100 : val;
}

/** Porcentaje Excel: 0.03 = 3%; también acepta 3 = 3%. */
export function factorPctTab(val: number | null | undefined): number {
  if (val == null || val <= 0) return 0;
  return val > 1 ? val / 100 : val;
}

/** Tarifa T2 (escala UT) — Decreto 1.808, UT = 43 Bs. */
export function calcularRetencionT2(baseImponibleReal: number): number {
  const conversionUT = baseImponibleReal / UT_VALOR;
  if (conversionUT <= 2000) {
    return baseImponibleReal * 0.15;
  }
  if (conversionUT <= 3000) {
    return baseImponibleReal * 0.22 - 140 * UT_VALOR;
  }
  return baseImponibleReal * 0.34 - 500 * UT_VALOR;
}

function descCorta(concepto: string, max = 15): string {
  return concepto.length > max ? concepto.slice(0, max) : concepto;
}

function formatPctAuditoria(pct: number): string {
  return `${round2(pct * 100)}%`;
}

type TabRow = Awaited<ReturnType<typeof prisma.tabIslr.findMany>>[number];

function leerColumnaIslr(
  row: TabRow,
  tipo: string
): {
  baseRaw: number | null;
  pctRaw: number | null;
  t2: boolean;
  pagosMin: number;
  sustraendo: number;
} {
  const t = tipo.toUpperCase();
  if (t === 'PNR') {
    return {
      baseRaw: row.basePnr,
      pctRaw: row.pnr,
      t2: row.t2Pnr ?? false,
      pagosMin: row.pagosMinBs ?? 0,
      sustraendo: row.sustraendoBs ?? 0
    };
  }
  if (t === 'PJD') {
    return {
      baseRaw: row.basePjd,
      pctRaw: row.pjd,
      t2: row.t2Pjd ?? false,
      pagosMin: 0,
      sustraendo: 0
    };
  }
  if (t === 'PJND') {
    return {
      baseRaw: row.basePjnd,
      pctRaw: row.pjnd,
      t2: row.t2Pjnd ?? false,
      pagosMin: 0,
      sustraendo: 0
    };
  }
  if (t === 'PNNR') {
    return {
      baseRaw: row.basePnnr,
      pctRaw: row.pnnr,
      t2: row.t2Pnnr ?? false,
      pagosMin: 0,
      sustraendo: 0
    };
  }
  return {
    baseRaw: row.basePjd,
    pctRaw: row.pjd,
    t2: row.t2Pjd ?? false,
    pagosMin: 0,
    sustraendo: 0
  };
}

function calcularLineaIslr(
  baseEnBs: number,
  col: ReturnType<typeof leerColumnaIslr>
): { baseImponibleReal: number; impuestoEnBs: number; pctEfectivo: number } {
  const factorBase = factorBaseTab(col.baseRaw);
  const baseImponibleReal = round2(baseEnBs * factorBase);

  let impuestoEnBs = 0;
  let pctEfectivo = 0;

  if (col.t2 || String(col.pctRaw).toUpperCase() === 'T2') {
    impuestoEnBs = calcularRetencionT2(baseImponibleReal);
    pctEfectivo = baseImponibleReal > 0 ? impuestoEnBs / baseImponibleReal : 0;
  } else {
    pctEfectivo = factorPctTab(col.pctRaw);
    impuestoEnBs = baseImponibleReal * pctEfectivo;
  }

  if (col.pagosMin > 0 && col.sustraendo > 0 && baseImponibleReal > col.pagosMin) {
    impuestoEnBs -= col.sustraendo;
  }

  if (impuestoEnBs < 0) impuestoEnBs = 0;

  return {
    baseImponibleReal,
    impuestoEnBs: round2(impuestoEnBs),
    pctEfectivo
  };
}

export async function calcularIslr(
  tipoIslr: TipoIslr,
  conceptos: ConceptoIslrInput[],
  _totalFactura: number
): Promise<IslrCalcResult> {
  const tablas = await prisma.tabIslr.findMany({ orderBy: { orden: 'asc' } });
  let baseTotal = 0;
  let retTotal = 0;
  const partes: string[] = [];
  const auditoria: string[] = [];

  for (const c of conceptos) {
    if (!c.concepto || c.monto <= 0) continue;
    const row = tablas.find((t) => t.concepto.toLowerCase() === c.concepto.toLowerCase());
    if (!row) {
      partes.push(`${c.concepto}: base ${c.monto.toFixed(2)} ret 0.00 (sin tabla)`);
      continue;
    }

    const col = leerColumnaIslr(row, tipoIslr);
    const linea = calcularLineaIslr(c.monto, col);

    baseTotal += linea.baseImponibleReal;
    retTotal += linea.impuestoEnBs;
    partes.push(
      `${c.concepto}: base ${linea.baseImponibleReal.toFixed(2)} ret ${linea.impuestoEnBs.toFixed(2)}`
    );
    auditoria.push(
      `${descCorta(c.concepto)} (${formatPctAuditoria(linea.pctEfectivo)})`
    );
  }

  return {
    baseIslr: round2(baseTotal),
    retencionIslr: round2(retTotal),
    detalle: partes.join(' | '),
    descripcionAuditoria: auditoria.join(' / ')
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
