import * as XLSX from 'xlsx';

import type {
  AsistenciaDailySnapshot,
  AsistenciaStaffLiveState,
  BukAsistenciaRecord,
} from '../types/asistencia';
import { ASISTENCIA_LIVE_STATUS_LABELS } from '../types/asistencia';
import type { BukDashboardRow } from './asistenciaBukDashboard';
import {
  formatBukEntradaDisplay,
  formatBukSalidaDisplay,
  formatDayKey,
} from './asistenciaData';

export function exportAsistenciaBukExcel(
  rows: BukDashboardRow[],
  sedeName: string,
  dateYmd: string
): void {
  const headers = [
    'Nombre',
    'Apellidos',
    'Área',
    'Especialidad',
    'RUT',
    'Llegó',
    'Puntualidad',
    'Entrada',
    'Salida',
  ];

  const data = rows.map((r) => [
    r.nombre,
    r.apellidos,
    r.area,
    r.especialidad,
    r.rut,
    r.arrived ? 'Sí' : 'No',
    r.punctuality === 'on_time' ? 'A tiempo' : r.punctuality === 'late' ? 'Tardanza' : '—',
    r.entradaHora ?? '',
    r.salidaHora ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Buk');
  XLSX.writeFile(wb, `asistencia-buk-${sedeName}-${dateYmd}.xlsx`);
}

export function exportAsistenciaLiveExcel(
  staff: AsistenciaStaffLiveState[],
  sedeName: string,
  dateYmd: string
): void {
  const headers = ['Nombre', 'Cargo', 'Sede', 'Estado', 'Hora', 'Crítico', 'RUT', 'Nota'];

  const data = staff.map((s) => [
    s.staff.fullName,
    s.staff.cargoLabel,
    s.staff.sedeName,
    ASISTENCIA_LIVE_STATUS_LABELS[s.status],
    s.entradaFormat ?? s.staff.expectedTime,
    s.staff.isCritical ? 'Sí' : 'No',
    s.staff.rut ?? '',
    s.statusNote ?? s.matchHint ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Organigrama');
  XLSX.writeFile(wb, `asistencia-live-${sedeName}-${dateYmd}.xlsx`);
}

function recordDateKey(r: BukAsistenciaRecord): string | null {
  if (r.dia_entrada) return r.dia_entrada;
  if (r.entrada) {
    const d = new Date(r.entrada);
    if (!Number.isNaN(d.getTime())) return formatDayKey(d);
  }
  return null;
}

function recordsInMonth(records: BukAsistenciaRecord[], monthPrefix: string): BukAsistenciaRecord[] {
  return records.filter((r) => {
    const key = recordDateKey(r);
    return key != null && key.startsWith(monthPrefix);
  });
}

/** Reporte mensual RRHH: resumen diario (snapshots) + detalle Buk del mes. */
export function exportAsistenciaMonthlyHrExcel(input: {
  monthPrefix: string;
  monthLabel: string;
  snapshots: AsistenciaDailySnapshot[];
  records: BukAsistenciaRecord[];
}): void {
  const monthSnapshots = input.snapshots.filter((s) => s.dateYmd.startsWith(input.monthPrefix));
  const summaryHeaders = [
    'Fecha',
    'Sede',
    'Trabajando',
    'Ausentes',
    'Tardanzas',
    'Críticos ausentes',
    'Cobertura presentes',
    'Cobertura requeridos',
    'Marcaciones Buk',
    'Origen',
  ];
  const summaryRows = monthSnapshots.map((s) => [
    s.dateYmd,
    s.sedeName,
    s.workingCount,
    s.absentCount,
    s.lateCount,
    s.criticalAbsentCount,
    s.totalPresent,
    s.totalRequired,
    s.bukRecordsOnDate,
    s.source === 'auto' ? 'Auto' : 'Manual',
  ]);

  const bukHeaders = [
    'Fecha',
    'RUT',
    'Nombre',
    'Apellido paterno',
    'Apellido materno',
    'Recinto',
    'Área',
    'Especialidad',
    'Entrada',
    'Salida',
  ];
  const monthRecords = recordsInMonth(input.records, input.monthPrefix);
  const bukRows = monthRecords.map((r) => [
    recordDateKey(r) ?? '',
    r.rut_trabajador ?? '',
    r.nombre ?? '',
    r.apellido_paterno ?? '',
    r.apellido_materno ?? '',
    r.nombre_recinto ?? r.codigo_recinto ?? '',
    r.area ?? '',
    r.especialidad ?? '',
    formatBukEntradaDisplay(r) ?? '',
    formatBukSalidaDisplay(r) ?? '',
  ]);

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen diario');
  const wsBuk = XLSX.utils.aoa_to_sheet([bukHeaders, ...bukRows]);
  XLSX.utils.book_append_sheet(wb, wsBuk, 'Detalle Buk');
  XLSX.writeFile(wb, `asistencia-rrhh-${input.monthPrefix}.xlsx`);
}
