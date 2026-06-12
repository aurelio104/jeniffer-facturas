import { prisma } from '../lib/prisma.js';

const DEFAULTS: Record<string, string[]> = {
  tipo_islr: ['PNR', 'PJD', 'PJND', 'PNNR'],
  retencion_iva: ['100%', '75%', 'EXENTA'],
  tipo_doc: ['FAC', 'REC', 'NE']
};

export async function seedDefaultCatalogs(): Promise<void> {
  for (const [categoria, valores] of Object.entries(DEFAULTS)) {
    const existing = await prisma.configItem.findMany({ where: { categoria } });
    if (existing.length > 0) continue;
    await prisma.configItem.createMany({
      data: valores.map((valor, orden) => ({ categoria, valor, orden }))
    });
  }
}
