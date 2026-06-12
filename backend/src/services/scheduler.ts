import { regenerarAlertas } from './alertas-service.js';
import { runBackupDb } from './backup-service.js';

const ALERTA_MS = 24 * 60 * 60 * 1000;
const BACKUP_MS = 24 * 60 * 60 * 1000;

function msUntilHour(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function tickAlertas() {
  try {
    const n = await regenerarAlertas();
    console.log(`[scheduler] alertas regeneradas: ${n} evaluadas`);
  } catch (e) {
    console.warn('[scheduler] alertas:', e);
  }
}

async function tickBackup() {
  try {
    const p = runBackupDb();
    if (p) console.log(`[scheduler] backup: ${p}`);
  } catch (e) {
    console.warn('[scheduler] backup:', e);
  }
}

export function startAppScheduler() {
  tickAlertas();
  tickBackup();

  setInterval(tickAlertas, ALERTA_MS);
  setTimeout(() => {
    tickAlertas();
    setInterval(tickAlertas, ALERTA_MS);
  }, msUntilHour(8));

  setTimeout(() => {
    tickBackup();
    setInterval(tickBackup, BACKUP_MS);
  }, msUntilHour(2));
}

/** Tras cambios operativos (factura/pago). */
export function refreshAlertasDebounced() {
  void tickAlertas();
}
