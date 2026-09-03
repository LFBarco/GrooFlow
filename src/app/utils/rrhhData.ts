import type { RrhhSettings } from '../types/rrhh';
import { defaultRrhhVisibleColumns } from './bukPeEmployeeUtils';

export const RRHH_SETTINGS_KV_KEY = 'settings:rrhh';

export function defaultRrhhSettings(): RrhhSettings {
  return {
    visibleColumns: defaultRrhhVisibleColumns(),
    autoDisableOnTermination: true,
    includeAsistenciaEnrichment: true,
    staffSyncEnabled: true,
    staffSyncIntervalMinutes: 60,
    employees: [],
    userLinks: [],
    syncLog: [],
  };
}

export function mergeRrhhSettings(partial?: Partial<RrhhSettings> | null): RrhhSettings {
  const base = defaultRrhhSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  return {
    ...base,
    ...partial,
    visibleColumns:
      Array.isArray(partial.visibleColumns) && partial.visibleColumns.length > 0
        ? partial.visibleColumns
        : base.visibleColumns,
    // Maestro vive en MySQL; nunca rehidratar el array legacy desde KV.
    employees: [],
    userLinks: Array.isArray(partial.userLinks) ? partial.userLinks : base.userLinks,
    syncLog: Array.isArray(partial.syncLog) ? partial.syncLog.slice(0, 30) : base.syncLog,
  };
}
