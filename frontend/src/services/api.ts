import axios from 'axios';
import { getSession, getToken, clearSession } from '../lib/auth';

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

const api = axios.create({ baseURL: apiBase });

api.interceptors.request.use((config) => {
  const user = getSession();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (user) config.headers['x-usuario'] = user.username;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export type Proveedor = {
  id: string;
  rif: string;
  nombre: string;
  tipoIslr: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  numCuenta?: string;
  banco?: string;
  titular?: string;
  idTitular?: string;
  retencionIva: string;
  estacion?: string;
  referido?: string;
  servicio?: string;
  notas?: string;
};

export type Factura = {
  id: string;
  tipo: string;
  numero: string;
  rif: string;
  proveedorNombre: string;
  fecha: string;
  estacion?: string;
  causado?: string;
  concepto?: string;
  diasCredito: number;
  moneda: string;
  tasaRegistro?: number;
  totalBs: number;
  totalUsd?: number;
  exentoBs: number;
  baseIslr: number;
  retencionIslr: number;
  grabadoBs: number;
  baseImponible: number;
  iva16: number;
  retencionIva: number;
  montoAPagar: number;
  montoAPagarUsd?: number;
  recibidoFisico: string;
  retencionEnviada: string;
  detalleIslr?: string;
};

export type FacturaPreview = Factura & { descripcionIslr?: string };

export type Pago = {
  id: string;
  fecha: string;
  rif: string;
  proveedor: string;
  documento: string;
  banco: string;
  referencia: string;
  pagadoBs?: number;
  pagadoUsd?: number;
  tasa?: number;
  observacion?: string;
  estadoAnticipo?: string;
  anticipoAplicado?: number;
  facturaId?: string;
};

export type SaldoFactura = {
  facturaId: string;
  documento: string;
  montoAPagar: number;
  montoAPagarUsd?: number;
  pagadoBs: number;
  pagadoUsd?: number;
  saldoBs: number;
  saldoUsd?: number;
};

export type MaestraRow = {
  id: string;
  tipo: string;
  numero: string;
  rif: string;
  proveedor: string;
  fecha: string;
  moneda: string;
  tasaRegistro: number | null;
  totalBs: number;
  totalUsd: number | null;
  netoBs: number;
  netoUsd: number | null;
  iva16: number;
  retIva: number;
  retIslr: number;
  montoAPagar: number;
  montoAPagarUsd: number | null;
  pagadoBs: number;
  pagadoUsd: number | null;
  saldoBs: number;
  saldoUsd: number | null;
  difCambiariaUsd: number | null;
  diasVencida: number;
  vencida: boolean;
  recibidoFisico: string;
  retencionEnviada: string;
  registrado: string;
  pagado: string;
  parcial: string;
  estado: string;
};

export type DashboardStats = {
  totalFacturas: number;
  pendientes: number;
  parciales: number;
  pagadas: number;
  saldoTotal: number;
  sinFisico: number;
  sinRetencion: number;
  vencidas: number;
  topSaldos: Array<{ id: string; proveedor: string; documento: string; saldoBs: number }>;
};

export type TabIslr = {
  id: string;
  concepto: string;
  basePnr?: number;
  pnr?: number;
  pagosMinBs?: number;
  sustraendoBs?: number;
  basePjd?: number;
  pjd?: number;
  basePjnd?: number;
  pjnd?: number;
  basePnnr?: number;
  pnnr?: number;
  orden?: number;
};

export type ConfigItem = { id: string; categoria: string; valor: string; extra?: string | null; orden?: number };

export type AuthUser = { id: string; username: string; nombre: string; rol: string };

export type ResumenProveedor = {
  proveedor?: Proveedor;
  maestra: MaestraRow[];
  totales: {
    facturado: number;
    neto: number;
    iva: number;
    retIva: number;
    retIslr: number;
    pagado: number;
    saldo: number;
    difCambiariaUsd: number;
  };
};

export type Alerta = {
  id: string;
  tipo: string;
  prioridad: number;
  titulo: string;
  detalle?: string;
  facturaId?: string;
  rif?: string;
  proveedor?: string;
  documento?: string;
  saldoBs?: number;
  diasVencida?: number;
  leida: boolean;
  descartada: boolean;
  createdAt: string;
};

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ ok: true; user: AuthUser; token: string }>('/auth/login', { username, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get<{ user: AuthUser }>('/auth/me').then((r) => r.data)
};

export const alertasApi = {
  list: () => api.get<Alerta[]>('/alertas').then((r) => r.data),
  count: () => api.get<{ count: number }>('/alertas/count').then((r) => r.data),
  regenerar: () => api.post<{ ok: true; evaluadas: number }>('/alertas/regenerar').then((r) => r.data),
  leerTodas: () => api.post('/alertas/leer-todas').then((r) => r.data),
  leer: (id: string) => api.post(`/alertas/${id}/leer`).then((r) => r.data),
  descartar: (id: string) => api.post(`/alertas/${id}/descartar`).then((r) => r.data)
};

export const proveedoresApi = {
  list: () => api.get<Proveedor[]>('/proveedores').then((r) => r.data),
  get: (rif: string) => api.get<Proveedor>(`/proveedores/${rif}`).then((r) => r.data),
  create: (data: Partial<Proveedor>) => api.post<Proveedor>('/proveedores', data).then((r) => r.data),
  update: (rif: string, data: Partial<Proveedor>) =>
    api.put<Proveedor>(`/proveedores/${rif}`, data).then((r) => r.data),
  delete: (rif: string) => api.delete(`/proveedores/${rif}`)
};

export const facturasApi = {
  list: (rif?: string) =>
    api.get<Factura[]>('/facturas', { params: rif ? { rif } : {} }).then((r) => r.data),
  buscar: (q: string) => api.get<Factura[]>(`/facturas/buscar/${q}`).then((r) => r.data),
  get: (id: string) => api.get<Factura>(`/facturas/${id}`).then((r) => r.data),
  preview: (data: Record<string, unknown>) =>
    api.post<FacturaPreview>('/facturas/preview', data).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Factura>('/facturas', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Factura>(`/facturas/${id}`, data).then((r) => r.data),
  checklist: (id: string, data: { recibidoFisico?: string; retencionEnviada?: string }) =>
    api.patch<Factura>(`/facturas/${id}/checklist`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/facturas/${id}`),
  suggest: (rif: string) =>
    api.get<{
      proveedor?: Proveedor;
      ultimaFactura?: {
        tipo: string;
        estacion?: string;
        causado?: string;
        diasCredito: number;
        moneda: string;
        conceptosIslr: { concepto: string; monto: number }[];
      };
    }>(`/facturas/suggest/${rif}`).then((r) => r.data),
  checkDuplicada: (tipo: string, numero: string, rif: string) =>
    api.get<{ duplicada: boolean; id?: string }>('/facturas/check-duplicada', {
      params: { tipo, numero, rif }
    }).then((r) => r.data)
};

export const pagosApi = {
  list: (rif?: string) =>
    api.get<Pago[]>('/pagos', { params: rif ? { rif } : {} }).then((r) => r.data),
  anticipos: (rif?: string) =>
    api.get<Pago[]>('/pagos/anticipos', { params: rif ? { rif } : {} }).then((r) => r.data),
  saldo: (facturaId: string) => api.get<SaldoFactura>(`/pagos/saldo/${facturaId}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Pago>('/pagos', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Pago>(`/pagos/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/pagos/${id}`),
  suggest: (rif: string) =>
    api.get<{
      proveedor?: Proveedor;
      banco: string;
      anticiposAbiertos: number;
      facturasPendientes: number;
    }>(`/pagos/suggest/${rif}`).then((r) => r.data)
};

export type TasasDia = {
  usd: { tasa: number; nombre: string; fecha: string | null };
  eur: { tasa: number; nombre: string; fecha: string | null };
  paralelo: { tasa: number; nombre: string; fecha: string | null } | null;
  fetchedAt: string;
  meta?: { fuenteActiva: string; fechaValor: string | null };
};

export const tasasApi = {
  list: (meses = 3) =>
    api.get<{ id: string; fecha: string; valor: number; valorEur?: number | null }[]>('/tasas', {
      params: { meses }
    }).then((r) => r.data),
  hoy: () =>
    api.get<{
      fecha: string;
      valor: number;
      valorEur?: number;
      fechaValor?: string | null;
      nombre?: string;
      nombreEur?: string;
      fuente?: string;
    }>('/tasas/hoy').then((r) => r.data),
  bcv: () => api.get<{ ok: true; tasas: TasasDia }>('/tasas/bcv').then((r) => r.data),
  refreshBcv: () =>
    api.post<{ ok: true; tasas: TasasDia }>('/tasas/bcv/refresh').then((r) => r.data),
  rebuildHistorico: () =>
    api.post<{
      ok: true;
      eliminados: number;
      insertados: number;
      desde: string;
      hasta: string;
    }>('/tasas/bcv/rebuild-historico').then((r) => r.data),
  create: (fecha: string, valor: number, valorEur?: number) =>
    api.post('/tasas', { fecha, valor, valorEur }).then((r) => r.data),
  update: (id: string, valor: number, valorEur?: number | null) =>
    api.put(`/tasas/${id}`, { valor, valorEur }).then((r) => r.data),
  delete: (id: string) => api.delete(`/tasas/${id}`),
  porFecha: (fecha: string) =>
    api.get<{ fecha: string; valor: number }>(`/tasas/dia/${fecha}`).then((r) => r.data)
};

export const maestraApi = {
  list: (rif?: string) =>
    api.get<MaestraRow[]>('/maestra', { params: rif ? { rif } : {} }).then((r) => r.data),
  buscar: (q: string) => api.get<MaestraRow[]>('/maestra/buscar', { params: { q } }).then((r) => r.data),
  dashboard: () => api.get<DashboardStats>('/maestra/dashboard').then((r) => r.data),
  resumen: (rif: string) => api.get<ResumenProveedor>(`/maestra/resumen/${rif}`).then((r) => r.data),
  exportResumen: (rif: string) =>
    api.get(`/maestra/resumen/${rif}/export`, { responseType: 'blob' }).then((r) => r.data),
  tabIslr: () => api.get<TabIslr[]>('/maestra/tab-islr').then((r) => r.data),
  config: (categoria?: string) =>
    api.get<ConfigItem[]>('/maestra/config', { params: categoria ? { categoria } : {} }).then((r) => r.data),
  auditoria: () =>
    api.get<{ id: string; fecha: string; usuario?: string; accion: string; detalle?: string }[]>(
      '/maestra/auditoria'
    ).then((r) => r.data)
};

export type ExportInfo = {
  meta: {
    label: string;
    periodo: string;
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
};

export const exportApi = {
  info: (periodo: string, rif?: string) =>
    api.get<ExportInfo>('/export/info', { params: { periodo, rif } }).then((r) => r.data),
  excel: (periodo: string, rif?: string) =>
    api.get('/export/excel', { params: { periodo, rif }, responseType: 'blob' }).then((r) => r.data),
  pdf: (periodo: string, rif?: string) =>
    api.get('/export/pdf', { params: { periodo, rif }, responseType: 'blob' }).then((r) => r.data)
};

export const adminApi = {
  backup: () => api.get('/admin/backup', { responseType: 'blob' }).then((r) => r.data),
  config: (categoria?: string) =>
    api.get<ConfigItem[]>('/admin/config', { params: categoria ? { categoria } : {} }).then((r) => r.data),
  createConfig: (data: { categoria: string; valor: string; extra?: string | null; orden?: number }) =>
    api.post<ConfigItem>('/admin/config', data).then((r) => r.data),
  updateConfig: (id: string, data: Partial<{ categoria: string; valor: string; extra: string | null; orden: number }>) =>
    api.put<ConfigItem>(`/admin/config/${id}`, data).then((r) => r.data),
  deleteConfig: (id: string) => api.delete(`/admin/config/${id}`),
  users: () => api.get<AuthUser[]>('/admin/users').then((r) => r.data),
  createUser: (data: { username: string; nombre: string; password: string; rol: string }) =>
    api.post<AuthUser>('/admin/users', data).then((r) => r.data),
  updateUser: (id: string, data: { nombre?: string; password?: string; rol?: string }) =>
    api.put<AuthUser>(`/admin/users/${id}`, data).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  tabIslr: () => api.get<TabIslr[]>('/admin/tab-islr').then((r) => r.data),
  createTabIslr: (data: Partial<TabIslr>) =>
    api.post<TabIslr>('/admin/tab-islr', data).then((r) => r.data),
  updateTabIslr: (id: string, data: Partial<TabIslr>) =>
    api.put<TabIslr>(`/admin/tab-islr/${id}`, data).then((r) => r.data),
  deleteTabIslr: (id: string) => api.delete(`/admin/tab-islr/${id}`)
};

export function fmtBs(n: number) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default api;
