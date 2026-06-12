import 'dotenv/config';
import path from 'path';
import cors from 'cors';
import express from 'express';
import proveedores from './routes/proveedores.js';
import facturas from './routes/facturas.js';
import pagos from './routes/pagos.js';
import tasas from './routes/tasas.js';
import maestra from './routes/maestra.js';
import auth from './routes/auth.js';
import admin from './routes/admin.js';
import alertas from './routes/alertas.js';
import exportRoutes from './routes/export.js';
import { requireAuth } from './lib/auth-middleware.js';
import { buildCorsOptions } from './lib/cors-config.js';
import { rebuildHistoricoBcv, startBcvHistoricoScheduler, guardarTasaHoyEnHistorico } from './services/bcv-historico.js';
import { listarHistorico } from './services/tasas.js';
import { seedUsers } from './services/auth-service.js';
import { seedDefaultCatalogs } from './services/config-seed.js';
import { startAppScheduler } from './services/scheduler.js';

const app = express();
const PORT = Number(process.env.PORT) || 3020;

app.use(cors(buildCorsOptions()));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'jeniffer-facturas' });
});

app.use('/api/auth', auth);
app.use('/api', requireAuth);

app.use('/api/proveedores', proveedores);
app.use('/api/facturas', facturas);
app.use('/api/pagos', pagos);
app.use('/api/tasas', tasas);
app.use('/api/maestra', maestra);
app.use('/api/admin', admin);
app.use('/api/alertas', alertas);
app.use('/api/export', exportRoutes);

if (process.env.SERVE_FRONTEND === '1') {
  const dist = path.join(process.cwd(), '..', 'frontend', 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, async () => {
  await seedUsers();
  await seedDefaultCatalogs();
  console.log(`Jeniffer API en http://127.0.0.1:${PORT}`);
  startBcvHistoricoScheduler();
  startAppScheduler();
  listarHistorico(3)
    .then(async (rows) => {
      if (rows.length < 10) {
        const r = await rebuildHistoricoBcv(3);
        console.log(`[bcv-historico] ${r.insertados} tasas (${r.desde} → ${r.hasta})`);
      } else {
        const v = await guardarTasaHoyEnHistorico();
        console.log(`[bcv-historico] hoy: USD ${v.usd} · EUR ${v.eur} Bs`);
      }
    })
    .catch((e) => console.warn('[bcv-historico] arranque:', e));
});
