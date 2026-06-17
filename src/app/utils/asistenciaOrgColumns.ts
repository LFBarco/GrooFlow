import type { AsistenciaSedeProfile, AsistenciaSettings, AsistenciaStaffArea } from '../types/asistencia';
import {
  ASISTENCIA_CARGOS_BY_BUILTIN_AREA,
  ASISTENCIA_STAFF_AREA_LABELS,
  ASISTENCIA_STAFF_AREAS,
} from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { getSedeProfile } from './asistenciaStaff';

export type AsistenciaOrgColumn = {
  id: string;
  label: string;
  builtin: boolean;
};

function newColumnId() {
  return `col_${Math.random().toString(36).slice(2, 9)}`;
}

export function isBuiltinOrgColumnId(id: string): id is AsistenciaStaffArea {
  return (ASISTENCIA_STAFF_AREAS as string[]).includes(id);
}

export function resolveOrgColumns(profile: AsistenciaSedeProfile): AsistenciaOrgColumn[] {
  const custom = profile.customOrgColumns ?? [];
  const builtins: AsistenciaOrgColumn[] = ASISTENCIA_STAFF_AREAS.map((id) => ({
    id,
    label: profile.areaLabels?.[id]?.trim() || ASISTENCIA_STAFF_AREA_LABELS[id],
    builtin: true,
  }));
  const customCols: AsistenciaOrgColumn[] = custom.map((c) => ({
    id: c.id,
    label: profile.areaLabels?.[c.id]?.trim() || c.label,
    builtin: false,
  }));
  const all = [...builtins, ...customCols];
  const order = profile.areaOrder?.length ? profile.areaOrder : all.map((c) => c.id);
  const byId = new Map(all.map((c) => [c.id, c]));
  const ordered: AsistenciaOrgColumn[] = [];
  for (const id of order) {
    const col = byId.get(id);
    if (col) ordered.push(col);
  }
  for (const col of all) {
    if (!ordered.some((c) => c.id === col.id)) ordered.push(col);
  }
  return ordered;
}

export function resolveOrgColumnOrder(settings: AsistenciaSettings, sedeName: string): string[] {
  return resolveOrgColumns(getSedeProfile(settings, sedeName)).map((c) => c.id);
}

export function resolveOrgColumnLabel(
  profile: AsistenciaSedeProfile,
  columnId: string
): string {
  return resolveOrgColumns(profile).find((c) => c.id === columnId)?.label ?? columnId;
}

export function cargosForOrgColumn(
  profile: AsistenciaSedeProfile,
  columnId: string
): string[] {
  const custom = profile.cargoByColumn?.[columnId];
  if (custom?.length) return custom;
  if (isBuiltinOrgColumnId(columnId)) {
    return [...ASISTENCIA_CARGOS_BY_BUILTIN_AREA[columnId]];
  }
  return ['Personal', 'Encargado'];
}

export function applyAddOrgColumn(
  settings: AsistenciaSettings,
  sedeName: string,
  label: string
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const id = newColumnId();
  const customOrgColumns = [...(profile.customOrgColumns ?? []), { id, label: label.trim() || 'Nueva columna' }];
  const areaOrder = [...resolveOrgColumnOrder(merged, sedeName), id];
  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    sedeProfiles: [
      ...rest,
      { ...profile, sedeName, customOrgColumns, areaOrder },
    ],
  });
}

export function applyRemoveOrgColumn(
  settings: AsistenciaSettings,
  sedeName: string,
  columnId: string
): AsistenciaSettings {
  if (isBuiltinOrgColumnId(columnId)) return settings;
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const customOrgColumns = (profile.customOrgColumns ?? []).filter((c) => c.id !== columnId);
  const areaOrder = resolveOrgColumnOrder(merged, sedeName).filter((id) => id !== columnId);
  const areaLabels = { ...profile.areaLabels };
  delete areaLabels[columnId];
  const cargoByColumn = { ...profile.cargoByColumn };
  delete cargoByColumn[columnId];
  const staff = (merged.staff ?? []).map((s) =>
    s.sedeName === sedeName && s.area === columnId ? { ...s, area: 'administracion' } : s
  );
  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    staff,
    sedeProfiles: [
      ...rest,
      { ...profile, sedeName, customOrgColumns, areaOrder, areaLabels, cargoByColumn },
    ],
  });
}

export function applyOrgColumnLabels(
  settings: AsistenciaSettings,
  sedeName: string,
  labels: Record<string, string>,
  areaOrder: string[],
  hideEmptyAreas: boolean,
  cargoByColumn?: Record<string, string[]>
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const cleanedLabels = Object.fromEntries(
    Object.entries(labels).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)
  );
  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    sedeProfiles: [
      ...rest,
      {
        ...profile,
        sedeName,
        areaOrder,
        areaLabels: Object.keys(cleanedLabels).length ? cleanedLabels : undefined,
        hideEmptyAreas,
        cargoByColumn: cargoByColumn && Object.keys(cargoByColumn).length ? cargoByColumn : profile.cargoByColumn,
      },
    ],
  });
}
