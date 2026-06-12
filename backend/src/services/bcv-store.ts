/** Config BCV — misma lógica que Costos (apps/api/src/bcv-store.ts), sin archivo local. */

export type BcvConfigModo = 'auto' | 'manual';
export type BcvFuentePreferida = 'bcv_oficial' | 'dolarapi';

export type BcvConfig = {
  modo: BcvConfigModo;
  fuentePreferida: BcvFuentePreferida;
  overrideUsd: number | null;
  overrideEur: number | null;
  fechaValor: string | null;
  notas?: string;
};

const DEFAULT: BcvConfig = {
  modo: 'auto',
  fuentePreferida: 'bcv_oficial',
  overrideUsd: null,
  overrideEur: null,
  fechaValor: null,
  notas: 'Automático: bcv.org.ve con respaldo dolarapi (módulo Costos).'
};

export function getBcvConfig(): BcvConfig {
  return { ...DEFAULT };
}

export function ensureBcvAutomatic(): BcvConfig {
  return getBcvConfig();
}
