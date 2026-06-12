import { prisma } from '../src/lib/prisma.js';

async function main() {
  const countTab = await prisma.tabIslr.count();
  if (countTab === 0) {
    await prisma.tabIslr.createMany({
      data: [
        {
          concepto: 'HONORARIOS PROFESIONALES',
          basePnr: 1,
          pnr: 0.03,
          pagosMinBs: 3583.34,
          sustraendoBs: 107.5,
          basePjd: 1,
          pjd: 0.05,
          basePjnd: 0.9,
          pjnd: 0.05,
          basePnnr: 0.9,
          pnnr: 0.34,
          orden: 1
        },
        {
          concepto: 'SERVICIOS',
          basePnr: 1,
          pnr: 0.01,
          pagosMinBs: 3583.34,
          sustraendoBs: 35.83,
          basePjd: 1,
          pjd: 0.02,
          basePjnd: 1,
          pjnd: null,
          t2Pjnd: true,
          basePnnr: 1,
          pnnr: 0.34,
          orden: 2
        },
        {
          concepto: 'COMISIONES MERCANTILES Y OTRAS',
          basePnr: 1,
          pnr: 0.03,
          pagosMinBs: 3583.34,
          sustraendoBs: 107.5,
          basePjd: 1,
          pjd: 0.05,
          basePjnd: 1,
          pjnd: 0.05,
          basePnnr: 1,
          pnnr: 0.34,
          orden: 3
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
      tipoIslr: 'PJD',
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
