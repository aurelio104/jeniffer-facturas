import { Router } from 'express';
import {
  listarAlertas,
  contarAlertasNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  descartarAlerta,
  regenerarAlertas
} from '../services/alertas-service.js';

const router = Router();

router.get('/', async (req, res) => {
  const todas = req.query.todas === '1';
  res.json(await listarAlertas(!todas));
});

router.get('/count', async (_req, res) => {
  res.json({ count: await contarAlertasNoLeidas() });
});

router.post('/regenerar', async (_req, res) => {
  const n = await regenerarAlertas();
  res.json({ ok: true, evaluadas: n });
});

router.post('/leer-todas', async (_req, res) => {
  await marcarTodasLeidas();
  res.json({ ok: true });
});

router.post('/:id/leer', async (req, res) => {
  res.json(await marcarLeida(req.params.id));
});

router.post('/:id/descartar', async (req, res) => {
  res.json(await descartarAlerta(req.params.id));
});

export default router;
