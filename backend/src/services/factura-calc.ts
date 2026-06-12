import type { ConceptoIslrInput } from './islr.js';
import { calcularIvaYNeto } from './islr.js';

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function isTipoSinIslr(tipo: string) {
  return tipo.toUpperCase() === 'REC';
}

export function calcularBaseImponible(totalBs: number, exentoBs = 0) {
  const grabado = Math.max(0, totalBs - exentoBs);
  return round2(grabado / 1.16);
}

/** Reparte la base imponible entre conceptos con nombre; autollenado tipo Excel */
export function normalizarConceptosIslr(
  conceptos: ConceptoIslrInput[],
  totalBs: number,
  exentoBs: number,
  tipoDoc: string
): ConceptoIslrInput[] {
  if (isTipoSinIslr(tipoDoc)) return [];

  const conNombre = conceptos.filter((c) => c.concepto.trim());
  if (conNombre.length === 0) return [];

  const base = calcularBaseImponible(totalBs, exentoBs);
  const sinMonto = conNombre.filter((c) => !c.monto || c.monto <= 0);
  const conMonto = conNombre.filter((c) => c.monto > 0);
  const asignado = conMonto.reduce((s, c) => s + c.monto, 0);

  if (sinMonto.length === 0) return conNombre;

  let restante = Math.max(0, round2(base - asignado));

  if (sinMonto.length === 1) {
    return conNombre.map((c) => {
      if (c.concepto && (!c.monto || c.monto <= 0)) {
        return { concepto: c.concepto, monto: restante };
      }
      return c;
    });
  }

  const parte = round2(restante / sinMonto.length);
  return conNombre.map((c) => {
    if (c.concepto && (!c.monto || c.monto <= 0)) {
      return { concepto: c.concepto, monto: parte };
    }
    return c;
  });
}

export function previewIvaDesdeTotales(
  totalBs: number,
  exentoBs: number,
  retencionIvaPct: string,
  retencionIslr: number,
  tasa?: number | null,
  moneda?: string
) {
  return calcularIvaYNeto(totalBs, exentoBs, retencionIvaPct, retencionIslr, tasa, moneda);
}
