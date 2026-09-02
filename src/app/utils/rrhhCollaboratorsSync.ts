import type { SystemSettings } from '../types';
import type { BukPeEmployeeRow, RrhhSyncStats } from '../types/rrhh';
import { mergeAsistenciaSettings } from './asistenciaData';
import { fetchBukAsistenciaAll, normalizeBukToken } from './bukAsistenciaApi';
import { fetchAllBukPeEmployees } from './bukPeEmployeesApi';
import { enrichEmployeesWithAsistencia } from './rrhhAsistenciaEnrich';
import { formatSyncStatsMessage, mergeEmployeesIncremental } from './rrhhSync';

export type RrhhCollaboratorsSyncResult = {
  ok: boolean;
  message: string;
  employees: BukPeEmployeeRow[];
  stats?: RrhhSyncStats;
  asistenciaMatched?: number;
  durationMs?: number;
};

export async function syncRrhhCollaborators(input: {
  systemSettings: SystemSettings;
  existingEmployees: BukPeEmployeeRow[];
  includeAsistencia?: boolean;
  onProgress?: (label: string) => void;
}): Promise<RrhhCollaboratorsSyncResult> {
  const start = Date.now();
  const includeAsistencia = input.includeAsistencia !== false;

  input.onProgress?.('Descargando maestro Buk.pe…');
  const peResult = await fetchAllBukPeEmployees({ bukPe: input.systemSettings.bukPe });
  if (!peResult.ok) {
    return {
      ok: false,
      message: peResult.message,
      employees: input.existingEmployees,
      durationMs: Date.now() - start,
    };
  }

  let employees = peResult.employees;
  let asistenciaMatched = 0;

  const asistencia = mergeAsistenciaSettings(input.systemSettings.asistencia);
  const bukAsist = asistencia.buk;
  const asistenciaToken = normalizeBukToken(bukAsist?.apiToken ?? '');
  const canFetchAsistencia =
    includeAsistencia && bukAsist?.enabled && asistenciaToken && !asistenciaToken.includes('*');

  if (canFetchAsistencia) {
    try {
      input.onProgress?.('Enriqueciendo con asistencia Buk (Ctrlit)…');
      const records = await fetchBukAsistenciaAll({
        baseUrl: bukAsist?.apiBaseUrl ?? '',
        apiToken: asistenciaToken,
        maxPages: 20,
      });
      const enriched = enrichEmployeesWithAsistencia(employees, records);
      employees = enriched.employees;
      asistenciaMatched = enriched.matched;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Buk.pe OK pero falló asistencia: ${msg}`,
        employees: input.existingEmployees,
        durationMs: Date.now() - start,
      };
    }
  }

  const { employees: merged, stats } = mergeEmployeesIncremental(input.existingEmployees, employees);
  const message = formatSyncStatsMessage(stats, asistenciaMatched);

  return {
    ok: true,
    message,
    employees: merged,
    stats,
    asistenciaMatched,
    durationMs: Date.now() - start,
  };
}
