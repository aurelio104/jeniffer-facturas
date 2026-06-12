import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { getBackupDir, getDbFilePath } from '../lib/db-path.js';
import { logAuditoria } from './auditoria.js';

function sqliteHeaderOk(buf: Buffer): boolean {
  return buf.length >= 16 && buf.subarray(0, 15).toString() === 'SQLite format 3';
}

export async function restoreDatabaseFromBuffer(buf: Buffer, usuario: string) {
  if (!sqliteHeaderOk(buf)) {
    throw new Error('El archivo no parece un SQLite válido (.db)');
  }

  const dbPath = getDbFilePath();
  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, path.join(backupDir, `pre-restore-${stamp}.db`));
  }

  const tmpPath = `${dbPath}.upload-${stamp}`;
  fs.writeFileSync(tmpPath, buf);

  await logAuditoria('BD_RESTAURADA', `${buf.length} bytes`, usuario);
  await prisma.$disconnect();

  fs.renameSync(tmpPath, dbPath);

  return {
    ok: true,
    bytes: buf.length,
    path: dbPath,
    message: 'Base restaurada. El servicio se reiniciará en unos segundos.'
  };
}
