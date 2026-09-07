import type { BukPeEmployeeRow, RrhhIdentityStatus } from '../types/rrhh';

/**
 * Política de identidad — Fase 0 (decisiones de negocio).
 * Buk.pe = fuente laboral; Gestión = acceso; GrooFlow = operación.
 */
export const RRHH_IDENTITY_POLICY = {
  sourceOfTruth: 'buk.pe' as const,
  /** No crear usuario automático; dejar pendiente + notificar. */
  altaSinUsuario: 'pendiente_notificacion' as const,
  /** Cesado en Buk: desactivar acceso Gestión y sacar del organigrama. */
  cesadoDesactivaAccesoYOrganigrama: true,
  /** Grilla semanal la publica el encargado de sede (no RRHH central). */
  turnosPublica: 'encargado_sede' as const,
  camposOficialesBuk: ['dni', 'cargo', 'sede_obra', 'activo'] as const,
  camposEditablesGrooflow: ['area_organigrama', 'critico', 'manager'] as const,
};

export const RRHH_IDENTITY_POLICY_LABELS: Record<string, string> = {
  'buk.pe': 'Buk.pe (alta oficial de personal)',
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
