import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { getGrooflowBackend } from '../config/backend';
import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import {
  ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
  ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
} from '../types/asistencia';
import { asistenciaRutMatchKey } from './asistenciaRut';
import {
  inferWorkShiftFromBukTurno,
  parseBukTurnoStartHhmm,
} from './asistenciaShift';
import {
  ctrlitApiRootFromV2Base,
  normalizeBukToken,
  sanitizeBukBaseUrl,
} from './bukAsistenciaApi';

export type BukAsignacionTurnoRow = {
  dni?: string;
  DNI?: string;
  nombreTrabajador?: string;
  nombreTurno?: string;
  horarioTurno?: string;
  idTurno?: string | number;
  areaTrabajador?: string;
  idRecinto?: string | number;
  [key: string]: unknown;
};

export type ApplyBukTurnosResult = {
  updated: number;
  matched: number;
  totalApi: number;
  settings: AsistenciaSettings;
};

async function postBukProxyTurnos(body: Record<string, unknown>): Promise<Response> {
  const backend = getGrooflowBackend();
  if (backend !== 'rest') {
    throw new Error('La sincronización de turnos requiere backend REST GrooFlow.');
  }
  const token = getGrooflowToken();
  if (!token) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
  return fetch(`${getGrooflowApiBase()}/proxy/buk/fetch-turnos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/** Descarga getAsignacionTurnos vía proxy. */
export async function fetchBukAsignacionTurnos(input: {
  baseUrl: string;
  apiToken: string;
}): Promise<BukAsignacionTurnoRow[]> {
  const baseUrl = sanitizeBukBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);
  const res = await postBukProxyTurnos({ baseUrl, apiToken });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    records?: BukAsignacionTurnoRow[];
    error?: string;
    message?: string;
  };
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? json.message ?? `HTTP ${res.status}`));
  }
  return Array.isArray(json.records) ? json.records : [];
}

function indexTurnosByDni(rows: BukAsignacionTurnoRow[]): Map<string, BukAsignacionTurnoRow> {
  const map = new Map<string, BukAsignacionTurnoRow>();
  for (const row of rows) {
    const key = asistenciaRutMatchKey(String(row.dni ?? row.DNI ?? ''));
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

/**
 * Aplica turnos Ctrlit al staff de Asistencia.
 * Siempre actualiza bukTurno*; `shift`/horas solo si no hay override manual.
 */
export function applyBukTurnosToAsistenciaStaff(
  settings: AsistenciaSettings,
  rows: BukAsignacionTurnoRow[]
): ApplyBukTurnosResult {
  const byDni = indexTurnosByDni(rows);
  let matched = 0;
  let updated = 0;
  const staff = (settings.staff ?? []).map((s) => {
    const key = asistenciaRutMatchKey(s.rut);
    if (!key) return s;
    const row = byDni.get(key);
    if (!row) return s;
    matched++;
    const nombre = String(row.nombreTurno ?? '').trim();
    const horario = String(row.horarioTurno ?? '').trim();
    const codigo = String(row.idTurno ?? '').trim();
    const inferred = inferWorkShiftFromBukTurno(nombre, horario === '-' ? '' : horario);
    const startHhmm = parseBukTurnoStartHhmm(horario === '-' ? '' : horario);

    const next: AsistenciaStaffMember = {
      ...s,
      bukTurnoNombre: nombre || s.bukTurnoNombre,
      bukTurnoHorario: horario && horario !== '-' ? horario : s.bukTurnoHorario,
      bukTurnoCodigo: codigo || s.bukTurnoCodigo,
    };

    if (!s.shiftManualOverride) {
      next.shift = inferred;
      if (inferred === 'night') {
        next.expectedTimeNight =
          startHhmm || s.expectedTimeNight || ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME;
      } else {
        next.expectedTime =
          startHhmm || s.expectedTime || ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME;
      }
    }

    const changed =
      next.bukTurnoNombre !== s.bukTurnoNombre ||
      next.bukTurnoHorario !== s.bukTurnoHorario ||
      next.bukTurnoCodigo !== s.bukTurnoCodigo ||
      next.shift !== s.shift ||
      next.expectedTime !== s.expectedTime ||
      next.expectedTimeNight !== s.expectedTimeNight;
    if (changed) updated++;
    return next;
  });

  return {
    updated,
    matched,
    totalApi: rows.length,
    settings: { ...settings, staff },
  };
}

export function ctrlitTurnosHintUrl(baseUrl: string): string {
  return `${ctrlitApiRootFromV2Base(baseUrl)}/getAsignacionTurnos`;
}
