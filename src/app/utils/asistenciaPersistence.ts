import type { SystemSettings } from '../types';
import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import {
  mergeAsistenciaSettings,
  mergeAsistenciaStaffLists,
} from './asistenciaData';

/** Clave KV/SQL dedicada — no depende de `settings:system` (evita pérdida al recargar). */
export const ASISTENCIA_SETTINGS_KV_KEY = 'settings:asistencia';

function mergeByKey<T>(a: T[] | undefined, b: T[] | undefined, keyOf: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of a ?? []) map.set(keyOf(item), item);
  for (const item of b ?? []) map.set(keyOf(item), item);
  return [...map.values()];
}

export function asistenciaSettingsHasContent(
  partial?: Partial<AsistenciaSettings> | null
): boolean {
  if (!partial || typeof partial !== 'object') return false;
  return (
    (partial.staff?.length ?? 0) > 0 ||
    (partial.sedeProfiles?.length ?? 0) > 0 ||
    (partial.sedeMappings?.length ?? 0) > 0 ||
    (partial.requirements?.length ?? 0) > 0 ||
    partial.buk?.enabled === true ||
    !!(partial.buk?.apiToken?.trim())
  );
}

/** Fusiona asistencia dedicada (SQL/KV) con legacy embebida en settings:system. */
export function resolveAsistenciaSettings(
  dedicated: Partial<AsistenciaSettings> | null | undefined,
  legacy: Partial<AsistenciaSettings> | null | undefined
): AsistenciaSettings {
  const fromDedicated = mergeAsistenciaSettings(dedicated);
  const fromLegacy = mergeAsistenciaSettings(legacy);

  const staff = mergeAsistenciaStaffLists(
    fromLegacy.staff,
    fromDedicated.staff
  ) as AsistenciaStaffMember[];

  const sedeProfiles = mergeByKey(fromLegacy.sedeProfiles, fromDedicated.sedeProfiles, (p) => p.sedeName);
  const sedeMappings = mergeByKey(fromLegacy.sedeMappings, fromDedicated.sedeMappings, (m) => m.sedeName);
  const requirements = mergeByKey(fromLegacy.requirements, fromDedicated.requirements, (r) => r.id);

  return mergeAsistenciaSettings({
    ...fromLegacy,
    ...fromDedicated,
    staff,
    sedeProfiles,
    sedeMappings,
    requirements,
    buk: { ...fromLegacy.buk, ...fromDedicated.buk },
  });
}

export function mergeAsistenciaIntoSystemSettings(
  settings: SystemSettings,
  asistencia: AsistenciaSettings
): SystemSettings {
  return { ...settings, asistencia };
}

/** Asistencia vive en `settings:asistencia`; no duplicar en `settings:system`. */
export function stripAsistenciaForSystemKv(settings: SystemSettings): SystemSettings {
  const { asistencia: _omit, ...rest } = settings;
  return rest as SystemSettings;
}

/** Aplica un parche de asistencia sobre el estado actual (nunca borra listas con arrays vacíos del patch). */
export function patchAsistenciaSettings(
  current: AsistenciaSettings | undefined,
  patch: Partial<AsistenciaSettings>
): AsistenciaSettings {
  const base = mergeAsistenciaSettings(current);
  const next = mergeAsistenciaSettings(patch);
  return mergeAsistenciaSettings({
    ...base,
    ...next,
    buk: { ...base.buk, ...next.buk },
    staff:
      Array.isArray(patch.staff) && patch.staff.length > 0 ? next.staff : base.staff,
    sedeProfiles:
      Array.isArray(patch.sedeProfiles) && patch.sedeProfiles.length > 0
        ? next.sedeProfiles
        : base.sedeProfiles,
    sedeMappings:
      Array.isArray(patch.sedeMappings) && patch.sedeMappings.length > 0
        ? next.sedeMappings
        : base.sedeMappings,
    requirements:
      Array.isArray(patch.requirements) && patch.requirements.length > 0
        ? next.requirements
        : base.requirements,
  });
}

export function patchSystemSettingsAsistencia(
  current: SystemSettings,
  asistenciaPatch: Partial<AsistenciaSettings>
): SystemSettings {
  return {
    ...current,
    asistencia: patchAsistenciaSettings(current.asistencia, asistenciaPatch),
  };
}
