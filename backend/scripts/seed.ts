import { prisma } from '../src/lib/prisma.js';

async function main() {
  const countTab = await prisma.tabIslr.count();
  if (countTab === 0) {
    await prisma.tabIslr.createMany({
      data: [
        {
          concepto: 'Honorarios profesionales',
          basePnr: 100, pnr: 3, pagosMinBs: 1000, sustraendoBs: 0,
          basePjd: 100, pjd: 2, basePjnd: 100, pjnd: 1, basePnnr: 100, pnnr: 0, orden: 1
        },
        {
          concepto: 'Servicios',
          basePnr: 100, pnr: 2, pagosMinBs: 1000, sustraendoBs: 0,
          basePjd: 100, pjd: 1, basePjnd: 100, pjnd: 0.5, basePnnr: 100, pnnr: 0, orden: 2
        },
        {
          concepto: 'Arrendamiento',
          basePnr: 100, pnr: 1, pagosMinBs: 1000, sustraendoBs: 0,
          basePjd: 100, pjd: 0.5, basePjnd: 100, pjnd: 0, basePnnr: 100, pnnr: 0, orden: 3
        }
      ]
    });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  await prisma.tasa.upsert({
    where: { fecha: hoy },
    create: { fecha: hoy, valor: 36.5 },
    update: {}
  });

  const rif = 'J-12345678-9';
  await prisma.proveedor.upsert({
    where: { rif },
    create: {
      rif,
      nombre: 'Proveedor Demo',
      tipoIslr: 'PNR',
      retencionIva: '100%',
      banco: 'Banesco',
      email: 'demo@proveedor.com'
    },
    update: {}
  });

  console.log('Seed completado.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
