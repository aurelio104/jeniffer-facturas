import type { ConceptoIslrInput, IslrLineaDetalle } from './islr.js';
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

/** Desglose IVA / neto proporcional por línea ISLR (para preview en formulario). */
export function enriquecerLineasIslrConDesglose(
  lineas: IslrLineaDetalle[],
  conceptosRaw: ConceptoIslrInput[],
  totalBs: number,
  exentoBs: number,
  retencionIvaPct: string,
  tasa: number | null | undefined,
  moneda: string
): IslrLineaDetalle[] {
  const grabadoTotal = calcularGrabado(totalBs, exentoBs);
  const rawByConcept = new Map<string, number>();
  for (const c of conceptosRaw) {
    const name = c.concepto.trim();
    if (!name || c.monto <= 0) continue;
    const key = name.toLowerCase();
    rawByConcept.set(key, round2((rawByConcept.get(key) ?? 0) + c.monto));
  }

  let totalAsignado = 0;
  let exentoAsignado = 0;

  return lineas.map((linea, index) => {
    const key = linea.concepto.toLowerCase();
    const lineGrabado = rawByConcept.get(key) ?? linea.montoIngresado;
    const ratio =
      grabadoTotal > 0
        ? lineGrabado / grabadoTotal
        : lineas.length === 1
          ? 1
          : 0;
    const isLast = index === lineas.length - 1;
    const lineTotalBs = isLast
      ? round2(totalBs - totalAsignado)
      : round2(totalBs * ratio);
    const lineExento = isLast
      ? round2(exentoBs - exentoAsignado)
      : round2(exentoBs * ratio);
    totalAsignado = round2(totalAsignado + lineTotalBs);
    exentoAsignado = round2(exentoAsignado + lineExento);
    const iva = calcularIvaYNeto(
      lineTotalBs,
      lineExento,
      retencionIvaPct,
      linea.retencionIslr,
      tasa,
      moneda
    );
    let totalUsd: number | null = null;
    if (tasa && tasa > 0) {
      totalUsd = moneda === 'USD' ? round2(lineTotalBs) : round2(lineTotalBs / tasa);
    }
    return {
      ...linea,
      totalBs: lineTotalBs,
      totalUsd,
      grabadoBs: iva.grabadoBs,
      baseImponible: iva.baseImponible,
      iva16: iva.iva16,
      retencionIva: iva.retencionIva,
      montoAPagar: iva.montoAPagar,
      montoAPagarUsd: iva.montoAPagarUsd
    };
  });
}
