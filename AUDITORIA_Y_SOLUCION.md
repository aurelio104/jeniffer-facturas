# Sistema de Facturas — Versión completa

## Aplicativo local (recomendado)

Stack habitual: **React + Vite + Tailwind** (frontend) y **Express + Prisma + SQLite** (backend).

```bash
cd /Users/aureliomedina/Downloads/yennifer
npm install
npm run dev
```

- Web: http://localhost:3021
- API: http://localhost:3020
- Contraseña de acceso: `1234` (igual que hojas Excel)
- Base de datos local: `backend/prisma/dev.db`

Módulos: Panel, BD Maestra (checklist), Facturas (multi-ISLR), Pagos (parciales, anti-duplicados), Proveedores, Tasas BCV, Resumen por proveedor.

**Tasa BCV:** módulo Costos (`bcv.org.ve` + dolarapi). Histórico últimos **3 meses** desde XLS oficiales del BCV; cada día se guarda automáticamente. Reconstruir: `npm run db:bcv-rebuild`.

### Importar datos del Excel

```bash
npm run db:import
```

Lee `REGISTRO FACTURA LISTO.xlsm` y copia a SQLite: proveedores, facturas, pagos, tasas, tabla ISLR, tablas auxiliares (causado, bancos, estaciones, IVA) y checklist si existe en BD MAESTRA.

---

Archivo Excel de referencia: **`REGISTRO FACTURA LISTO.xlsm`**

## Mejoras implementadas

### Pagos
- Saldo pendiente al cargar factura (Bs / USD)
- Pagos parciales con validación (no supera saldo)
- Cruce de anticipos abiertos contra facturas
- Bloqueo de referencias duplicadas (banco + referencia + RIF)
- Columna `ANTICIPO APLICADO` en BD PAGOS

### Facturas
- Multi-ISLR guardado en `DETALLE ISLR` y restaurado al editar
- Bloqueo de RIF / proveedor / tipo al modificar
- Tasa BCV visible en Label12 al elegir fecha
- Proveedor nuevo: vuelve al formulario de factura automáticamente
- Columnas `MONEDA`, `TASA REGISTRO`, `TOTAL USD`, `DETALLE ISLR`

### BD MAESTRA (checklist)
- Upsert sin borrar toda la tabla (conserva checklist manual)
- Columnas `DIF CAMBIARIA USD`, `DIAS VENCIDA`
- Validación Si/No/Pendiente en físico y retención enviada
- Colores por estado (pendiente / parcial / pagada)

### Reportes y panel
- **MENU**: panel con saldos pendientes, sin físico, sin retención, vencidas
- **RESUMEN PROVEEDOR**: totales por RIF (neto, pagado, saldo, impuestos, dif. cambiaria)
- **AUDITORIA**: log de acciones (usuario Windows, fecha, detalle)

### Buscador
- Lista desde BD MAESTRA (neto, saldo, estado)
- Doble clic: **Sí** = modificar factura | **No** = ir a pagar

### Otros
- `RJD` corregido a `PJD` en proveedores
- Sincronización inteligente sin resetear checklist
- Log automático al guardar facturas, pagos y proveedores

## Al abrir por primera vez

1. Abrir `REGISTRO FACTURA LISTO.xlsm` y habilitar macros.
2. **Alt+F8** → ejecutar `SincronizarMaestra` (pobla BD MAESTRA y resumen).
3. El panel en MENU se actualiza al abrir y al guardar.

## Macros útiles (Alt+F8)

| Macro | Uso |
|-------|-----|
| `SincronizarMaestra` | Sincroniza BD MAESTRA completa |
| `RefrescarDashboard` | Actualiza panel MENU |
| `RefrescarResumen` | Actualiza RESUMEN PROVEEDOR |
| `MostrarFormularioFACT` | Registrar factura |
| `MostrarFormularioPROVEEDOR` | Registrar pago |
| `AbrirBuscador` | Consulta / modificar / pagar |

## Rebuild desde código

```bash
python3 scripts/integrar_mejoras.py
```
