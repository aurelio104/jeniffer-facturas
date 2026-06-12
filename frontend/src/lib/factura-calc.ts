export type ConceptoRow = { id: string; concepto: string; monto: number };

export function newConceptoRow(
  partial?: Partial<Omit<ConceptoRow, 'id'>> & { id?: string }
): ConceptoRow {
  return {
    id: partial?.id ?? globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    concepto: partial?.concepto ?? '',
    monto: partial?.monto ?? 0
  };
}

/** Alinea nombre guardado con la tabla TAB ISLR (mayúsculas / acentos). */
export function matchConceptoTabla(nombre: string, tablas: Array<{ concepto: string }>): string {
  const t = nombre.trim();
  if (!t) return '';
  const exact = tablas.find((row) => row.concepto === t);
  if (exact) return exact.concepto;
  const ins = tablas.find((row) => row.concepto.toLowerCase() === t.toLowerCase());
  return ins?.concepto ?? t;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Solo FAC aplica ISLR (Excel ActualizarBloqueos). */
export function isTipoConIslr(tipo: string) {
  return tipo.toUpperCase() === 'FAC';
}

export function isTipoSinIslr(tipo: string) {
  return !isTipoConIslr(tipo);
}

export function totalBsFromForm(total: number, moneda: string, tasa: number) {
  if (total <= 0) return 0;
  return moneda === 'Bs' ? total : total * tasa;
}

export function calcularGrabado(totalBs: number, exentoBs = 0) {
  return round2(Math.max(0, totalBs - exentoBs));
}

export function calcularBaseImponible(totalBs: number, exentoBs = 0) {
  const grabado = Math.max(0, totalBs - exentoBs);
  return round2(grabado / 1.16);
}

export function montoProcesarIslr(montoIngresado: number, totalBs: number, exentoBs = 0): number {
  if (montoIngresado <= 0) return 0;
  const grabado = Math.max(0, totalBs - exentoBs);
  if (round2(montoIngresado) === round2(totalBs)) {
    return round2(grabado / 1.16 + exentoBs);
  }
  return round2(montoIngresado);
}

/** Restante grabado (total − exento) menos montos ya ingresados en otras líneas */
export function grabadoRestanteIslr(
  conceptos: ConceptoRow[],
  totalBs: number,
  exentoBs: number,
  excludeIndex?: number
) {
  const grabado = calcularGrabado(totalBs, exentoBs);
  const usado = conceptos.reduce((s, c, i) => {
    if (i === excludeIndex) return s;
    if (c.concepto.trim() && c.monto > 0) return s + c.monto;
    return s;
  }, 0);
  return Math.max(0, round2(grabado - usado));
}

/** @deprecated usar grabadoRestanteIslr */
export function baseRestanteIslr(
  conceptos: ConceptoRow[],
  totalBs: number,
  exentoBs: number,
  excludeIndex?: number
) {
  return grabadoRestanteIslr(conceptos, totalBs, exentoBs, excludeIndex);
}

/** Una sola línea: sugiere el total de factura (Excel autollenado); el backend desglosa IVA. */
export function autollenarSiUnSoloConcepto(
  conceptos: ConceptoRow[],
  totalBs: number,
  _exentoBs: number,
  tipoDoc: string
): ConceptoRow[] {
  if (isTipoSinIslr(tipoDoc) || totalBs <= 0) return conceptos;

  const named = conceptos.filter((c) => c.concepto.trim());
  if (named.length !== 1) return conceptos;

  return conceptos.map((c) =>
    c.concepto.trim() ? { ...c, monto: round2(totalBs) } : c
  );
}

export function aplicarMontoSugeridoRow(
  conceptos: ConceptoRow[],
  index: number,
  totalBs: number,
  exentoBs: number,
  tipoDoc: string
): ConceptoRow[] {
  if (isTipoSinIslr(tipoDoc) || totalBs <= 0) return conceptos;
  const row = conceptos[index];
  if (!row?.concepto.trim()) return conceptos;

  const restante = grabadoRestanteIslr(conceptos, totalBs, exentoBs, index);
  const monto = restante > 0 ? restante : round2(totalBs);
  const copy = [...conceptos];
  copy[index] = { ...row, monto };
  return copy;
}
