export type CatalogTab = {
  id: string;
  label: string;
  extraLabel?: string;
};

export const CATALOG_TABS: CatalogTab[] = [
  { id: 'banco', label: 'Bancos', extraLabel: 'Código' },
  { id: 'causado', label: 'Causados' },
  { id: 'estacion', label: 'Estaciones' },
  { id: 'iva', label: 'IVA' },
  { id: 'tipo_islr', label: 'Tipos ISLR' },
  { id: 'retencion_iva', label: 'Retención IVA' },
  { id: 'tipo_doc', label: 'Tipos de documento' }
];
