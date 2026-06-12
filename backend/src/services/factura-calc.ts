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

/**
 * Normaliza conceptos ISLR respetando montos ya ingresados.
 * Líneas sin monto reciben el restante en orden (no se divide entre varias).
 */
export function normalizarConceptosIslr(
  conceptos: ConceptoIslrInput[],
  totalBs: number,
  exentoBs: number,
  tipoDoc: string
): ConceptoIslrInput[] {
  if (isTipoSinIslr(tipoDoc)) return [];

  const conNombre = conceptos.filter((c) => c.concepto.trim());
  if (conNombre.length === 0) return [];

  let restante = calcularBaseImponible(totalBs, exentoBs);
  const result: ConceptoIslrInput[] = [];

  for (const c of conNombre) {
    if (c.monto > 0) {
      result.push({ concepto: c.concepto, monto: round2(c.monto) });
      restante = round2(restante - c.monto);
    } else if (restante > 0) {
      result.push({ concepto: c.concepto, monto: restante });
      restante = 0;
    } else {
      result.push({ concepto: c.concepto, monto: 0 });
    }
  }

  return result;
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
