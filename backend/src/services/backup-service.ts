import fs from 'fs';
import path from 'path';
import { getBackupDir, getDbFilePath } from '../lib/db-path.js';

const MAX_BACKUPS = 7;

export function runBackupDb(): string | null {
  const dbPath = getDbFilePath();
  if (!fs.existsSync(dbPath)) return null;

  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(backupDir, `jeniffer-${stamp}.db`);

  if (!fs.existsSync(dest)) {
    fs.copyFileSync(dbPath, dest);
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  for (const old of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupDir, old.f));
  }

  return dest;
}
