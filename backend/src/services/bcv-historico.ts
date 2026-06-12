/**
 * Histórico BCV oficial — descarga trimestrales del BCV (EstadisticasGeneral/*.xls)
 * y sincronización diaria vía bcv-service (mismo módulo Costos).
 */
import https from 'https';
import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma.js';
import { obtenerTasasDia } from './bcv-service.js';
import { upsertTasaLocal } from './tasas.js';

const BCV_SMC_PAGE = 'https://www.bcv.org.ve/estadisticas/tipo-cambio-de-referencia-smc';
const MESES_HISTORICO = 3;

export type HistoricoRebuildResult = {
  eliminados: number;
  insertados: number;
  desde: string;
  hasta: string;
  archivos: string[];
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function extractVentaBs(row: unknown[], currency: string): number | null {
  if (!Array.isArray(row)) return null;
  const cells = row.map((c) => (c == null ? '' : String(c)).trim().toUpperCase());
  const idx = cells.findIndex((c) => c === currency);
  if (idx < 0) return null;
  const nums = row.slice(idx).map((c) => Number(c));
  const venta = nums[5];
  if (!Number.isFinite(venta) || venta <= 0) return null;
  return Math.round(venta * 10000) / 10000;
}

function parseSheetRows(rows: unknown[][]): { fecha: Date; usd: number; eur: number | null } | null {
  let fechaValor: Date | null = null;
  let usdVenta: number | null = null;
  let eurVenta: number | null = null;

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => (c == null ? '' : String(c)));
    const line = cells.join(' ');
    const fv = line.match(/Fecha Valor:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (fv) {
      fechaValor = new Date(Number(fv[3]), Number(fv[2]) - 1, Number(fv[1]));
    }

    const usd = extractVentaBs(row, 'USD');
    if (usd != null) usdVenta = usd;
    const eur = extractVentaBs(row, 'EUR');
    if (eur != null) eurVenta = eur;
  }

  if (!fechaValor || !usdVenta) return null;
  return { fecha: startOfDay(fechaValor), usd: usdVenta, eur: eurVenta };
}

function fetchBcvText(url: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function fetchBcvBinary(url: string, timeoutMs = 45000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function fetchBcvXlsUrls(): Promise<Array<{ url: string; year: number; quarter: string }>> {
  const html = await fetchBcvText(BCV_SMC_PAGE);
  const out: Array<{ url: string; year: number; quarter: string }> = [];
  const re =
    /Año\s+(\d{4}),\s+Trimestre\s+([IVX]+)[\s\S]*?href="(https:\/\/www\.bcv\.org\.ve\/sites\/default\/files\/EstadisticasGeneral\/[^"]+\.xls)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ year: Number(m[1]), quarter: m[2], url: m[3] });
  }
  return out;
}

function quartersNeeded(
  desde: Date,
  hasta: Date,
  catalog: Array<{ url: string; year: number; quarter: string }>
) {
  const qOrder = ['I', 'II', 'III', 'IV'];
  const needed = new Set<string>();
  const cur = new Date(desde);
  while (cur <= hasta) {
    const y = cur.getFullYear();
    const month = cur.getMonth();
    const q = month < 3 ? 'I' : month < 6 ? 'II' : month < 9 ? 'III' : 'IV';
    needed.add(`${y}-${q}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return catalog.filter((c) => needed.has(`${c.year}-${c.quarter}`));
}

async function downloadXls(url: string): Promise<XLSX.WorkBook> {
  const buf = await fetchBcvBinary(url);
  return XLSX.read(buf, { type: 'buffer', cellDates: false });
}

export async function purgeHistoricoTasas(): Promise<number> {
  const r = await prisma.tasa.deleteMany();
  return r.count;
}

export async function rebuildHistoricoBcv(meses = MESES_HISTORICO): Promise<HistoricoRebuildResult> {
  const hasta = startOfDay(new Date());
  const desde = startOfDay(new Date(hasta));
  desde.setMonth(desde.getMonth() - meses);

  const eliminados = await purgeHistoricoTasas();

  const catalog = await fetchBcvXlsUrls();
  const files = quartersNeeded(desde, hasta, catalog);

  const porFecha = new Map<string, { usd: number; eur: number | null }>();

  for (const f of files) {
    try {
      const wb = await downloadXls(f.url);
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        const parsed = parseSheetRows(rows);
        if (!parsed) continue;
        if (parsed.fecha < desde || parsed.fecha > hasta) continue;
        porFecha.set(formatIso(parsed.fecha), { usd: parsed.usd, eur: parsed.eur });
      }
    } catch (e) {
      console.warn(`[bcv-historico] No se pudo leer ${f.url}:`, e);
    }
  }

  // Tasa viva del día (si el XLS aún no trae hoy)
  try {
    const live = await obtenerTasasDia(true);
    porFecha.set(formatIso(hasta), { usd: live.usd.tasa, eur: live.eur.tasa });
  } catch (e) {
    console.warn('[bcv-historico] Live BCV:', e);
  }

  let insertados = 0;
  for (const [fechaStr, rates] of porFecha.entries()) {
    const d = new Date(fechaStr + 'T12:00:00');
    await upsertTasaLocal(d, { usd: rates.usd, eur: rates.eur });
    insertados += 1;
  }

  return {
    eliminados,
    insertados,
    desde: formatIso(desde),
    hasta: formatIso(hasta),
    archivos: files.map((f) => f.url)
  };
}

/** Guarda USD/EUR de hoy en histórico (llamar al arranque y periódicamente). */
export async function guardarTasaHoyEnHistorico(): Promise<{ usd: number; eur: number }> {
  const tasas = await obtenerTasasDia();
  await upsertTasaLocal(new Date(), { usd: tasas.usd.tasa, eur: tasas.eur.tasa });
  return { usd: tasas.usd.tasa, eur: tasas.eur.tasa };
}

export function startBcvHistoricoScheduler() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  let lastDay = formatIso(new Date());

  const tick = async () => {
    try {
      const hoy = formatIso(new Date());
      await guardarTasaHoyEnHistorico();
      if (hoy !== lastDay) {
        lastDay = hoy;
        console.log(`[bcv-historico] Nueva fecha ${hoy} — tasa guardada en histórico`);
      }
    } catch (e) {
      console.warn('[bcv-historico] sync diario:', e);
    }
  };

  tick();
  setInterval(tick, SIX_HOURS);
}
