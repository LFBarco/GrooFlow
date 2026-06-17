import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import {
  formatBukEntradaDisplay,
  formatBukSalidaDisplay,
  hasBukEntradaMarcada,
  hasBukSalidaMarcadaOnDate,
} from './asistenciaData';
import { filterBukRecordsForSedeDate } from './asistenciaStaff';

export type BukDashboardRow = {
  id: number;
  nombre: string;
  apellidos: string;
  especialidad: string;
  area: string;
  rut: string;
  arrived: boolean;
  leftSameDay: boolean;
  entradaHora?: string;
  salidaHora?: string;
};

export type BukDashboardSpecialtyGroup = {
  especialidad: string;
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  rows: BukDashboardRow[];
};

export type BukDashboardAreaGroup = {
  area: string;
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  rows: BukDashboardRow[];
};

export type BukDashboardSummary = {
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  rows: BukDashboardRow[];
  specialtyGroups: BukDashboardSpecialtyGroup[];
  areaGroups: BukDashboardAreaGroup[];
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
      const leftSameDay = hasBukSalidaMarcadaOnDate(r, input.date);
      return {
        id: r.id,
        nombre: (r.nombre || '').trim(),
        apellidos: apellidosFromRecord(r),
        especialidad: (r.especialidad || r.area || '—').trim(),
        area: (r.area || '—').trim(),
        rut: (r.rut_trabajador || '—').trim(),
        arrived,
        leftSameDay,
        entradaHora: arrived
          ? formatBukEntradaDisplay(r.entrada_format, r.entrada)
          : undefined,
        salidaHora: leftSameDay
          ? formatBukSalidaDisplay(r.salida_format, r.salida)
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
  const leftSameDay = rows.filter((r) => r.leftSameDay).length;

  const bySpecialty = new Map<string, BukDashboardRow[]>();
  for (const row of rows) {
    const key = row.especialidad || '—';
    const list = bySpecialty.get(key) ?? [];
    list.push(row);
    bySpecialty.set(key, list);
  }

  const specialtyGroups: BukDashboardSpecialtyGroup[] = [...bySpecialty.entries()]
    .map(([especialidad, groupRows]) => ({
      especialidad,
      total: groupRows.length,
      arrived: groupRows.filter((r) => r.arrived).length,
      absent: groupRows.filter((r) => !r.arrived).length,
      leftSameDay: groupRows.filter((r) => r.leftSameDay).length,
      rows: groupRows,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.especialidad.localeCompare(b.especialidad, 'es');
    });

  const byArea = new Map<string, BukDashboardRow[]>();
  for (const row of rows) {
    const key = row.area || '—';
    const list = byArea.get(key) ?? [];
    list.push(row);
    byArea.set(key, list);
  }

  const areaGroups: BukDashboardAreaGroup[] = [...byArea.entries()]
    .map(([area, groupRows]) => ({
      area,
      total: groupRows.length,
      arrived: groupRows.filter((r) => r.arrived).length,
      absent: groupRows.filter((r) => !r.arrived).length,
      leftSameDay: groupRows.filter((r) => r.leftSameDay).length,
      rows: groupRows,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.area.localeCompare(b.area, 'es');
    });

  return {
    total: rows.length,
    arrived,
    absent: rows.length - arrived,
    leftSameDay,
    rows,
    specialtyGroups,
    areaGroups,
  };
}
