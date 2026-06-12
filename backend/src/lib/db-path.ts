import path from 'path';

/** Ruta del archivo SQLite (local: prisma/dev.db, Koyeb: /data/jeniffer.db). */
export function getDbFilePath(): string {
  const dataDir = process.env.DATA_DIR?.trim();
  if (dataDir) {
    return path.join(dataDir, process.env.DB_FILE?.trim() || 'jeniffer.db');
  }
  return path.join(process.cwd(), 'prisma', 'dev.db');
}

export function getBackupDir(): string {
  const dataDir = process.env.DATA_DIR?.trim();
  if (dataDir) return path.join(dataDir, 'backups');
  return path.join(process.cwd(), 'prisma', 'backups');
}
