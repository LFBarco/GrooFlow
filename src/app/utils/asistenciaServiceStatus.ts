import type {
  AsistenciaLiveStatus,
  AsistenciaServiceStatus,
} from '../types/asistencia';
import { ASISTENCIA_SERVICE_STATUS_LABELS } from '../types/asistencia';

/** Estado de servicio efectivo (default: en servicio). */
export function resolveStaffServiceStatus(
  status?: AsistenciaServiceStatus | null
): AsistenciaServiceStatus {
  return status === 'vacation' || status === 'not_in_service' ? status : 'active';
}

export function isStaffOutOfService(status?: AsistenciaServiceStatus | null): boolean {
  return resolveStaffServiceStatus(status) !== 'active';
}

/** ¿Mostrar en organigrama? Default true. */
export function shouldShowStaffOnOrgChart(showOnOrgChart?: boolean | null): boolean {
  return showOnOrgChart !== false;
}

export function serviceStatusLiveNote(status: AsistenciaServiceStatus): string {
  return ASISTENCIA_SERVICE_STATUS_LABELS[status];
}

export function serviceStatusToLiveStatus(
  status: AsistenciaServiceStatus
): Extract<AsistenciaLiveStatus, 'vacaciones' | 'ausente'> {
  return status === 'vacation' ? 'vacaciones' : 'ausente';
}
