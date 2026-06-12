import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularRetencionT2,
  factorBaseTab,
  factorPctTab,
  round2
} from './islr.js';

test('factorBaseTab acepta Excel (1) y porcentaje (100)', () => {
  assert.equal(factorBaseTab(1), 1);
  assert.equal(factorBaseTab(100), 1);
  assert.equal(factorBaseTab(0.9), 0.9);
  assert.equal(factorBaseTab(null), 1);
});

test('factorPctTab acepta decimal (0.03) y porcentaje (3)', () => {
  assert.equal(factorPctTab(0.03), 0.03);
  assert.equal(factorPctTab(3), 0.03);
  assert.equal(factorPctTab(0.02), 0.02);
});

test('tarifa T2 tramo bajo (UT <= 2000)', () => {
  const base = 1000 * 43;
  assert.equal(round2(calcularRetencionT2(base)), round2(base * 0.15));
});

test('SERVICIOS PJD 2% sobre base 11653.72', () => {
  const base = 11653.72;
  const ret = round2(base * factorPctTab(0.02));
  assert.equal(ret, 233.07);
});

test('Honorarios PNR 3% con sustraendo', () => {
  const base = 11653.72;
  let ret = base * factorPctTab(0.03);
  if (base > 3583.34) ret -= 107.5;
  assert.equal(round2(ret), 242.11);
});
