import type { AsistenciaSettings, AsistenciaStaffArea, AsistenciaStaffMember } from '../types/asistencia';
import { ASISTENCIA_STAFF_AREAS } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { getSedeProfile } from './asistenciaStaff';

export function areaOrderFromSettings(
  settings: AsistenciaSettings,
  sedeName: string
): AsistenciaStaffArea[] {
  const profile = getSedeProfile(settings, sedeName);
  const custom = profile.areaOrder?.filter((a) => ASISTENCIA_STAFF_AREAS.includes(a));
  if (custom?.length) {
    return [...custom, ...ASISTENCIA_STAFF_AREAS.filter((a) => !custom.includes(a))];
  }
  return [...ASISTENCIA_STAFF_AREAS];
}

function staffByAreaOrdered(
  staff: AsistenciaStaffMember[],
  sedeName: string,
  areaOrder: AsistenciaStaffArea[]
): Record<AsistenciaStaffArea, AsistenciaStaffMember[]> {
  const byArea: Record<AsistenciaStaffArea, AsistenciaStaffMember[]> = {
    administracion: [],
    medica: [],
    peluqueria: [],
  };
  for (const area of areaOrder) {
    byArea[area] = staff
      .filter((s) => s.sedeName === sedeName && !s.isManager && s.area === area)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.fullName.localeCompare(b.fullName));
  }
  return byArea;
}

function flattenWithSortOrder(
  byArea: Record<AsistenciaStaffArea, AsistenciaStaffMember[]>,
  areaOrder: AsistenciaStaffArea[]
): AsistenciaStaffMember[] {
  let order = 0;
  const out: AsistenciaStaffMember[] = [];
  for (const area of areaOrder) {
    for (const member of byArea[area]) {
      out.push({ ...member, area, sortOrder: order++ });
    }
  }
  return out;
}

/** Mueve personal entre áreas o reordena dentro del área (vista en vivo). */
export function applyStaffLayoutMove(
  settings: AsistenciaSettings,
  input: {
    sedeName: string;
    staffId: string;
    toArea: AsistenciaStaffArea;
    toIndex: number;
  }
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const allStaff = merged.staff ?? [];
  const member = allStaff.find((s) => s.id === input.staffId);
  if (!member || member.sedeName !== input.sedeName || member.isManager) return merged;

  const areaOrder = areaOrderFromSettings(merged, input.sedeName);
  const byArea = staffByAreaOrdered(allStaff, input.sedeName, areaOrder);

  for (const area of areaOrder) {
    byArea[area] = byArea[area].filter((s) => s.id !== input.staffId);
  }

  const target = [...byArea[input.toArea]];
  const index = Math.max(0, Math.min(input.toIndex, target.length));
  target.splice(index, 0, { ...member, area: input.toArea });
  byArea[input.toArea] = target;

  const managers = allStaff.filter((s) => s.sedeName === input.sedeName && s.isManager);
  const others = allStaff.filter((s) => s.sedeName !== input.sedeName);
  const reassigned = flattenWithSortOrder(byArea, areaOrder);

  return mergeAsistenciaSettings({
    ...merged,
    staff: [...others, ...managers, ...reassigned],
  });
}

/** Reordena columnas de área en el organigrama de una sede. */
export function applyAreaLayoutReorder(
  settings: AsistenciaSettings,
  sedeName: string,
  dragArea: AsistenciaStaffArea,
  hoverArea: AsistenciaStaffArea
): AsistenciaSettings {
  if (dragArea === hoverArea) return settings;
  const merged = mergeAsistenciaSettings(settings);
  const order = areaOrderFromSettings(merged, sedeName);
  const from = order.indexOf(dragArea);
  const to = order.indexOf(hoverArea);
  if (from < 0 || to < 0) return merged;

  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, dragArea);

  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  const profile = getSedeProfile(merged, sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    sedeProfiles: [...rest, { ...profile, sedeName, areaOrder: next }],
  });
}
