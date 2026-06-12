export type PeriodoExport = 'semanal' | 'mensual' | 'trimestral' | 'semestral';

export type PeriodRange = {
  periodo: PeriodoExport;
  label: string;
  desde: Date;
  hasta: Date;
};

const PERIODO_LABEL: Record<PeriodoExport, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral'
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function resolvePeriod(periodo: PeriodoExport, ref = new Date()): PeriodRange {
  const hasta = endOfDay(ref);
  let desde: Date;

  switch (periodo) {
    case 'semanal': {
      const day = ref.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      desde = startOfDay(new Date(ref));
      desde.setDate(desde.getDate() - mondayOffset);
      break;
    }
    case 'mensual':
      desde = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
      break;
    case 'trimestral': {
      const q = Math.floor(ref.getMonth() / 3);
      desde = startOfDay(new Date(ref.getFullYear(), q * 3, 1));
      break;
    }
    case 'semestral': {
      const half = ref.getMonth() < 6 ? 0 : 6;
      desde = startOfDay(new Date(ref.getFullYear(), half, 1));
      break;
    }
    default:
      desde = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
  }

  const label = `${PERIODO_LABEL[periodo]} (${fmtDate(desde)} – ${fmtDate(hasta)})`;
  return { periodo, label, desde, hasta };
}

export function isValidPeriodo(v: string): v is PeriodoExport {
  return v === 'semanal' || v === 'mensual' || v === 'trimestral' || v === 'semestral';
}
