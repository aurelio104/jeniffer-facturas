import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import {
  enriquecerLineasIslrConDesglose,
  normalizarConceptosIslr,
  validarSumaConceptosIslr
} from './factura-calc.js';
import { calcularIslr, calcularIvaYNeto } from './islr.js';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function previewPipeline(
  tipoIslr: string,
  retIva: string,
  conceptosRaw: { concepto: string; monto: number }[],
  totalBs = 13518.31,
  exentoBs = 0,
  tasa = 577.55
) {
  const validacion = validarSumaConceptosIslr(conceptosRaw, totalBs, exentoBs);
  assert.equal(validacion.ok, true);
  const conceptos = normalizarConceptosIslr(conceptosRaw, totalBs, exentoBs, 'FAC');
  const islr = await calcularIslr(tipoIslr, conceptos, totalBs);
  const lineasIslr = enriquecerLineasIslrConDesglose(
    islr.lineas,
    conceptosRaw,
    totalBs,
    exentoBs,
    retIva,
    tasa,
    'Bs'
  );
  const iva = calcularIvaYNeto(totalBs, exentoBs, retIva, islr.retencionIslr, tasa, 'Bs');
  return { lineasIslr, islr, iva };
}

test('pipeline preview: una línea SERVICIOS al 50% del grabado', async () => {
  const half = round2(13518.31 / 2);
  const { lineasIslr, islr, iva } = await previewPipeline('PJD', '75%', [
    { concepto: 'SERVICIOS', monto: half }
  ]);
  assert.equal(lineasIslr.length, 1);
  assert.equal(lineasIslr[0].totalBs, half);
  assert.equal(lineasIslr[0].grabadoBs, half);
  assert.ok(lineasIslr[0].baseIslr > 0);
  assert.equal(islr.retencionIslr, round2((half / 1.16) * 0.02));
  assert.ok(lineasIslr[0].montoAPagar < iva.montoAPagar);
});

test('pipeline preview: SERVICIOS + HONORARIOS reparto completo', async () => {
  const half = round2(13518.31 / 2);
  const { lineasIslr, islr, iva } = await previewPipeline('PJD', '75%', [
    { concepto: 'SERVICIOS', monto: half },
    { concepto: 'HONORARIOS PROFESIONALES', monto: round2(13518.31 - half) }
  ]);
  assert.equal(lineasIslr.length, 2);
  assert.equal(round2(lineasIslr[0].totalBs + lineasIslr[1].totalBs), 13518.31);
  assert.equal(round2(lineasIslr[0].grabadoBs + lineasIslr[1].grabadoBs), 13518.31);
  assert.equal(iva.montoAPagar, round2(13518.31 - iva.retencionIva - islr.retencionIslr));
  assert.ok(lineasIslr[0].concepto === 'SERVICIOS');
  assert.ok(lineasIslr[1].concepto === 'HONORARIOS PROFESIONALES');
  const base0 = round2(half / 1.16);
  const base1 = round2(13518.31 - half) / 1.16;
  assert.equal(lineasIslr[0].baseIslr, round2(base0));
  assert.equal(lineasIslr[0].retencionIslr, round2(base0 * 0.02));
  assert.equal(lineasIslr[1].retencionIslr, round2(round2(base1) * 0.05));
});

test('pipeline preview: factura completa un solo concepto', async () => {
  const { lineasIslr, islr, iva } = await previewPipeline('PJD', '75%', [
    { concepto: 'SERVICIOS', monto: 13518.31 }
  ]);
  assert.equal(lineasIslr.length, 1);
  assert.equal(lineasIslr[0].totalBs, 13518.31);
  assert.equal(lineasIslr[0].grabadoBs, 13518.31);
  assert.equal(iva.montoAPagar, round2(13518.31 - iva.retencionIva - islr.retencionIslr));
  assert.equal(islr.retencionIslr, round2(11653.72 * 0.02));
});

test.after(async () => {
  await prisma.$disconnect();
});
