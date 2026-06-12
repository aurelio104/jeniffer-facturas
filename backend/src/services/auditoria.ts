import { prisma } from '../lib/prisma.js';

export async function logAuditoria(accion: string, detalle?: string, usuario?: string) {
  await prisma.auditoriaLog.create({
    data: { accion, detalle, usuario: usuario ?? 'local' }
  });
}
