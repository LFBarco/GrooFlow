import type { User } from '../types';
import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import type { TurnosRosterEntry } from '../types/turnos';
import { mergeAsistenciaSettings } from './asistenciaData';
import { RRHH_IDENTITY_POLICY } from './rrhhIdentityPolicy';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function mapWorkAreaFromAsistencia(area: string): string | undefined {
  const a = area.trim().toLowerCase();
  if (a === 'medica') return 'Médica';
  if (a === 'peluqueria') return 'Grooming';
  if (a === 'administracion') return 'Administración';
  return area || undefined;
}

function docKey(raw?: string | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

function rosterKey(entry: Pick<TurnosRosterEntry, 'source' | 'userId' | 'asistenciaStaffId' | 'fullName' | 'bukEmployeeId'>): string {
  if (entry.asistenciaStaffId) return `asist:${entry.asistenciaStaffId}`;
  if (entry.bukEmployeeId) return `buk:${entry.bukEmployeeId}`;
  if (entry.userId) return `user:${entry.userId}`;
  return `manual:${entry.fullName.trim().toLowerCase()}`;
}

function findLinkedUser(staff: AsistenciaStaffMember, users: User[]): User | undefined {
  const uid = String(staff.usuarioId ?? '').trim();
  if (uid) {
    const byId = users.find((u) => u.id === uid && u.status !== 'inactive');
    if (byId) return byId;
  }
  const email = staff.email?.trim().toLowerCase();
  if (email) {
    const byEmail = users.find((u) => u.email?.trim().toLowerCase() === email && u.status !== 'inactive');
    if (byEmail) return byEmail;
  }
  const rut = docKey(staff.rut);
  if (rut) {
    const byDoc = users.find((u) => docKey(u.documentNumber) === rut && u.status !== 'inactive');
    if (byDoc) return byDoc;
  }
  return undefined;
}

/**
 * Roster Fase 5: organigrama Asistencia (maestro Buk.pe proyectado) + externos manuales.
 * No usa la lista completa de usuarios Gestión como filas de grilla.
 * Si aún no hay staff en organigrama, cae al legado users+asistencia.
 */
export function buildRosterFromSources(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  existing?: TurnosRosterEntry[];
}): TurnosRosterEntry[] {
  const map = new Map<string, TurnosRosterEntry>();
  const asistencia = mergeAsistenciaSettings(input.asistencia);
  const staffList = asistencia.staff ?? [];
  const hasOrganigrama = staffList.length > 0;

  // Conservar solo manuales/externos del roster previo.
  for (const e of input.existing ?? []) {
    if (e.source === 'manual' || e.isExternal) {
      map.set(rosterKey(e), { ...e, source: 'manual', active: e.active !== false });
    }
  }

  if (hasOrganigrama) {
    for (const s of staffList) {
      const linked = findLinkedUser(s, input.users);
      const entry: TurnosRosterEntry = {
        id: `asist-${s.id}`,
        source: 'organigrama',
        asistenciaStaffId: s.id,
        bukEmployeeId: s.bukEmployeeId,
        userId: linked?.id ?? (s.usuarioId ? String(s.usuarioId) : undefined),
        fullName: s.fullName,
        initials: initialsFromName(s.fullName),
        roleLabel: s.cargoLabel || 'Colaborador',
        workArea: s.area ? mapWorkAreaFromAsistencia(s.area) : undefined,
        homeSede: s.sedeName,
        email: s.email ?? linked?.email,
        active: true,
        sortOrder: s.sortOrder,
      };
      map.set(rosterKey(entry), entry);
    }
  } else {
    // Fallback legado mientras no haya proyección Fase 4.
    for (const u of input.users) {
      if (u.status === 'inactive') continue;
      const homeSede = u.sedes?.[0] ?? u.location ?? 'Principal';
      const entry: TurnosRosterEntry = {
        id: `user-${u.id}`,
        source: 'user',
        userId: u.id,
        fullName: u.name,
        initials: u.initials || initialsFromName(u.name),
        roleLabel: u.jobTitle || u.role,
        workArea: u.workArea || undefined,
        homeSede,
        email: u.email,
        active: true,
      };
      map.set(rosterKey(entry), entry);
    }
    for (const s of staffList) {
      const entry: TurnosRosterEntry = {
        id: `asist-${s.id}`,
        source: 'asistencia',
        asistenciaStaffId: s.id,
        fullName: s.fullName,
        initials: initialsFromName(s.fullName),
        roleLabel: s.cargoLabel,
        workArea: s.area ? mapWorkAreaFromAsistencia(s.area) : undefined,
        homeSede: s.sedeName,
        email: s.email,
        active: true,
        sortOrder: s.sortOrder,
      };
      map.set(rosterKey(entry), entry);
    }
  }

  // Conservar ids antiguos con asignaciones: si existía user-* y ahora hay organigrama
  // con el mismo userId, las asignaciones siguen apuntando a user-*; el bridge de plan vs real
  // también usa asistenciaStaffId. Opcional: remap no lo hacemos aquí para no romper historial.

  return [...map.values()]
    .filter((r) => r.active)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.homeSede.localeCompare(b.homeSede, 'es') ||
        a.fullName.localeCompare(b.fullName, 'es')
    );
}

export { rosterKey };

/** ¿Puede gestionar (editar/publicar) la grilla de una sede? Política: encargado_sede. */
export function canManageTurnosSede(
  user: User | null | undefined,
  workSede: string,
  opts?: { hasTurnosPermission?: boolean; isAdmin?: boolean }
): boolean {
  if (!user || user.status === 'inactive') return false;
  if (opts?.hasTurnosPermission === false) return false;
  if (opts?.isAdmin || user.allSedes === true) return true;
  if (!workSede || workSede === 'Todas') {
    // Vista consolidada: con permiso Turnos puede editar; publicar exige sede concreta.
    return true;
  }
  const target = workSede.trim().toLowerCase();
  const sedes = user.sedes ?? [];
  if (sedes.some((s) => s.trim().toLowerCase() === target)) return true;
  if (user.location && user.location.trim().toLowerCase() === target) return true;
  return false;
}

export function canPublishTurnosWeek(
  user: User | null | undefined,
  workSede: string,
  opts?: { hasTurnosPermission?: boolean; isAdmin?: boolean }
): boolean {
  if (!workSede || workSede === 'Todas') return false;
  if (opts?.hasTurnosPermission === false) return false;
  if (opts?.isAdmin || user?.allSedes === true) return true;
  // Política Fase 0: publica el encargado de sede (usuario con esa sede + permiso Turnos).
  if (RRHH_IDENTITY_POLICY.turnosPublica !== 'encargado_sede') {
    return canManageTurnosSede(user, workSede, opts);
  }
  return canManageTurnosSede(user, workSede, opts);
}

export function isEncargadoSedeRole(user: User): boolean {
  const blob = [user.role, user.roleLabel, user.nivelNombre, user.jobTitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /encargado|supervisor\s*sede|jefe\s*de\s*sede|jefe\s*sede/.test(blob);
}
