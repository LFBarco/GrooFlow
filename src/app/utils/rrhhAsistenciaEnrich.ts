import type { BukAsistenciaRecord } from '../types/asistencia';
import type { BukPeEmployeeRow } from '../types/rrhh';
import { personFullName } from './asistenciaData';

export function normalizeRutKey(rut?: string): string {
  return (rut ?? '').replace(/[.\-\s]/g, '').toLowerCase();
}

/** Último registro de asistencia por RUT (fecha más reciente). */
export function buildLatestAsistenciaByRut(
  records: BukAsistenciaRecord[]
): Map<string, BukAsistenciaRecord> {
  const map = new Map<string, BukAsistenciaRecord>();
  for (const r of records) {
    const key = normalizeRutKey(r.rut_trabajador);
    if (!key) continue;
    const prev = map.get(key);
    const day = r.dia_entrada ?? '';
    const prevDay = prev?.dia_entrada ?? '';
    if (!prev || day >= prevDay) {
      map.set(key, r);
    }
  }
  return map;
}

export function enrichEmployeeWithAsistencia(
  emp: BukPeEmployeeRow,
  rec?: BukAsistenciaRecord
): BukPeEmployeeRow {
  if (!rec) return { ...emp, asistenciaEnriched: false };

  const recintoLabel = [rec.codigo_recinto, rec.nombre_recinto].filter(Boolean).join(' · ');

  return {
    ...emp,
    rutAsistencia: rec.rut_trabajador || emp.rutAsistencia,
    documentNumber: emp.documentNumber || rec.rut_trabajador?.replace(/[.\-\s]/g, '').slice(0, -1),
    recintoNombre: rec.nombre_recinto || emp.recintoNombre,
    recintoCodigo: rec.codigo_recinto || emp.recintoCodigo,
    recintoLabel: recintoLabel || emp.recintoLabel,
    areaAsistencia: rec.area || emp.areaAsistencia,
    especialidad: rec.especialidad || emp.especialidad,
    supervisor: rec.supervisor || emp.supervisor,
    contratoAsistencia: rec.contrato || emp.contratoAsistencia,
    turnoAsistencia: rec.turno || emp.turnoAsistencia,
    codigoTurno: rec.codigo_turno || emp.codigoTurno,
    ultimaMarcacionEntrada: rec.entrada_format || rec.entrada || emp.ultimaMarcacionEntrada,
    ultimaMarcacionSalida: rec.salida_format || rec.salida || emp.ultimaMarcacionSalida,
    ultimaAsistenciaDia: rec.dia_entrada || emp.ultimaAsistenciaDia,
    turnoNoche: rec.turno_noche ?? emp.turnoNoche,
    art22: rec.art22 ?? emp.art22,
    trabIdAsistencia: rec.trab_id ?? emp.trabIdAsistencia,
    asistenciaEnriched: true,
    asistenciaSyncedAt: new Date().toISOString(),
    fullName: emp.fullName || personFullName(rec),
  };
}

export function enrichEmployeesWithAsistencia(
  employees: BukPeEmployeeRow[],
  records: BukAsistenciaRecord[]
): { employees: BukPeEmployeeRow[]; matched: number } {
  if (records.length === 0) {
    return { employees, matched: 0 };
  }

  const byRut = buildLatestAsistenciaByRut(records);
  let matched = 0;

  const enriched = employees.map((emp) => {
    const docKey = normalizeRutKey(emp.documentNumber);
    const rutKey = normalizeRutKey(emp.rutAsistencia);
    const rec =
      (docKey ? byRut.get(docKey) : undefined) ??
      (rutKey ? byRut.get(rutKey) : undefined) ??
      findByNameMatch(emp, records);
    if (!rec) return emp;
    matched++;
    return enrichEmployeeWithAsistencia(emp, rec);
  });

  return { employees: enriched, matched };
}

function findByNameMatch(
  emp: BukPeEmployeeRow,
  records: BukAsistenciaRecord[]
): BukAsistenciaRecord | undefined {
  const target = emp.fullName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
  if (!target) return undefined;
  return records.find((r) => personFullName(r).toLowerCase() === target);
}
