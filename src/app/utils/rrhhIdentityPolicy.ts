import type { BukPeEmployeeRow, RrhhIdentityStatus } from '../types/rrhh';

/**
 * Política de identidad — operativa.
 * Gestión = maestro de persona/cargo en GrooFlow.
 * Buk.pe = comparativa laboral (vínculo, altas/bajas).
 * Buk Ctrlit = solo marcaciones de asistencia.
 */
export const RRHH_IDENTITY_POLICY = {
  sourceOfTruth: 'gestion' as const,
  /** Buk.pe solo para cruce / diagnóstico, no define cargo en UI. */
  bukRole: 'comparativa' as const,
  /** No crear usuario automático; dejar pendiente + notificar. */
  altaSinUsuario: 'pendiente_notificacion' as const,
  /** Cesado en Buk: desactivar acceso Gestión y sacar del organigrama. */
  cesadoDesactivaAccesoYOrganigrama: true,
  /** Grilla semanal la publica el encargado de sede (no RRHH central). */
  turnosPublica: 'encargado_sede' as const,
  /** Campos oficiales de operación salen de Gestión. */
  camposOficialesGestion: ['nombre', 'dni', 'cargo', 'sede', 'activo'] as const,
  /** Buk aporta señales laborales / marcaciones. */
  camposComparativaBuk: ['dni', 'activo', 'cesado', 'marcaciones'] as const,
  camposEditablesGrooflow: ['area_organigrama', 'critico', 'manager'] as const,
};

export const RRHH_IDENTITY_POLICY_LABELS: Record<string, string> = {
  gestion: 'Gestión (maestro de persona y cargo)',
  comparativa: 'Buk.pe solo comparativa / vínculo',
  pendiente_notificacion: 'Pendiente + notificación (sin auto-crear acceso)',
  encargado_sede: 'Encargado de sede',
};

export const RRHH_IDENTITY_STATUS_LABELS: Record<RrhhIdentityStatus, string> = {
  linked: 'Vinculado',
  pending_access: 'Pendiente acceso',
  terminated_still_active: 'Cesado · acceso activo',
  terminated: 'Cesado',
  unmatched_doc: 'Sin DNI',
  unmatched: 'Sin cruce',
};

export function resolveIdentityStatus(
  emp: Pick<BukPeEmployeeRow, 'isTerminated' | 'documentNumber' | 'documentKey' | 'linkedUsuarioId' | 'identityStatus'>,
  linkedUserId?: string | null
): RrhhIdentityStatus {
  if (emp.identityStatus) return emp.identityStatus;
  const linked = String(linkedUserId ?? emp.linkedUsuarioId ?? '').trim();
  const doc = String(emp.documentKey ?? emp.documentNumber ?? '').replace(/\D+/g, '');
  if (emp.isTerminated) return linked ? 'terminated_still_active' : 'terminated';
  if (linked) return 'linked';
  if (!doc) return 'unmatched_doc';
  return 'pending_access';
}
