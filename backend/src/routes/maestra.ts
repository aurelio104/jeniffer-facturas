import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  construirMaestra,
  resumenProveedor,
  dashboardStats,
  buscarGlobal
} from '../services/maestra.js';

const router = Router();

router.get('/', async (req, res) => {
  const rif = req.query.rif as string | undefined;
  res.json(await construirMaestra(rif));
});

router.get('/buscar', async (req, res) => {
  const q = (req.query.q as string) ?? '';
  res.json(await buscarGlobal(q));
});

router.get('/dashboard', async (_req, res) => {
  res.json(await dashboardStats());
});

router.get('/resumen/:rif', async (req, res) => {
  res.json(await resumenProveedor(req.params.rif));
});

router.get('/resumen/:rif/export', async (req, res) => {
  const data = await resumenProveedor(req.params.rif);
  const lines = [
    'RIF,Proveedor,Documento,Saldo Bs,Estado,IVA,Ret IVA,Ret ISLR,Dif USD',
    ...data.maestra.map((r) =>
      [
        r.rif,
        `"${r.proveedor.replace(/"/g, '')}"`,
        `${r.tipo}-${r.numero}`,
        r.saldoBs,
        r.estado,
        r.iva16,
        r.retIva,
        r.retIslr,
        r.difCambiariaUsd ?? ''
      ].join(',')
    )
  ];
  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="resumen-${req.params.rif}.csv"`);
  res.send(csv);
});

router.get('/auditoria', async (_req, res) => {
  const logs = await prisma.auditoriaLog.findMany({
    orderBy: { fecha: 'desc' },
    take: 500
  });
  res.json(logs);
});

router.get('/tab-islr', async (_req, res) => {
  res.json(await prisma.tabIslr.findMany({ orderBy: { orden: 'asc' } }));
});

router.get('/config', async (req, res) => {
  const categoria = req.query.categoria as string | undefined;
  const items = await prisma.configItem.findMany({
    where: categoria ? { categoria } : undefined,
    orderBy: [{ categoria: 'asc' }, { orden: 'asc' }]
  });
  res.json(items);
});

export default router;
