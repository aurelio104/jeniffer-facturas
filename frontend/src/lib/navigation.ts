export function pagosUrl(params?: { facturaId?: string; rif?: string }) {
  const q = new URLSearchParams();
  if (params?.facturaId) q.set('facturaId', params.facturaId);
  if (params?.rif) q.set('rif', params.rif);
  const s = q.toString();
  return s ? `/pagos?${s}` : '/pagos';
}

export function facturaNuevaUrl(rif?: string) {
  if (!rif) return '/facturas/nueva';
  return `/facturas/nueva?rif=${encodeURIComponent(rif)}`;
}

export function proveedoresUrl(returnTo?: string) {
  if (!returnTo) return '/proveedores';
  return `/proveedores?returnTo=${encodeURIComponent(returnTo)}`;
}
