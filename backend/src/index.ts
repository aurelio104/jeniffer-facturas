import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { app, bootstrapApp } from './app.js';
import {
  rebuildHistoricoBcv,
  startBcvHistoricoScheduler,
  guardarTasaHoyEnHistorico
} from './services/bcv-historico.js';
import { listarHistorico } from './services/tasas.js';
import { startAppScheduler } from './services/scheduler.js';

const PORT = Number(process.env.PORT) || 3020;

if (process.env.SERVE_FRONTEND === '1') {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

async function startLocalServer() {
  await bootstrapApp();
  app.listen(PORT, () => {
    console.log(`Jeniffer API en http://127.0.0.1:${PORT}`);
  });

  if (!process.env.VERCEL) {
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
  }
}

startLocalServer().catch((e) => {
  console.error('Error al iniciar API:', e);
  process.exit(1);
});
