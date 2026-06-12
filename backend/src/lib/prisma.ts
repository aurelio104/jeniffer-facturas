import 'dotenv/config';
import path from 'path';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../generated/prisma/client.js';

const dataDir = process.env.DATA_DIR?.trim();
const sqlitePath = dataDir
  ? path.join(dataDir, process.env.DB_FILE?.trim() || 'jeniffer.db')
  : path.join(process.cwd(), 'prisma', 'dev.db');
const dbUrl = process.env.DATABASE_URL || `file:${sqlitePath}`;
const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.LIBSQL_AUTH_TOKEN || undefined
});

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL || process.env.KOYEB_APP_NAME) {
  globalForPrisma.prisma = prisma;
}
