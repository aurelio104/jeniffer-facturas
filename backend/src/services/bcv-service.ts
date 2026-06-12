/**
 * Servicio BCV — copiado de Costos (apps/api/src/bcv-service.ts).
 * Fuente: bcv.org.ve oficial, respaldo ve.dolarapi.com.
 */
import https from 'https';
import { ensureBcvAutomatic, getBcvConfig, type BcvConfig, type BcvFuentePreferida } from './bcv-store.js';

const BCV_URL = 'https://www.bcv.org.ve/';
const USD_URL = 'https://ve.dolarapi.com/v1/dolares';
const EUR_URL = 'https://ve.dolarapi.com/v1/euros';
const TIMEOUT_MS = 8000;

type RateRow = {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
};

export type BcvFuenteActiva = 'bcv_oficial' | 'dolarapi' | 'manual' | 'costos_api';

export type TasasDia = {
  usd: { tasa: number; nombre: string; fecha: string | null };
  eur: { tasa: number; nombre: string; fecha: string | null };
  paralelo: { tasa: number; nombre: string; fecha: string | null } | null;
  fetchedAt: string;
  meta: TasasMeta;
};

export type TasasFuenteSnapshot = {
  usd: number;
  eur: number;
  fecha: string | null;
  error?: string;
};

export type TasasMeta = {
  fuenteActiva: BcvFuenteActiva;
  fechaValor: string | null;
  bcvOficial: TasasFuenteSnapshot | null;
  dolarapi: TasasFuenteSnapshot | null;
  diffUsd: number | null;
  diffEur: number | null;
  modo: BcvConfig['modo'];
  fuentePreferida: BcvFuentePreferida;
};

export type BcvStatus = {
  config: BcvConfig;
  tasas: TasasDia;
};

let cache: { data: TasasDia; at: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function fetchBcvHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      BCV_URL,
      { rejectUnauthorized: false, timeout: TIMEOUT_MS },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`BCV HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('BCV timeout'));
    });
  });
}

function parseVeRate(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Tasa inválida: ${raw}`);
  return n;
}

function parseBcvHtml(html: string): { usd: number; eur: number; fechaValor: string | null } {
  const usdMatch = html.match(/>\s*USD\s*<\/span>[\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i);
  const eurMatch = html.match(/>\s*EUR\s*<\/span>[\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i);
  const fechaMatch =
    html.match(/property="dc:date"[^>]*content="([^"]+)"/i) ??
    html.match(/date-display-single[^>]*content="([^"]+)"/i);

  if (!usdMatch?.[1]) throw new Error('No se encontró USD en BCV');
  if (!eurMatch?.[1]) throw new Error('No se encontró EUR en BCV');

  return {
    usd: parseVeRate(usdMatch[1]),
    eur: parseVeRate(eurMatch[1]),
    fechaValor: fechaMatch?.[1] ?? null
  };
}

function pickUsd(rows: RateRow[], fuente: string): RateRow | undefined {
  return rows.find((r) => r.fuente?.toLowerCase() === fuente.toLowerCase());
}

async function fetchBcvOficial(): Promise<TasasFuenteSnapshot> {
  try {
    const html = await fetchBcvHtml();
    const parsed = parseBcvHtml(html);
    return { usd: parsed.usd, eur: parsed.eur, fecha: parsed.fechaValor };
  } catch (e) {
    return {
      usd: 0,
      eur: 0,
      fecha: null,
      error: e instanceof Error ? e.message : 'Error BCV oficial'
    };
  }
}

async function fetchDolarapi(): Promise<TasasFuenteSnapshot> {
  try {
    const [usdRows, eurRows] = await Promise.all([
      fetchJson<RateRow[]>(USD_URL),
      fetchJson<RateRow[]>(EUR_URL)
    ]);
    const oficial = pickUsd(usdRows, 'oficial');
    const eur = eurRows.find((r) => r.fuente?.toLowerCase() === 'oficial') ?? eurRows[0];
    if (!oficial?.promedio) throw new Error('dolarapi sin USD oficial');
    return {
      usd: oficial.promedio,
      eur: eur?.promedio ?? 0,
      fecha: oficial.fechaActualizacion ?? null
    };
  } catch (e) {
    return {
      usd: 0,
      eur: 0,
      fecha: null,
      error: e instanceof Error ? e.message : 'Error dolarapi'
    };
  }
}

function roundDiff(a: number, b: number): number | null {
  if (!a || !b) return null;
  return Math.round((a - b) * 10000) / 10000;
}

function pickAutoRates(
  cfg: BcvConfig,
  bcv: TasasFuenteSnapshot,
  dolar: TasasFuenteSnapshot,
  paralelo: RateRow | undefined,
  fetchedAt: string,
  fuenteActivaOverride?: BcvFuenteActiva
): TasasDia {
  const order: BcvFuentePreferida[] =
    cfg.fuentePreferida === 'bcv_oficial' ? ['bcv_oficial', 'dolarapi'] : ['dolarapi', 'bcv_oficial'];

  let fuenteActiva: BcvFuenteActiva = fuenteActivaOverride ?? 'dolarapi';
  let usd = 0;
  let eur = 0;
  let fecha: string | null = null;
  let nombreUsd = 'USD BCV';
  let nombreEur = 'EUR BCV';

  if (!fuenteActivaOverride) {
    for (const src of order) {
      const snap = src === 'bcv_oficial' ? bcv : dolar;
      if (snap.usd > 0) {
        fuenteActiva = src;
        usd = snap.usd;
        eur = snap.eur;
        fecha = snap.fecha;
        nombreUsd = src === 'bcv_oficial' ? 'USD BCV oficial' : 'USD BCV (dolarapi)';
        nombreEur = src === 'bcv_oficial' ? 'EUR BCV oficial' : 'EUR BCV (dolarapi)';
        break;
      }
    }
  } else {
    usd = bcv.usd;
    eur = bcv.eur;
    fecha = bcv.fecha;
    nombreUsd = 'USD BCV (Costos API)';
    nombreEur = 'EUR BCV (Costos API)';
  }

  if (!usd) throw new Error('No se pudo obtener tasa USD BCV');

  return {
    usd: { tasa: usd, nombre: nombreUsd, fecha },
    eur: { tasa: eur, nombre: nombreEur, fecha },
    paralelo: paralelo
      ? {
          tasa: paralelo.promedio,
          nombre: paralelo.nombre,
          fecha: paralelo.fechaActualizacion ?? null
        }
      : null,
    fetchedAt,
    meta: {
      fuenteActiva,
      fechaValor: bcv.fecha ?? fecha,
      bcvOficial: bcv.usd > 0 && fuenteActiva !== 'costos_api' ? bcv : null,
      dolarapi: dolar.usd > 0 ? dolar : null,
      diffUsd: roundDiff(bcv.usd, dolar.usd),
      diffEur: roundDiff(bcv.eur, dolar.eur),
      modo: cfg.modo,
      fuentePreferida: cfg.fuentePreferida
    }
  };
}

let costosToken: { token: string; at: number } | null = null;
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

async function fetchFromCostosApi(): Promise<TasasDia | null> {
  const base = process.env.COSTOS_API_URL?.trim().replace(/\/$/, '');
  if (!base) return null;

  const email = process.env.COSTOS_API_EMAIL?.trim();
  const password = process.env.COSTOS_API_PASSWORD ?? '';
  const staticToken = process.env.COSTOS_API_TOKEN?.trim();

  let token = staticToken;
  if (!token && email && password) {
    if (costosToken && Date.now() - costosToken.at < TOKEN_TTL_MS) {
      token = costosToken.token;
    } else {
      try {
        const loginRes = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) return null;
        const loginJson = (await loginRes.json()) as { token?: string };
        if (!loginJson.token) return null;
        token = loginJson.token;
        costosToken = { token, at: Date.now() };
      } catch {
        return null;
      }
    }
  }

  if (!token) return null;

  try {
    const res = await fetch(`${base}/api/bcv/tasas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; tasas?: TasasDia };
    if (!json.tasas?.usd?.tasa) return null;
    const tasas = json.tasas;
    tasas.meta = {
      ...tasas.meta,
      fuenteActiva: 'costos_api',
      modo: 'auto',
      fuentePreferida: 'bcv_oficial'
    };
    return tasas;
  } catch {
    return null;
  }
}

export function invalidateBcvCache(): void {
  cache = null;
}

export async function obtenerTasasDia(force = false): Promise<TasasDia> {
  ensureBcvAutomatic();
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const fetchedAt = new Date().toISOString();

  const fromCostos = await fetchFromCostosApi();
  if (fromCostos) {
    cache = { data: fromCostos, at: Date.now() };
    return fromCostos;
  }

  const cfg = getBcvConfig();
  const [bcv, dolar, usdRows] = await Promise.all([
    fetchBcvOficial(),
    fetchDolarapi(),
    fetchJson<RateRow[]>(USD_URL).catch(() => [] as RateRow[])
  ]);
  const paralelo = pickUsd(usdRows, 'paralelo');

  const data = pickAutoRates(cfg, bcv, dolar, paralelo, fetchedAt);
  cache = { data, at: Date.now() };
  return data;
}

export async function obtenerBcvStatus(force = false): Promise<BcvStatus> {
  const config = getBcvConfig();
  const tasas = await obtenerTasasDia(force);
  return { config, tasas };
}

export function convertirABs(usd: number, tasaUsd: number): number {
  return Math.round(usd * tasaUsd * 100) / 100;
}
