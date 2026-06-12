type ConceptoRow = { concepto: string; monto: number };

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function isTipoSinIslr(tipo: string) {
  return tipo.toUpperCase() === 'REC';
}

export function totalBsFromForm(total: number, moneda: string, tasa: number) {
  if (total <= 0) return 0;
  return moneda === 'Bs' ? total : total * tasa;
}

export function calcularBaseImponible(totalBs: number, exentoBs = 0) {
  const grabado = Math.max(0, totalBs - exentoBs);
  return round2(grabado / 1.16);
}

/** Monto ya asignado en otras líneas (excluye índice opcional) */
export function baseRestanteIslr(
  conceptos: ConceptoRow[],
  totalBs: number,
  exentoBs: number,
  excludeIndex?: number
) {
  const base = calcularBaseImponible(totalBs, exentoBs);
  const usado = conceptos.reduce((s, c, i) => {
    if (i === excludeIndex) return s;
    if (c.concepto.trim() && c.monto > 0) return s + c.monto;
    return s;
  }, 0);
  return Math.max(0, round2(base - usado));
}

/** Si solo hay una línea con concepto, usa la base imponible completa */
export function autollenarSiUnSoloConcepto(
  conceptos: ConceptoRow[],
  totalBs: number,
  exentoBs: number,
  tipoDoc: string
): ConceptoRow[] {
  if (isTipoSinIslr(tipoDoc) || totalBs <= 0) return conceptos;

  const named = conceptos.filter((c) => c.concepto.trim());
  if (named.length !== 1) return conceptos;

  const base = calcularBaseImponible(totalBs, exentoBs);
  return conceptos.map((c) =>
    c.concepto.trim() ? { ...c, monto: base } : c
  );
}

/** Sugiere monto solo para la línea indicada (restante tras otras líneas) */
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

  const restante = baseRestanteIslr(conceptos, totalBs, exentoBs, index);
  const copy = [...conceptos];
  copy[index] = { ...row, monto: restante };
  return copy;
}
