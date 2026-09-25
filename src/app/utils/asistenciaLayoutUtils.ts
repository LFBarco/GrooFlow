import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { resolveOrgColumnOrder, resolveOrgAssignableAreaIds } from './asistenciaOrgColumns';
import { getSedeProfile } from './asistenciaStaff';

function staffByColumnOrdered(
  staff: AsistenciaStaffMember[],
  sedeName: string,
  columnOrder: string[]
): Record<string, AsistenciaStaffMember[]> {
  const byColumn: Record<string, AsistenciaStaffMember[]> = {};
  for (const colId of columnOrder) {
    byColumn[colId] = staff
      .filter((s) => s.sedeName === sedeName && !s.isManager && s.area === colId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.fullName.localeCompare(b.fullName));
  }
  return byColumn;
}

function flattenWithSortOrder(
  byColumn: Record<string, AsistenciaStaffMember[]>,
  columnOrder: string[]
): AsistenciaStaffMember[] {
  let order = 0;
  const out: AsistenciaStaffMember[] = [];
  for (const colId of columnOrder) {
    for (const member of byColumn[colId] ?? []) {
      out.push({ ...member, area: colId, sortOrder: order++ });
    }
  }
  return out;
}

/** Mueve personal entre columnas o reordena dentro de la columna (vista en vivo). */
export function applyStaffLayoutMove(
  settings: AsistenciaSettings,
  input: {
    sedeName: string;
    staffId: string;
    toArea: string;
    toIndex: number;
  }
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const allStaff = merged.staff ?? [];
  const member = allStaff.find((s) => s.id === input.staffId);
  if (!member || member.sedeName !== input.sedeName || member.isManager) return merged;

  const columnOrder = resolveOrgColumnOrder(merged, input.sedeName);
  const assignableIds = resolveOrgAssignableAreaIds(merged, input.sedeName);
  if (!assignableIds.includes(input.toArea)) return merged;

  const byColumn = staffByColumnOrdered(allStaff, input.sedeName, assignableIds);

  for (const colId of assignableIds) {
    byColumn[colId] = (byColumn[colId] ?? []).filter((s) => s.id !== input.staffId);
  }

  const target = [...(byColumn[input.toArea] ?? [])];
  const index = Math.max(0, Math.min(input.toIndex, target.length));
  target.splice(index, 0, { ...member, area: input.toArea });
  byColumn[input.toArea] = target;

  const managers = allStaff.filter((s) => s.sedeName === input.sedeName && s.isManager);
  const others = allStaff.filter((s) => s.sedeName !== input.sedeName);
  const reassigned = flattenWithSortOrder(byColumn, assignableIds);

  return mergeAsistenciaSettings({
    ...merged,
    staff: [...others, ...managers, ...reassigned],
  });
}

/** Reordena columnas del organigrama de una sede. */
export function applyAreaLayoutReorder(
  settings: AsistenciaSettings,
  sedeName: string,
  dragArea: string,
  hoverArea: string
): AsistenciaSettings {
  if (dragArea === hoverArea) return settings;
  const merged = mergeAsistenciaSettings(settings);
  const order = resolveOrgColumnOrder(merged, sedeName);
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

/** Reordena hijos (subcolumnas) bajo el mismo padre en el organigrama. */
export function applySubColumnReorder(
  settings: AsistenciaSettings,
  sedeName: string,
  dragSubId: string,
  hoverSubId: string
): AsistenciaSettings {
  if (dragSubId === hoverSubId) return settings;
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const all = [...(profile.subOrgColumns ?? [])];
  const drag = all.find((s) => s.id === dragSubId);
  const hover = all.find((s) => s.id === hoverSubId);
  if (!drag || !hover || drag.parentColumnId !== hover.parentColumnId) return merged;

  const parentId = drag.parentColumnId;
  const siblingIds = all.filter((s) => s.parentColumnId === parentId).map((s) => s.id);
  const from = siblingIds.indexOf(dragSubId);
  const to = siblingIds.indexOf(hoverSubId);
  if (from < 0 || to < 0) return merged;

  const nextSibling = [...siblingIds];
  nextSibling.splice(from, 1);
  nextSibling.splice(to, 0, dragSubId);

  const byId = new Map(all.map((s) => [s.id, s]));
  let si = 0;
  const nextSubs = all.map((s) => {
    if (s.parentColumnId !== parentId) return s;
    const id = nextSibling[si++]!;
    return byId.get(id)!;
  });

  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    sedeProfiles: [...rest, { ...profile, sedeName, subOrgColumns: nextSubs }],
  });
}
