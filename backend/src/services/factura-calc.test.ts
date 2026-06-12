import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularBaseImponible,
  isTipoSinIslr,
  normalizarConceptosIslr,
  previewIvaDesdeTotales
} from './factura-calc.js';

test('calcularBaseImponible con IVA 16% incluido', () => {
  const base = calcularBaseImponible(13518.31, 0);
  assert.equal(base, 11653.72);
});

test('retención IVA 75% y monto a pagar sin ISLR', () => {
  const iva = previewIvaDesdeTotales(13518.31, 0, '75%', 0, 577.55, 'Bs');
  assert.equal(iva.grabadoBs, 13518.31);
  assert.equal(iva.baseImponible, 11653.72);
  assert.equal(iva.retencionIva, 1398.45);
  assert.equal(iva.montoAPagar, 12119.86);
});

test('REC no aplica ISLR', () => {
  assert.equal(isTipoSinIslr('REC'), true);
  const out = normalizarConceptosIslr(
    [{ concepto: 'SERVICIOS', monto: 0 }],
    10000,
    0,
    'REC'
  );
  assert.deepEqual(out, []);
});

test('un solo concepto recibe la base imponible', () => {
  const out = normalizarConceptosIslr(
    [{ concepto: 'SERVICIOS', monto: 0 }],
    13518.31,
    0,
    'FAC'
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].monto, 11653.72);
});

test('varias líneas: primera toma base, segunda queda en 0 si no hay restante', () => {
  const out = normalizarConceptosIslr(
    [
      { concepto: 'SERVICIOS', monto: 0 },
      { concepto: 'HONORARIOS', monto: 0 }
    ],
    13518.31,
    0,
    'FAC'
  );
  assert.equal(out[0].monto, 11653.72);
  assert.equal(out[1].monto, 0);
});

test('varias líneas con montos parciales asignan restante en orden', () => {
  const out = normalizarConceptosIslr(
    [
      { concepto: 'SERVICIOS', monto: 5000 },
      { concepto: 'HONORARIOS', monto: 0 }
    ],
    13518.31,
    0,
    'FAC'
  );
  assert.equal(out[0].monto, 5000);
  assert.equal(out[1].monto, 6653.72);
});
