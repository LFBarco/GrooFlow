import type {
  AsistenciaCustomOrgColumn,
  AsistenciaOrgSubColumn,
  AsistenciaSettings,
  AsistenciaStaffMember,
} from '../types/asistencia';
import type { HrCollaboratorRow } from './accidentesData';
import { mergeAsistenciaSettings } from './asistenciaData';
import { getSedeProfile } from './asistenciaStaff';
import { resolveSedeFromCostCenterCode } from './asistenciaSedeOperativa';
import { normalizeSedeKey, resolveCanonicalSedeName } from './gestionSedes';

/** Slug estable para ids de familia/subárea (re-sync no duplica nodos). */
export function slugOrgPart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function familyOrgColumnId(familyName: string): string {
  return `fam_${slugOrgPart(familyName) || 'sin_familia'}`;
}

export function subAreaOrgColumnId(familyName: string, areaName: string): string {
  return `sub_${slugOrgPart(familyName) || 'f'}_${slugOrgPart(areaName) || 'area'}`;
}

function titleCaseLabel(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  return t
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function collaboratorSedeBase(
  emp: HrCollaboratorRow,
  settings: AsistenciaSettings,
  visibleSedes: string[]
): string | undefined {
  const fromCc = resolveSedeFromCostCenterCode(emp.costCenter, settings, visibleSedes);
  const raw = fromCc || emp.sede?.trim() || '';
  if (!raw) return undefined;
  return visibleSedes.length ? resolveCanonicalSedeName(raw, visibleSedes) : raw;
}

function familyOf(emp: HrCollaboratorRow): string {
  return (
    emp.roleFamilyName?.trim() ||
    emp.orgAreaParentName?.trim() ||
    'Sin familia'
  );
}

function subAreaOf(emp: HrCollaboratorRow): string | undefined {
  const family = familyOf(emp);
  const parent = emp.orgAreaParentName?.trim();
  const area = emp.orgAreaName?.trim();
  // Preferir área org distinta de la familia; si solo hay parent y no es familia, usarlo.
  if (area && normalizeSedeKey(area) !== normalizeSedeKey(family)) return area;
  if (parent && normalizeSedeKey(parent) !== normalizeSedeKey(family)) return parent;
  return undefined;
}

/** Resuelve id de columna/subárea para un colaborador según el árbol proyectado. */
export function resolveOrgAreaIdForCollaborator(
  emp: HrCollaboratorRow,
  profile: { customOrgColumns?: AsistenciaCustomOrgColumn[]; subOrgColumns?: AsistenciaOrgSubColumn[] }
): string {
  const family = familyOf(emp);
  const famId = familyOrgColumnId(family);
  const subName = subAreaOf(emp);
  if (subName) {
    const subId = subAreaOrgColumnId(family, subName);
    if ((profile.subOrgColumns ?? []).some((s) => s.id === subId)) return subId;
  }
  if ((profile.customOrgColumns ?? []).some((c) => c.id === famId)) return famId;
  return famId;
}

export type ProjectOrgTreeResult = {
  settings: AsistenciaSettings;
  families: number;
  subareas: number;
  cargosMapped: number;
  staffReassigned: number;
  employeesUsed: number;
};

/**
 * Proyecta Familia → Subárea → Cargos desde Colaboradores (Buk.pe) en el perfil de la sede.
 * Preserva color/layout de nodos existentes con el mismo id.
 */
export function projectOrgTreeFromCollaborators(input: {
  employees: HrCollaboratorRow[];
  settings: AsistenciaSettings;
  sedeName: string;
  visibleSedes?: string[];
  /** Reasigna staff.area de la sede según familia/área Buk. */
  reassignStaffAreas?: boolean;
}): ProjectOrgTreeResult {
  const merged = mergeAsistenciaSettings(input.settings);
  const visible = input.visibleSedes?.length ? input.visibleSedes : [input.sedeName];
  const sedeKey = normalizeSedeKey(input.sedeName);
  const profile = getSedeProfile(merged, input.sedeName);

  const forSede = input.employees.filter((e) => {
    const base = collaboratorSedeBase(e, merged, visible);
    return base ? normalizeSedeKey(base) === sedeKey : false;
  });

  type FamAgg = {
    label: string;
    subs: Map<string, { label: string; cargos: Set<string> }>;
    rootCargos: Set<string>;
  };
  const families = new Map<string, FamAgg>();

  for (const emp of forSede) {
    const famLabel = titleCaseLabel(familyOf(emp));
    const famId = familyOrgColumnId(famLabel);
    let fam = families.get(famId);
    if (!fam) {
      fam = { label: famLabel, subs: new Map(), rootCargos: new Set() };
      families.set(famId, fam);
    }
    const cargo = emp.cargo?.trim();
    const subName = subAreaOf(emp);
    if (subName) {
      const subLabel = titleCaseLabel(subName);
      const subId = subAreaOrgColumnId(famLabel, subLabel);
      let sub = fam.subs.get(subId);
      if (!sub) {
        sub = { label: subLabel, cargos: new Set() };
        fam.subs.set(subId, sub);
      }
      if (cargo) sub.cargos.add(cargo);
    } else if (cargo) {
      fam.rootCargos.add(cargo);
    }
  }

  const prevStyles = profile.orgNodeStyles ?? {};
  const prevCustomById = new Map((profile.customOrgColumns ?? []).map((c) => [c.id, c]));
  const prevSubById = new Map((profile.subOrgColumns ?? []).map((s) => [s.id, s]));

  const customOrgColumns: AsistenciaCustomOrgColumn[] = [];
  const subOrgColumns: AsistenciaOrgSubColumn[] = [];
  const areaLabels: Record<string, string> = { ...(profile.areaLabels ?? {}) };
  const cargoByColumn: Record<string, string[]> = {};
  const areaOrder: string[] = [];

  for (const [famId, fam] of [...families.entries()].sort((a, b) =>
    a[1].label.localeCompare(b[1].label, 'es')
  )) {
    const prev = prevCustomById.get(famId);
    customOrgColumns.push({
      id: famId,
      label: fam.label,
      color: prev?.color,
      childrenLayout: prev?.childrenLayout ?? 'horizontal',
      childrenPerRow: prev?.childrenPerRow ?? 3,
    });
    areaLabels[famId] = fam.label;
    areaOrder.push(famId);
    cargoByColumn[famId] = [...fam.rootCargos].sort((a, b) => a.localeCompare(b, 'es'));

    for (const [subId, sub] of [...fam.subs.entries()].sort((a, b) =>
      a[1].label.localeCompare(b[1].label, 'es')
    )) {
      const prevSub = prevSubById.get(subId);
      subOrgColumns.push({
        id: subId,
        label: sub.label,
        parentColumnId: famId,
        color: prevSub?.color,
        childrenLayout: prevSub?.childrenLayout ?? 'horizontal',
        childrenPerRow: prevSub?.childrenPerRow ?? 3,
      });
      areaLabels[subId] = sub.label;
      cargoByColumn[subId] = [...sub.cargos].sort((a, b) => a.localeCompare(b, 'es'));
    }
  }

  const orgNodeStyles = { ...prevStyles };
  for (const c of customOrgColumns) {
    orgNodeStyles[c.id] = {
      ...(orgNodeStyles[c.id] ?? {}),
      color: orgNodeStyles[c.id]?.color ?? c.color,
      childrenLayout: orgNodeStyles[c.id]?.childrenLayout ?? c.childrenLayout ?? 'horizontal',
      childrenPerRow: orgNodeStyles[c.id]?.childrenPerRow ?? c.childrenPerRow ?? 3,
    };
  }
  for (const s of subOrgColumns) {
    orgNodeStyles[s.id] = {
      ...(orgNodeStyles[s.id] ?? {}),
      color: orgNodeStyles[s.id]?.color ?? s.color,
      childrenLayout: orgNodeStyles[s.id]?.childrenLayout ?? s.childrenLayout ?? 'horizontal',
      childrenPerRow: orgNodeStyles[s.id]?.childrenPerRow ?? s.childrenPerRow ?? 3,
    };
  }

  let staff = [...(merged.staff ?? [])];
  let staffReassigned = 0;
  if (input.reassignStaffAreas !== false) {
    const byBuk = new Map(forSede.map((e) => [e.bukId, e]));
    const byDoc = new Map<string, HrCollaboratorRow>();
    for (const e of forSede) {
      const d = String(e.documentNumber ?? '').replace(/\D+/g, '');
      if (d) byDoc.set(d, e);
    }
    const draftProfile = { customOrgColumns, subOrgColumns };
    staff = staff.map((s) => {
      if (normalizeSedeKey(s.sedeName) !== sedeKey) return s;
      const emp =
        (s.bukEmployeeId ? byBuk.get(s.bukEmployeeId) : undefined) ||
        (s.rut ? byDoc.get(String(s.rut).replace(/\D+/g, '')) : undefined);
      if (!emp) return s;
      const nextArea = resolveOrgAreaIdForCollaborator(emp, draftProfile);
      if (s.area === nextArea) return s;
      staffReassigned += 1;
      return { ...s, area: nextArea };
    });
  }

  const nextProfiles = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== input.sedeName);
  nextProfiles.push({
    ...profile,
    sedeName: input.sedeName,
    customOrgColumns,
    subOrgColumns,
    areaLabels,
    areaOrder,
    cargoByColumn,
    orgNodeStyles,
    hideBuiltinColumns: true,
    hideEmptyAreas: profile.hideEmptyAreas ?? false,
    rootChildrenLayout: profile.rootChildrenLayout ?? 'horizontal',
    rootChildrenPerRow: profile.rootChildrenPerRow ?? 3,
  });

  return {
    settings: mergeAsistenciaSettings({
      ...merged,
      staff,
      sedeProfiles: nextProfiles,
    }),
    families: customOrgColumns.length,
    subareas: subOrgColumns.length,
    cargosMapped: Object.values(cargoByColumn).reduce((n, arr) => n + arr.length, 0),
    staffReassigned,
    employeesUsed: forSede.length,
  };
}

/** Asigna área de organigrama a un staff member según colaborador + perfil actual. */
export function assignStaffAreaFromCollaborator(
  member: AsistenciaStaffMember,
  emp: HrCollaboratorRow,
  settings: AsistenciaSettings
): AsistenciaStaffMember {
  const profile = getSedeProfile(settings, member.sedeName);
  if (!profile.hideBuiltinColumns && !(profile.customOrgColumns ?? []).length) {
    return member;
  }
  const area = resolveOrgAreaIdForCollaborator(emp, profile);
  return area === member.area ? member : { ...member, area };
}
