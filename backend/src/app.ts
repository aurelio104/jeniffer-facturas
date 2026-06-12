import express from 'express';
import cors from 'cors';
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
import { seedUsers } from './services/auth-service.js';
import { seedDefaultCatalogs } from './services/config-seed.js';

export const app = express();

let booted = false;

export async function bootstrapApp() {
  if (booted) return;
  await seedUsers();
  await seedDefaultCatalogs();
  booted = true;
}

app.use(cors(buildCorsOptions()));
app.use(express.json());

app.use(async (_req, _res, next) => {
  try {
    await bootstrapApp();
    next();
  } catch (err) {
    next(err);
  }
});

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

export default app;
