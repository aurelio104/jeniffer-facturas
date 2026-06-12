import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { construirMaestra, type MaestraRow } from './maestra.js';
import { resolvePeriod, type PeriodoExport } from './export-period.js';
import type { Factura, Pago, Proveedor } from '../generated/prisma/client.js';

export type ExportBundle = {
  meta: {
    label: string;
    periodo: PeriodoExport;
    desde: string;
    hasta: string;
    generado: string;
    rifFiltro?: string;
  };
  resumen: {
    facturas: number;
    pagos: number;
    proveedores: number;
    totalFacturadoBs: number;
    totalAPagarBs: number;
    totalPagadoBs: number;
    saldoPeriodoBs: number;
    retIva: number;
    retIslr: number;
  };
  facturas: Factura[];
  pagos: Pago[];
  proveedores: Proveedor[];
  maestra: MaestraRow[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function facturaEnPeriodo(f: Factura, desde: Date, hasta: Date): boolean {
  const t = f.fecha.getTime();
  return t >= desde.getTime() && t <= hasta.getTime();
}

function pagoEnPeriodo(p: Pago, desde: Date, hasta: Date): boolean {
  const t = p.fecha.getTime();
  return t >= desde.getTime() && t <= hasta.getTime();
}

export async function gatherExportData(
  periodo: PeriodoExport,
  rifFilter?: string
): Promise<ExportBundle> {
  const range = resolvePeriod(periodo);
  const { desde, hasta } = range;

  const allFacturas = await prisma.factura.findMany({
    where: rifFilter ? { rif: rifFilter } : undefined,
    orderBy: { fecha: 'asc' }
  });
  const allPagos = await prisma.pago.findMany({
    where: rifFilter ? { rif: rifFilter } : undefined,
    orderBy: { fecha: 'asc' }
  });

  const facturas = allFacturas.filter((f) => facturaEnPeriodo(f, desde, hasta));
  const pagos = allPagos.filter((p) => pagoEnPeriodo(p, desde, hasta));

  const rifSet = new Set<string>();
  facturas.forEach((f) => rifSet.add(f.rif));
  pagos.forEach((p) => rifSet.add(p.rif));

  const proveedores = rifSet.size
    ? await prisma.proveedor.findMany({
        where: { rif: { in: [...rifSet] } },
        orderBy: { nombre: 'asc' }
      })
    : [];

  const maestraFull = await construirMaestra(rifFilter);
  const facturaIds = new Set(facturas.map((f) => f.id));
  const maestra = maestraFull.filter(
    (m) => facturaIds.has(m.id) || pagos.some((p) => p.documento.includes(m.numero) && p.rif === m.rif)
  );

  const totalFacturadoBs = round2(facturas.reduce((s, f) => s + f.totalBs, 0));
  const totalAPagarBs = round2(facturas.reduce((s, f) => s + f.montoAPagar, 0));
  const totalPagadoBs = round2(pagos.reduce((s, p) => s + (p.pagadoBs ?? 0), 0));
  const retIva = round2(facturas.reduce((s, f) => s + f.retencionIva, 0));
  const retIslr = round2(facturas.reduce((s, f) => s + f.retencionIslr, 0));

  return {
    meta: {
      label: range.label,
      periodo,
      desde: dateStr(desde),
      hasta: dateStr(hasta),
      generado: new Date().toISOString(),
      rifFiltro: rifFilter
    },
    resumen: {
      facturas: facturas.length,
      pagos: pagos.length,
      proveedores: proveedores.length,
      totalFacturadoBs,
      totalAPagarBs,
      totalPagadoBs,
      saldoPeriodoBs: round2(totalAPagarBs - totalPagadoBs),
      retIva,
      retIslr
    },
    facturas,
    pagos,
    proveedores,
    maestra
  };
}

function facturaRows(facturas: Factura[]) {
  return facturas.map((f) => ({
    Fecha: dateStr(f.fecha),
    Documento: `${f.tipo}-${f.numero}`,
    RIF: f.rif,
    Proveedor: f.proveedorNombre,
    Causado: f.causado ?? '',
    Estación: f.estacion ?? '',
    Moneda: f.moneda,
    'Total Bs': f.totalBs,
    'Exento Bs': f.exentoBs,
    'Base imponible': f.baseImponible,
    IVA: f.iva16,
    'Ret. IVA': f.retencionIva,
    'Ret. ISLR': f.retencionIslr,
    'A pagar Bs': f.montoAPagar,
    'A pagar USD': f.montoAPagarUsd ?? '',
    'Días crédito': f.diasCredito,
    'Recibido físico': f.recibidoFisico,
    'Retención enviada': f.retencionEnviada,
    Concepto: f.concepto ?? ''
  }));
}

function pagoRows(pagos: Pago[]) {
  return pagos.map((p) => ({
    Fecha: dateStr(p.fecha),
    RIF: p.rif,
    Proveedor: p.proveedor,
    Documento: p.documento,
    Banco: p.banco,
    Referencia: p.referencia,
    'Pagado Bs': p.pagadoBs ?? '',
    'Pagado USD': p.pagadoUsd ?? '',
    Tasa: p.tasa ?? '',
    Observación: p.observacion ?? '',
    Anticipo: p.estadoAnticipo ?? ''
  }));
}

function maestraRows(rows: MaestraRow[]) {
  return rows.map((m) => ({
    Documento: `${m.tipo}-${m.numero}`,
    RIF: m.rif,
    Proveedor: m.proveedor,
    Fecha: m.fecha.slice(0, 10),
    Estado: m.estado,
    'Total Bs': m.totalBs,
    'A pagar Bs': m.montoAPagar,
    'Pagado Bs': m.pagadoBs,
    'Saldo Bs': m.saldoBs,
    IVA: m.iva16,
    'Ret. IVA': m.retIva,
    'Ret. ISLR': m.retIslr,
    'Dif. USD': m.difCambiariaUsd ?? '',
    Vencida: m.vencida ? 'Sí' : 'No',
    Físico: m.recibidoFisico,
    Retención: m.retencionEnviada
  }));
}

function proveedorRows(proveedores: Proveedor[]) {
  return proveedores.map((p) => ({
    RIF: p.rif,
    Nombre: p.nombre,
    'Tipo ISLR': p.tipoIslr,
    'Ret. IVA': p.retencionIva,
    Banco: p.banco ?? '',
    Cuenta: p.numCuenta ?? '',
    Email: p.email ?? '',
    Teléfono: p.telefono ?? '',
    Estación: p.estacion ?? ''
  }));
}

function resumenRows(data: ExportBundle) {
  return [
    { Concepto: 'Período', Valor: data.meta.label },
    { Concepto: 'Desde', Valor: data.meta.desde },
    { Concepto: 'Hasta', Valor: data.meta.hasta },
    ...(data.meta.rifFiltro ? [{ Concepto: 'Filtro RIF', Valor: data.meta.rifFiltro }] : []),
    { Concepto: 'Facturas', Valor: data.resumen.facturas },
    { Concepto: 'Pagos', Valor: data.resumen.pagos },
    { Concepto: 'Proveedores', Valor: data.resumen.proveedores },
    { Concepto: 'Total facturado Bs', Valor: data.resumen.totalFacturadoBs },
    { Concepto: 'Total a pagar Bs', Valor: data.resumen.totalAPagarBs },
    { Concepto: 'Total pagado Bs', Valor: data.resumen.totalPagadoBs },
    { Concepto: 'Saldo período Bs', Valor: data.resumen.saldoPeriodoBs },
    { Concepto: 'Ret. IVA Bs', Valor: data.resumen.retIva },
    { Concepto: 'Ret. ISLR Bs', Valor: data.resumen.retIslr }
  ];
}

export function buildExcelExport(data: ExportBundle): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows(data)), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facturaRows(data.facturas)), 'Facturas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagoRows(data.pagos)), 'Pagos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maestraRows(data.maestra)), 'Maestra');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proveedorRows(data.proveedores)), 'Proveedores');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function pdfTable(
  doc: PdfDoc,
  title: string,
  headers: string[],
  rows: string[][],
  startY?: number
): number {
  let y = startY ?? doc.y + 10;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / headers.length;

  if (y > doc.page.height - 120) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  doc.fontSize(11).font('Helvetica-Bold').text(title, doc.page.margins.left, y);
  y += 16;

  doc.fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, doc.page.margins.left + i * colWidth, y, { width: colWidth - 4, lineBreak: false });
  });
  y += 12;
  doc.font('Helvetica');

  for (const row of rows) {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    row.forEach((cell, i) => {
      doc.text(String(cell).slice(0, 28), doc.page.margins.left + i * colWidth, y, {
        width: colWidth - 4,
        lineBreak: false
      });
    });
    y += 11;
  }

  return y + 8;
}

export function buildPdfExport(data: ExportBundle): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text('Jeniffer — Exportación', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(data.meta.label, { align: 'center' });
    doc.text(`Generado: ${new Date(data.meta.generado).toLocaleString('es-VE')}`, { align: 'center' });
    doc.moveDown();

    const resumenLines = resumenRows(data).map((r) => [`${r.Concepto}`, String(r.Valor)]);
    let y = pdfTable(doc, 'Resumen', ['Concepto', 'Valor'], resumenLines, doc.y);

    const factRows = data.facturas.slice(0, 80).map((f) => [
      dateStr(f.fecha),
      `${f.tipo}-${f.numero}`,
      f.rif,
      f.proveedorNombre.slice(0, 20),
      f.montoAPagar.toFixed(2)
    ]);
    if (data.facturas.length > 80) {
      factRows.push(['…', `${data.facturas.length - 80} más en Excel`, '', '', '']);
    }
    y = pdfTable(doc, `Facturas (${data.facturas.length})`, ['Fecha', 'Doc', 'RIF', 'Proveedor', 'A pagar'], factRows, y);

    const pagoRowsPdf = data.pagos.slice(0, 80).map((p) => [
      dateStr(p.fecha),
      p.documento,
      p.referencia,
      (p.pagadoBs ?? 0).toFixed(2),
      p.banco.slice(0, 15)
    ]);
    if (data.pagos.length > 80) {
      pagoRowsPdf.push(['…', `${data.pagos.length - 80} más en Excel`, '', '', '']);
    }
    pdfTable(doc, `Pagos (${data.pagos.length})`, ['Fecha', 'Doc', 'Ref', 'Bs', 'Banco'], pagoRowsPdf, y);

    doc.end();
  });
}

export function exportFilename(periodo: PeriodoExport, ext: 'xlsx' | 'pdf'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `jeniffer-${periodo}-${stamp}.${ext}`;
}
