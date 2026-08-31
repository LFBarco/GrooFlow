import type {
  AsistenciaFilters,
  AsistenciaLiveConsolidatedSummary,
  AsistenciaLiveSedeSummary,
  AsistenciaStaffLiveState,
} from '../types/asistencia';
import type { BukDashboardRow } from './asistenciaBukDashboard';

export function defaultAsistenciaFilters(): AsistenciaFilters {
  return {
    search: '',
    shift: 'all',
    liveStatus: 'all',
    arrivalFilter: 'all',
    areaFilter: '__all__',
    specialtyFilter: '__all__',
    criticalOnly: false,
    noBukMatchOnly: false,
  };
}

export function countAsistenciaActiveFilters(filters: AsistenciaFilters): number {
  let n = 0;
  if (filters.search.trim()) n += 1;
  if (filters.shift !== 'all') n += 1;
  if (filters.liveStatus !== 'all') n += 1;
  if (filters.arrivalFilter !== 'all') n += 1;
  if (filters.areaFilter !== '__all__') n += 1;
  if (filters.specialtyFilter !== '__all__') n += 1;
  if (filters.criticalOnly) n += 1;
  if (filters.noBukMatchOnly) n += 1;
  return n;
}

export function matchesLiveStaffFilter(
  live: AsistenciaStaffLiveState,
  filters: AsistenciaFilters
): boolean {
  const q = filters.search.trim().toLowerCase();
  if (q) {
    const hay = [
      live.staff.fullName,
      live.staff.cargoLabel,
      live.staff.rut ?? '',
      live.staff.sedeName,
    ]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.liveStatus !== 'all' && live.status !== filters.liveStatus) return false;
  if (filters.criticalOnly && !live.staff.isCritical) return false;
  if (filters.noBukMatchOnly) {
    if (live.status !== 'ausente' || !live.matchHint) return false;
  }
  if (filters.criticalOnly && filters.liveStatus === 'all' && live.status === 'ausente' && live.staff.isCritical) {
    return true;
  }
  return true;
}

function recomputeSedeCounts(staff: AsistenciaStaffLiveState[]) {
  return {
    workingCount: staff.filter((s) => s.status === 'trabajando').length,
    absentCount: staff.filter((s) => s.status === 'ausente').length,
    lateCount: staff.filter((s) => s.status === 'tarde').length,
    criticalMissing: staff
      .filter((s) => s.staff.isCritical && s.status === 'ausente')
      .map((s) => s.staff),
  };
}

export function filterLiveSedeSummary(
  summary: AsistenciaLiveSedeSummary,
  filters: AsistenciaFilters
): AsistenciaLiveSedeSummary {
  const areas = summary.areas
    .map((block) => {
      const staff = block.staff.filter((s) => matchesLiveStaffFilter(s, filters));
      const activeCount = staff.filter(
        (s) => s.status === 'trabajando' || s.status === 'presente'
      ).length;
      return { ...block, staff, activeCount, totalCount: staff.length };
    })
    .filter((block) => block.staff.length > 0);

  const flatStaff = areas.flatMap((a) => a.staff);
  const manager =
    summary.manager && matchesLiveStaffFilter(summary.manager, filters) ? summary.manager : null;
  const counts = recomputeSedeCounts(flatStaff);

  return {
    ...summary,
    ...counts,
    manager,
    areas,
    isOperational: counts.criticalMissing.length === 0,
  };
}

export function filterLiveConsolidatedSummary(
  consolidated: AsistenciaLiveConsolidatedSummary,
  filters: AsistenciaFilters
): AsistenciaLiveConsolidatedSummary {
  const sedes = consolidated.sedes.map((s) => filterLiveSedeSummary(s, filters));
  return {
    workingCount: sedes.reduce((n, s) => n + s.workingCount, 0),
    absentCount: sedes.reduce((n, s) => n + s.absentCount, 0),
    lateCount: sedes.reduce((n, s) => n + s.lateCount, 0),
    isFullyOperational: sedes.every((s) => s.isOperational),
    sedes,
  };
}

export function filterBukDashboardRows(
  rows: BukDashboardRow[],
  filters: AsistenciaFilters
): BukDashboardRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.shift === 'day' && !row.isDayShift) return false;
    if (filters.shift === 'night' && row.isDayShift) return false;
    if (filters.arrivalFilter === 'arrived' && !row.arrived) return false;
    if (filters.arrivalFilter === 'absent' && row.arrived) return false;
    if (filters.arrivalFilter === 'on_time' && row.punctuality !== 'on_time') return false;
    if (filters.arrivalFilter === 'late' && row.punctuality !== 'late') return false;
    if (filters.areaFilter !== '__all__' && row.area !== filters.areaFilter) return false;
    if (filters.specialtyFilter !== '__all__' && row.especialidad !== filters.specialtyFilter) {
      return false;
    }
    if (filters.liveStatus === 'ausente' && row.arrived) return false;
    if (filters.liveStatus === 'tarde' && row.punctuality !== 'late') return false;
    if (filters.liveStatus === 'trabajando' && (!row.arrived || row.punctuality === 'late')) {
      return false;
    }
    if (filters.liveStatus === 'presente' && !row.arrived) return false;
    if (!q) return true;
    const hay = `${row.nombre} ${row.apellidos} ${row.especialidad} ${row.area} ${row.rut}`.toLowerCase();
    return hay.includes(q);
  });
}
