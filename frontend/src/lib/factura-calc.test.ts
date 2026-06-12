import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarMontoSugeridoRow,
  calcularGrabado,
  grabadoRestanteIslr,
  newConceptoRow,
  prepararNuevaLineaIslr,
  sumMontosConceptos
} from './factura-calc.ts';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

test('prepararNuevaLineaIslr reparte cuando la primera línea usa todo el grabado', () => {
  const total = 13518.31;
  const grabado = calcularGrabado(total, 0);
  const line1 = newConceptoRow({ concepto: 'SERVICIOS', monto: grabado });
  const { conceptos, repartido } = prepararNuevaLineaIslr([line1], total, 0);
  assert.equal(repartido, true);
  assert.equal(conceptos.length, 2);
  assert.equal(sumMontosConceptos(conceptos), grabado);
});

test('aplicarMontoSugeridoRow no asigna total de factura en segunda línea', () => {
  const total = 13518.31;
  const half = round2(total / 2);
  const rows = [
    newConceptoRow({ concepto: 'SERVICIOS', monto: half }),
    newConceptoRow({ concepto: 'HONORARIOS PROFESIONALES', monto: 0 })
  ];
  const next = aplicarMontoSugeridoRow(rows, 1, total, 0, 'FAC');
  assert.ok(next[1].monto > 0);
  assert.notEqual(next[1].monto, total);
  assert.ok(next[1].monto >= half - 0.02);
});

test('grabadoRestanteIslr: segunda línea ve restante sin contar la primera', () => {
  const total = 13518.31;
  const half = round2(total / 2);
  const rows = [
    newConceptoRow({ concepto: 'SERVICIOS', monto: half }),
    newConceptoRow({ concepto: 'HONORARIOS PROFESIONALES', monto: 0 })
  ];
  const restanteLine2 = grabadoRestanteIslr(rows, total, 0, 1);
  assert.equal(restanteLine2, round2(calcularGrabado(total, 0) - half));
});
