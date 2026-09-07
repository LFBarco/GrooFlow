import type {
  AsistenciaLiveAreaBlock,
  AsistenciaLiveSedeSummary,
  AsistenciaLiveSubAreaBlock,
  AsistenciaStaffLiveState,
} from '../types/asistencia';

function flattenSubStaff(sub: AsistenciaLiveSubAreaBlock): AsistenciaStaffLiveState[] {
  return [...sub.staff, ...(sub.children?.flatMap(flattenSubStaff) ?? [])];
}

/** Personal de un bloque de área incluyendo subáreas anidadas. */
export function flattenLiveAreaStaff(block: AsistenciaLiveAreaBlock): AsistenciaStaffLiveState[] {
  return [...block.staff, ...(block.subAreas?.flatMap(flattenSubStaff) ?? [])];
}

/** Todo el personal del organigrama en vivo de una sede (sin el manager si solo está en areas). */
export function flattenLiveSedeStaff(summary: AsistenciaLiveSedeSummary): AsistenciaStaffLiveState[] {
  const fromAreas = summary.areas.flatMap(flattenLiveAreaStaff);
  if (summary.manager && !fromAreas.some((s) => s.staff.id === summary.manager!.staff.id)) {
    return [summary.manager, ...fromAreas];
  }
  return fromAreas;
}

export function flattenLiveSedesStaff(
  sedes: AsistenciaLiveSedeSummary[]
): AsistenciaStaffLiveState[] {
  return sedes.flatMap(flattenLiveSedeStaff);
}
