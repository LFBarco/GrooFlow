import type { AsistenciaSettings, BukAsistenciaRecord, BukPunctualityStatus } from '../types/asistencia';
import {
  formatBukEntradaDisplay,
  formatBukSalidaDisplay,
  hasBukEntradaMarcada,
  hasBukSalidaMarcadaOnDate,
  resolveBukEntryPunctuality,
} from './asistenciaData';
import { filterBukRecordsForSedeDate, getSedeProfile } from './asistenciaStaff';

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
  /** A tiempo / tardanza según horario sede (turno día 08:00 + tolerancia). */
  punctuality: BukPunctualityStatus;
  isDayShift: boolean;
};

export type BukDashboardSpecialtyGroup = {
  especialidad: string;
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  onTime: number;
  late: number;
  rows: BukDashboardRow[];
};

export type BukDashboardAreaGroup = {
  area: string;
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  onTime: number;
  late: number;
  rows: BukDashboardRow[];
};

export type BukDashboardSummary = {
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  onTime: number;
  late: number;
  rows: BukDashboardRow[];
  specialtyGroups: BukDashboardSpecialtyGroup[];
  areaGroups: BukDashboardAreaGroup[];
};

export type BukMultiSedeDashboard = {
  sedes: { sedeName: string; summary: BukDashboardSummary }[];
  totals: Omit<BukDashboardSummary, 'rows' | 'specialtyGroups' | 'areaGroups'>;
};

export function buildBukMultiSedeDashboard(input: {
  records: BukAsistenciaRecord[];
  sedeNames: string[];
  settings: AsistenciaSettings;
  date: Date;
}): BukMultiSedeDashboard {
  const sedes = input.sedeNames.map((sedeName) => ({
    sedeName,
    summary: buildBukDashboardSummary({
      records: input.records,
      sedeName,
      settings: input.settings,
      date: input.date,
    }),
  }));

  const totals = sedes.reduce(
    (acc, s) => ({
      total: acc.total + s.summary.total,
      arrived: acc.arrived + s.summary.arrived,
      absent: acc.absent + s.summary.absent,
      leftSameDay: acc.leftSameDay + s.summary.leftSameDay,
      onTime: acc.onTime + s.summary.onTime,
      late: acc.late + s.summary.late,
    }),
    { total: 0, arrived: 0, absent: 0, leftSameDay: 0, onTime: 0, late: 0 }
  );

  return { sedes, totals };
}

function apellidosFromRecord(r: BukAsistenciaRecord): string {
  return [r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ').trim();
}

function groupStats(rows: BukDashboardRow[]) {
  return {
    total: rows.length,
    arrived: rows.filter((r) => r.arrived).length,
    absent: rows.filter((r) => !r.arrived).length,
    leftSameDay: rows.filter((r) => r.leftSameDay).length,
    onTime: rows.filter((r) => r.punctuality === 'on_time').length,
    late: rows.filter((r) => r.punctuality === 'late').length,
  };
}

export function buildBukDashboardSummary(input: {
  records: BukAsistenciaRecord[];
  sedeName: string;
  settings: AsistenciaSettings;
  date: Date;
}): BukDashboardSummary {
  const profile = getSedeProfile(input.settings, input.sedeName);
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
      const isDayShift = r.turno_noche !== true;
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
        punctuality: resolveBukEntryPunctuality(r, profile),
        isDayShift,
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
  const onTime = rows.filter((r) => r.punctuality === 'on_time').length;
  const late = rows.filter((r) => r.punctuality === 'late').length;

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
      ...groupStats(groupRows),
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
      ...groupStats(groupRows),
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
    onTime,
    late,
    rows,
    specialtyGroups,
    areaGroups,
  };
}
