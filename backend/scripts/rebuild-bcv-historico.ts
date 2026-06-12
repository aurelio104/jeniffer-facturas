import { rebuildHistoricoBcv } from '../src/services/bcv-historico.js';

const r = await rebuildHistoricoBcv(3);
console.log('Histórico BCV reconstruido:', r);
