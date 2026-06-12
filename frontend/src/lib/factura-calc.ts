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

/** Autollenar montos ISLR con la base imponible (misma lógica que backend) */
export function autollenarMontosIslr(
  conceptos: ConceptoRow[],
  totalBs: number,
  exentoBs: number,
  tipoDoc: string
): ConceptoRow[] {
  if (isTipoSinIslr(tipoDoc) || totalBs <= 0) {
    return conceptos.map((c) => ({ ...c, monto: 0 }));
  }

  const conNombre = conceptos.filter((c) => c.concepto.trim());
  if (conNombre.length === 0) return conceptos;

  const base = calcularBaseImponible(totalBs, exentoBs);
  const sinMonto = conNombre.filter((c) => !c.monto || c.monto <= 0);
  const asignado = conNombre
    .filter((c) => c.monto > 0)
    .reduce((s, c) => s + c.monto, 0);

  if (sinMonto.length === 0) return conceptos;

  const restante = Math.max(0, round2(base - asignado));
  const parte = sinMonto.length === 1 ? restante : round2(restante / sinMonto.length);

  return conceptos.map((c) => {
    if (!c.concepto.trim()) return { ...c, monto: 0 };
    if (c.monto > 0) return c;
    return { ...c, monto: parte };
  });
}
