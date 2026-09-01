import type {
  AsistenciaOrgSubColumn,
  AsistenciaSedeProfile,
  AsistenciaSettings,
  AsistenciaStaffArea,
} from '../types/asistencia';
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

export type AsistenciaOrgAssignableArea = {
  id: string;
  label: string;
  parentColumnId?: string;
  isSub: boolean;
};

function newColumnId() {
  return `col_${Math.random().toString(36).slice(2, 9)}`;
}

function newSubColumnId() {
  return `sub_${Math.random().toString(36).slice(2, 9)}`;
}

export function isBuiltinOrgColumnId(id: string): id is AsistenciaStaffArea {
  return (ASISTENCIA_STAFF_AREAS as string[]).includes(id);
}

export function isSubOrgColumnId(profile: AsistenciaSedeProfile, id: string): boolean {
  return (profile.subOrgColumns ?? []).some((s) => s.id === id);
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

export function resolveOrgSubColumns(
  profile: AsistenciaSedeProfile,
  parentColumnId: string
): AsistenciaOrgSubColumn[] {
  return (profile.subOrgColumns ?? []).filter((s) => s.parentColumnId === parentColumnId);
}

export function resolveOrgSubColumnLabel(
  profile: AsistenciaSedeProfile,
  subColumnId: string
): string {
  const sub = (profile.subOrgColumns ?? []).find((s) => s.id === subColumnId);
  if (!sub) return subColumnId;
  return profile.areaLabels?.[subColumnId]?.trim() || sub.label;
}

export function resolveParentColumnId(
  profile: AsistenciaSedeProfile,
  areaId: string
): string {
  const sub = (profile.subOrgColumns ?? []).find((s) => s.id === areaId);
  return sub?.parentColumnId ?? areaId;
}

/** Áreas asignables al personal: columnas + subcolumnas. */
export function resolveOrgAssignableAreas(
  profile: AsistenciaSedeProfile
): AsistenciaOrgAssignableArea[] {
  const out: AsistenciaOrgAssignableArea[] = [];
  for (const col of resolveOrgColumns(profile)) {
    out.push({ id: col.id, label: col.label, isSub: false });
    for (const sub of resolveOrgSubColumns(profile, col.id)) {
      out.push({
        id: sub.id,
        label: resolveOrgSubColumnLabel(profile, sub.id),
        parentColumnId: col.id,
        isSub: true,
      });
    }
  }
  return out;
}

export function resolveOrgColumnOrder(settings: AsistenciaSettings, sedeName: string): string[] {
  return resolveOrgColumns(getSedeProfile(settings, sedeName)).map((c) => c.id);
}

/** Ids válidos para asignar personal (columnas + subcolumnas). */
export function resolveOrgAssignableAreaIds(
  settings: AsistenciaSettings,
  sedeName: string
): string[] {
  const profile = getSedeProfile(settings, sedeName);
  return resolveOrgAssignableAreas(profile).map((a) => a.id);
}

export function resolveOrgColumnLabel(
  profile: AsistenciaSedeProfile,
  columnId: string
): string {
  if (isSubOrgColumnId(profile, columnId)) {
    return resolveOrgSubColumnLabel(profile, columnId);
  }
  return resolveOrgColumns(profile).find((c) => c.id === columnId)?.label ?? columnId;
}

export function cargosForOrgColumn(
  profile: AsistenciaSedeProfile,
  columnId: string
): string[] {
  const parentId = resolveParentColumnId(profile, columnId);
  const custom = profile.cargoByColumn?.[columnId] ?? profile.cargoByColumn?.[parentId];
  if (custom?.length) return custom;
  if (isBuiltinOrgColumnId(parentId)) {
    return [...ASISTENCIA_CARGOS_BY_BUILTIN_AREA[parentId]];
  }
  return ['Personal', 'Encargado'];
}

/** Parsea lista de cargos desde texto (una línea o coma por cargo). */
export function parseCargoListText(text: string): string[] {
  const items = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(items)];
}

export function cargoListToText(cargos: string[]): string {
  return cargos.join('\n');
}

function upsertSedeProfile(
  settings: AsistenciaSettings,
  sedeName: string,
  patch: Partial<AsistenciaSedeProfile>
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    sedeProfiles: [...rest, { ...profile, sedeName, ...patch }],
  });
}

export function applyAddOrgColumn(
  settings: AsistenciaSettings,
  sedeName: string,
  label: string
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const id = newColumnId();
  const customOrgColumns = [
    ...(profile.customOrgColumns ?? []),
    { id, label: label.trim() || 'Nueva columna' },
  ];
  const areaOrder = [...resolveOrgColumnOrder(merged, sedeName), id];
  return upsertSedeProfile(merged, sedeName, { customOrgColumns, areaOrder });
}

export function applyAddOrgSubColumn(
  settings: AsistenciaSettings,
  sedeName: string,
  parentColumnId: string,
  label: string
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const parentExists = resolveOrgColumns(profile).some((c) => c.id === parentColumnId);
  if (!parentExists) return merged;
  const id = newSubColumnId();
  const subOrgColumns = [
    ...(profile.subOrgColumns ?? []),
    { id, label: label.trim() || 'Nueva subcolumna', parentColumnId },
  ];
  return upsertSedeProfile(merged, sedeName, { subOrgColumns });
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
  const subOrgColumns = (profile.subOrgColumns ?? []).filter(
    (s) => s.parentColumnId !== columnId
  );
  for (const sub of profile.subOrgColumns ?? []) {
    if (sub.parentColumnId === columnId) {
      delete areaLabels[sub.id];
      delete cargoByColumn[sub.id];
    }
  }
  const staff = (merged.staff ?? []).map((s) => {
    if (s.sedeName !== sedeName) return s;
    if (s.area === columnId) return { ...s, area: 'administracion' };
    const sub = (profile.subOrgColumns ?? []).find(
      (x) => x.id === s.area && x.parentColumnId === columnId
    );
    if (sub) return { ...s, area: 'administracion' };
    return s;
  });
  return mergeAsistenciaSettings({
    ...merged,
    staff,
    sedeProfiles: [
      ...(merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName),
      {
        ...profile,
        sedeName,
        customOrgColumns,
        areaOrder,
        areaLabels,
        cargoByColumn,
        subOrgColumns,
      },
    ],
  });
}

export function applyRemoveOrgSubColumn(
  settings: AsistenciaSettings,
  sedeName: string,
  subColumnId: string
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const sub = (profile.subOrgColumns ?? []).find((s) => s.id === subColumnId);
  if (!sub) return merged;
  const subOrgColumns = (profile.subOrgColumns ?? []).filter((s) => s.id !== subColumnId);
  const areaLabels = { ...profile.areaLabels };
  delete areaLabels[subColumnId];
  const cargoByColumn = { ...profile.cargoByColumn };
  delete cargoByColumn[subColumnId];
  const staff = (merged.staff ?? []).map((s) =>
    s.sedeName === sedeName && s.area === subColumnId
      ? { ...s, area: sub.parentColumnId }
      : s
  );
  return mergeAsistenciaSettings({
    ...merged,
    staff,
    sedeProfiles: [
      ...(merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName),
      { ...profile, sedeName, subOrgColumns, areaLabels, cargoByColumn },
    ],
  });
}

export function applyOrgColumnLabels(
  settings: AsistenciaSettings,
  sedeName: string,
  labels: Record<string, string>,
  areaOrder: string[],
  hideEmptyAreas: boolean,
  cargoByColumn?: Record<string, string[]>,
  subOrgColumns?: AsistenciaOrgSubColumn[]
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const cleanedLabels = Object.fromEntries(
    Object.entries(labels).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)
  );
  const nextCustom = (profile.customOrgColumns ?? []).map((c) => ({
    ...c,
    label: cleanedLabels[c.id]?.trim() || c.label,
  }));
  const nextSub = (subOrgColumns ?? profile.subOrgColumns ?? []).map((s) => ({
    ...s,
    label: cleanedLabels[s.id]?.trim() || s.label,
  }));
  return upsertSedeProfile(merged, sedeName, {
    areaOrder,
    areaLabels: Object.keys(cleanedLabels).length ? cleanedLabels : profile.areaLabels,
    hideEmptyAreas,
    cargoByColumn:
      cargoByColumn && Object.keys(cargoByColumn).length ? cargoByColumn : profile.cargoByColumn,
    customOrgColumns: nextCustom,
    subOrgColumns: nextSub,
  });
}
