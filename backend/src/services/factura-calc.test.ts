import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularBaseImponible,
  calcularGrabado,
  enriquecerLineasIslrConDesglose,
  isTipoConIslr,
  isTipoSinIslr,
  montoProcesarIslr,
  normalizarConceptosIslr,
  previewIvaDesdeTotales,
  validarSumaConceptosIslr
} from './factura-calc.js';
import type { IslrLineaDetalle } from './islr.js';

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

test('REC y NE no aplican ISLR', () => {
  assert.equal(isTipoSinIslr('REC'), true);
  assert.equal(isTipoSinIslr('NE'), true);
  assert.equal(isTipoConIslr('FAC'), true);
  const out = normalizarConceptosIslr(
    [{ concepto: 'SERVICIOS', monto: 0 }],
    10000,
    0,
    'REC'
  );
  assert.deepEqual(out, []);
});

test('montoProcesarIslr desglosa cuando monto = total', () => {
  assert.equal(montoProcesarIslr(13518.31, 13518.31, 0), 11653.72);
  assert.equal(montoProcesarIslr(5000, 13518.31, 0), 5000);
});

test('montoProcesarIslr suma exento al desglosar', () => {
  assert.equal(montoProcesarIslr(15000, 15000, 1000), round2(14000 / 1.16 + 1000));
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

test('un solo concepto autollenado usa total; normalizado desglosa', () => {
  const out = normalizarConceptosIslr(
    [{ concepto: 'SERVICIOS', monto: 13518.31 }],
    13518.31,
    0,
    'FAC'
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].monto, 11653.72);
});

test('validación suma conceptos vs grabado', () => {
  const ok = validarSumaConceptosIslr(
    [{ concepto: 'SERVICIOS', monto: 10000 }],
    13518.31,
    0
  );
  assert.equal(ok.ok, true);
  const bad = validarSumaConceptosIslr(
    [{ concepto: 'SERVICIOS', monto: 14000 }],
    13518.31,
    0
  );
  assert.equal(bad.ok, false);
});

test('varias líneas con montos parciales asignan restante en grabado', () => {
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
  assert.equal(out[1].monto, round2(calcularGrabado(13518.31, 0) - 5000));
});

test('enriquecerLineasIslrConDesglose reparte totales proporcionalmente', () => {
  const baseLinea = (): IslrLineaDetalle => ({
    concepto: '',
    montoIngresado: 0,
    baseIslr: 100,
    retencionIslr: 2,
    pctEfectivo: 0.02,
    totalBs: 0,
    totalUsd: null,
    grabadoBs: 0,
    baseImponible: 0,
    iva16: 0,
    retencionIva: 0,
    montoAPagar: 0,
    montoAPagarUsd: null
  });
  const half = round2(13518.31 / 2);
  const lineas: IslrLineaDetalle[] = [
    { ...baseLinea(), concepto: 'SERVICIOS', montoIngresado: half },
    { ...baseLinea(), concepto: 'HONORARIOS PROFESIONALES', montoIngresado: half }
  ];
  const raw = [
    { concepto: 'SERVICIOS', monto: half },
    { concepto: 'HONORARIOS PROFESIONALES', monto: half }
  ];
  const enriched = enriquecerLineasIslrConDesglose(
    lineas,
    raw,
    13518.31,
    0,
    '75%',
    577.55,
    'Bs'
  );
  assert.equal(enriched.length, 2);
  assert.equal(enriched[0].totalBs, half);
  assert.equal(enriched[1].totalBs, round2(13518.31 - half));
  assert.equal(round2(enriched[0].totalBs + enriched[1].totalBs), 13518.31);
  assert.equal(enriched[0].grabadoBs, half);
});

test('enriquecerLineasIslrConDesglose con una línea parcial no asigna el total de factura', () => {
  const baseLinea = (): IslrLineaDetalle => ({
    concepto: 'SERVICIOS',
    montoIngresado: 6759.16,
    baseIslr: 6759.16,
    retencionIslr: 135.18,
    pctEfectivo: 0.02,
    totalBs: 0,
    totalUsd: null,
    grabadoBs: 0,
    baseImponible: 0,
    iva16: 0,
    retencionIva: 0,
    montoAPagar: 0,
    montoAPagarUsd: null
  });
  const partial = round2(13518.31 / 2);
  const enriched = enriquecerLineasIslrConDesglose(
    [baseLinea()],
    [{ concepto: 'SERVICIOS', monto: partial }],
    13518.31,
    0,
    '75%',
    577.55,
    'Bs'
  );
  assert.equal(enriched[0].totalBs, partial);
  assert.equal(enriched[0].grabadoBs, partial);
  assert.ok(enriched[0].baseIslr > 0);
  assert.ok(enriched[0].retencionIslr > 1);
});
