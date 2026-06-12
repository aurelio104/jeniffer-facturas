import type { ConceptoIslrInput } from './islr.js';
import { calcularIvaYNeto, round2 } from './islr.js';

export { round2 };

/** Solo facturas (FAC) aplican retención ISLR — igual que Excel ActualizarBloqueos. */
export function isTipoConIslr(tipo: string) {
  return tipo.toUpperCase() === 'FAC';
}

export function isTipoSinIslr(tipo: string) {
  return !isTipoConIslr(tipo);
}

export function calcularGrabado(totalBs: number, exentoBs = 0) {
  return round2(Math.max(0, totalBs - exentoBs));
}

export function calcularBaseImponible(totalBs: number, exentoBs = 0) {
  const grabado = Math.max(0, totalBs - exentoBs);
  return round2(grabado / 1.16);
}

/**
 * Si el monto ingresado coincide con el total de la factura, desglosa IVA + exento
 * (lógica btnAgregarConcepto en REGISTRO_FACT.cls).
 */
export function montoProcesarIslr(montoIngresado: number, totalBs: number, exentoBs = 0): number {
  if (montoIngresado <= 0) return 0;
  const grabado = Math.max(0, totalBs - exentoBs);
  if (round2(montoIngresado) === round2(totalBs)) {
    return round2(grabado / 1.16 + exentoBs);
  }
  return round2(montoIngresado);
}

export function validarSumaConceptosIslr(
  conceptos: ConceptoIslrInput[],
  totalBs: number,
  exentoBs: number
): { ok: boolean; error?: string } {
  const grabado = calcularGrabado(totalBs, exentoBs);
  const suma = round2(
    conceptos.filter((c) => c.concepto.trim() && c.monto > 0).reduce((s, c) => s + c.monto, 0)
  );
  if (suma > grabado + 0.01) {
    return {
      ok: false,
      error: `La suma de conceptos (${suma.toFixed(2)}) supera el grabado disponible (${grabado.toFixed(2)} Bs).`
    };
  }
  return { ok: true };
}

/**
 * Normaliza conceptos ISLR: procesa montos (desglose si monto = total) y asigna restante en orden.
 */
export function normalizarConceptosIslr(
  conceptos: ConceptoIslrInput[],
  totalBs: number,
  exentoBs: number,
  tipoDoc: string
): ConceptoIslrInput[] {
  if (!isTipoConIslr(tipoDoc)) return [];

  const conNombre = conceptos.filter((c) => c.concepto.trim());
  if (conNombre.length === 0) return [];

  const grabado = calcularGrabado(totalBs, exentoBs);
  let restanteRaw = grabado;
  const result: ConceptoIslrInput[] = [];

  for (const c of conNombre) {
    let rawMonto = 0;
    if (c.monto > 0) {
      rawMonto = round2(c.monto);
      restanteRaw = round2(restanteRaw - rawMonto);
    } else if (restanteRaw > 0) {
      rawMonto = restanteRaw;
      restanteRaw = 0;
    }

    if (rawMonto > 0) {
      result.push({
        concepto: c.concepto,
        monto: montoProcesarIslr(rawMonto, totalBs, exentoBs)
      });
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
