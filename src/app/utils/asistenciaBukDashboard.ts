import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import { formatBukEntradaDisplay, hasBukEntradaMarcada } from './asistenciaData';
import { filterBukRecordsForSedeDate } from './asistenciaStaff';

export type BukDashboardRow = {
  id: number;
  nombre: string;
  apellidos: string;
  especialidad: string;
  area: string;
  rut: string;
  arrived: boolean;
  entradaHora?: string;
};

export type BukDashboardSummary = {
  total: number;
  arrived: number;
  absent: number;
  rows: BukDashboardRow[];
};

function apellidosFromRecord(r: BukAsistenciaRecord): string {
  return [r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ').trim();
}

export function buildBukDashboardSummary(input: {
  records: BukAsistenciaRecord[];
  sedeName: string;
  settings: AsistenciaSettings;
  date: Date;
}): BukDashboardSummary {
  const filtered = filterBukRecordsForSedeDate(
    input.records,
    input.sedeName,
    input.settings,
    input.date
  );

  const rows: BukDashboardRow[] = filtered
    .map((r) => {
      const arrived = hasBukEntradaMarcada(r);
      return {
        id: r.id,
        nombre: (r.nombre || '').trim(),
        apellidos: apellidosFromRecord(r),
        especialidad: (r.especialidad || r.area || '—').trim(),
        area: (r.area || '—').trim(),
        rut: (r.rut_trabajador || '—').trim(),
        arrived,
        entradaHora: arrived
          ? formatBukEntradaDisplay(r.entrada_format, r.entrada)
          : undefined,
      };
    })
    .sort((a, b) => {
      if (a.arrived !== b.arrived) return a.arrived ? -1 : 1;
      const nameA = `${a.apellidos} ${a.nombre}`.toLowerCase();
      const nameB = `${b.apellidos} ${b.nombre}`.toLowerCase();
      return nameA.localeCompare(nameB, 'es');
    });

  const arrived = rows.filter((r) => r.arrived).length;
  return {
    total: rows.length,
    arrived,
    absent: rows.length - arrived,
    rows,
  };
}
