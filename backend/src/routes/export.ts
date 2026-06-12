import { Router } from 'express';
import { z } from 'zod';
import { isValidPeriodo } from '../services/export-period.js';
import {
  gatherExportData,
  buildExcelExport,
  buildPdfExport,
  exportFilename
} from '../services/export-service.js';
import { logAuditoria } from '../services/auditoria.js';
import { getRequestUser } from '../lib/request-user.js';

const router = Router();

const querySchema = z.object({
  periodo: z.string().default('mensual'),
  rif: z.string().optional()
});

router.get('/info', async (req, res) => {
  const { periodo, rif } = querySchema.parse(req.query);
  if (!isValidPeriodo(periodo)) {
    return res.status(400).json({ error: 'Período inválido. Use: semanal, mensual, trimestral, semestral' });
  }
  const data = await gatherExportData(periodo, rif || undefined);
  res.json({
    meta: data.meta,
    resumen: data.resumen
  });
});

router.get('/excel', async (req, res) => {
  const { periodo, rif } = querySchema.parse(req.query);
  if (!isValidPeriodo(periodo)) {
    return res.status(400).json({ error: 'Período inválido' });
  }
  const data = await gatherExportData(periodo, rif || undefined);
  const buffer = buildExcelExport(data);
  const filename = exportFilename(periodo, 'xlsx');
  await logAuditoria('EXPORT_EXCEL', `${periodo} ${data.meta.desde}–${data.meta.hasta}`, getRequestUser(req));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

router.get('/pdf', async (req, res) => {
  const { periodo, rif } = querySchema.parse(req.query);
  if (!isValidPeriodo(periodo)) {
    return res.status(400).json({ error: 'Período inválido' });
  }
  const data = await gatherExportData(periodo, rif || undefined);
  const buffer = await buildPdfExport(data);
  const filename = exportFilename(periodo, 'pdf');
  await logAuditoria('EXPORT_PDF', `${periodo} ${data.meta.desde}–${data.meta.hasta}`, getRequestUser(req));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

export default router;
