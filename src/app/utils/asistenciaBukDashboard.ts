import type { AsistenciaSettings, BukAsistenciaRecord, BukPunctualityStatus } from '../types/asistencia';
import {
  formatBukEntradaDisplay,
  formatBukSalidaDisplay,
  hasBukEntradaMarcada,
  hasBukSalidaMarcadaOnDate,
  resolveBukEntryPunctuality,
} from './asistenciaData';
import { filterBukRecordsForSedeDate, getSedeProfile } from './asistenciaStaff';
import {
  lookupBukPeOrgByRut,
  type BukPeOrgLookupEntry,
} from './asistenciaBukOrgLookup';

export type BukDashboardRow = {
  id: number;
  nombre: string;
  apellidos: string;
  /** @deprecated Preferir roleFamilyName / orgArea*; se mantiene por filtros legacy Ctrlit. */
  especialidad: string;
  /** @deprecated Preferir orgAreaName; se mantiene por filtros legacy Ctrlit. */
  area: string;
  /** Familia de cargos (Buk.pe). */
  roleFamilyName: string;
  /** Área padre organizacional (Buk.pe). */
  orgAreaParentName: string;
  /** Área organizacional (Buk.pe). */
  orgAreaName: string;
  cargo?: string;
  rut: string;
  arrived: boolean;
  leftSameDay: boolean;
  entradaHora?: string;
  salidaHora?: string;
  /** A tiempo / tardanza según horario sede (turno día 08:00 + tolerancia). */
  punctuality: BukPunctualityStatus;
  isDayShift: boolean;
};

export type BukDashboardNamedGroup = {
  name: string;
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  onTime: number;
  late: number;
  rows: BukDashboardRow[];
};

/** @deprecated alias de grupo por familia */
export type BukDashboardSpecialtyGroup = BukDashboardNamedGroup & { especialidad: string };
/** @deprecated alias de grupo por área org */
export type BukDashboardAreaGroup = BukDashboardNamedGroup & { area: string };

export type BukDashboardSummary = {
  total: number;
  arrived: number;
  absent: number;
  leftSameDay: number;
  onTime: number;
  late: number;
  rows: BukDashboardRow[];
  /** Familia de cargos → … */
  familyGroups: BukDashboardNamedGroup[];
  /** Área padre → … */
  parentAreaGroups: BukDashboardNamedGroup[];
  /** Área organizacional → … */
  orgAreaGroups: BukDashboardNamedGroup[];
  /** Compat: mismos que familyGroups / orgAreaGroups. */
  specialtyGroups: BukDashboardSpecialtyGroup[];
  areaGroups: BukDashboardAreaGroup[];
};

export type BukMultiSedeDashboard = {
  sedes: { sedeName: string; summary: BukDashboardSummary }[];
  totals: Omit<
    BukDashboardSummary,
    'rows' | 'specialtyGroups' | 'areaGroups' | 'familyGroups' | 'parentAreaGroups' | 'orgAreaGroups'
  >;
};

export function buildBukMultiSedeDashboard(input: {
  records: BukAsistenciaRecord[];
  sedeNames: string[];
  settings: AsistenciaSettings;
  date: Date;
  orgByRut?: Map<string, BukPeOrgLookupEntry>;
}): BukMultiSedeDashboard {
  const sedes = input.sedeNames.map((sedeName) => ({
    sedeName,
    summary: buildBukDashboardSummary({
      records: input.records,
      sedeName,
      settings: input.settings,
      date: input.date,
      orgByRut: input.orgByRut,
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

function groupByName(
  rows: BukDashboardRow[],
  keyOf: (row: BukDashboardRow) => string
): BukDashboardNamedGroup[] {
  const by = new Map<string, BukDashboardRow[]>();
  for (const row of rows) {
    const key = keyOf(row) || '—';
    const list = by.get(key) ?? [];
    list.push(row);
    by.set(key, list);
  }
  return [...by.entries()]
    .map(([name, groupRows]) => ({
      name,
      ...groupStats(groupRows),
      rows: groupRows,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, 'es');
    });
}

function labelOrDash(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const t = (c ?? '').trim();
    if (t && t !== '—') return t;
  }
  return '—';
}

export function buildBukDashboardSummary(input: {
  records: BukAsistenciaRecord[];
  sedeName: string;
  settings: AsistenciaSettings;
  date: Date;
  orgByRut?: Map<string, BukPeOrgLookupEntry>;
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
      const ctrlitArea = (r.area || '').trim();
      const ctrlitEsp = (r.especialidad || '').trim();
      const pe = lookupBukPeOrgByRut(input.orgByRut, r.rut_trabajador);
      const roleFamilyName = labelOrDash(pe?.roleFamilyName, ctrlitEsp, ctrlitArea);
      const orgAreaParentName = labelOrDash(pe?.orgAreaParentName);
      const orgAreaName = labelOrDash(pe?.orgAreaName, ctrlitArea, ctrlitEsp);
      return {
        id: r.id,
        nombre: (r.nombre || '').trim(),
        apellidos: apellidosFromRecord(r),
        especialidad: roleFamilyName,
        area: orgAreaName,
        roleFamilyName,
        orgAreaParentName,
        orgAreaName,
        cargo: pe?.cargo,
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

  const familyGroups = groupByName(rows, (r) => r.roleFamilyName);
  const parentAreaGroups = groupByName(rows, (r) => r.orgAreaParentName);
  const orgAreaGroups = groupByName(rows, (r) => r.orgAreaName);

  const specialtyGroups: BukDashboardSpecialtyGroup[] = familyGroups.map((g) => ({
    ...g,
    especialidad: g.name,
  }));
  const areaGroups: BukDashboardAreaGroup[] = orgAreaGroups.map((g) => ({
    ...g,
    area: g.name,
  }));

  return {
    total: rows.length,
    arrived,
    absent: rows.length - arrived,
    leftSameDay,
    onTime,
    late,
    rows,
    familyGroups,
    parentAreaGroups,
    orgAreaGroups,
    specialtyGroups,
    areaGroups,
  };
}
