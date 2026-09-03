import type { BukPeEmployeeRow, RrhhColumnDef, RrhhDashboardKpis, RrhhRecommendation, RrhhUserLink } from '../types/rrhh';
import type { User } from '../types';

const TERMINATED_STATUSES = new Set(['inactivo', 'desvinculado', 'terminated', 'inactive', 'baja']);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function roleName(role: unknown): string | undefined {
  const r = asRecord(role);
  return asString(r?.name);
}

function roleFamily(role: unknown): string | undefined {
  const r = asRecord(role);
  const fam = asRecord(r?.role_family);
  return asString(fam?.name);
}

export function isBukPeEmployeeTerminated(status: string | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return TERMINATED_STATUSES.has(s);
}

export function normalizeBukPeEmployee(raw: Record<string, unknown>): BukPeEmployeeRow {
  const currentJob = asRecord(raw.current_job);
  const role = currentJob?.role;
  const status = asString(raw.status) ?? 'desconocido';
  const endDate = asString(currentJob?.end_date) ?? asString(raw.active_until);

  return {
    bukId: Number(raw.id ?? 0),
    personId: raw.person_id != null ? Number(raw.person_id) : undefined,
    fullName: asString(raw.full_name) ?? asString(raw.first_name) ?? 'Sin nombre',
    firstName: asString(raw.first_name),
    surname: asString(raw.surname),
    documentType: asString(raw.document_type),
    documentNumber: asString(raw.document_number),
    email: asString(raw.email),
    personalEmail: asString(raw.personal_email),
    phone: asString(raw.phone) ?? asString(raw.office_phone),
    status,
    isActive: !isBukPeEmployeeTerminated(status),
    isTerminated: isBukPeEmployeeTerminated(status),
    birthday: asString(raw.birthday),
    gender: asString(raw.gender),
    nationality: asString(raw.nationality),
    address: asString(raw.address),
    distrito: asString(raw.distrito),
    departamento: asString(raw.departamento),
    cargo: roleName(role),
    cargoCode: asRecord(role)?.code ? asString(asRecord(role)?.code) : undefined,
    area: roleFamily(role),
    sede: asString(currentJob?.recinto_primario) ?? asString(raw.location_id),
    contractType: asString(currentJob?.contract_type),
    startDate: asString(currentJob?.start_date) ?? asString(raw.active_since),
    endDate: endDate,
    activeSince: asString(raw.active_since),
    activeUntil: asString(raw.active_until),
    pensionFund: asString(raw.pension_fund),
    healthCompany: asString(raw.health_company),
    paymentMethod: asString(raw.payment_method),
    bank: asString(raw.bank),
    raw,
  };
}

export const RRHH_COLUMN_DEFS: RrhhColumnDef[] = [
  { id: 'fullName', label: 'Nombre completo', defaultVisible: true, group: 'Identidad' },
  { id: 'documentNumber', label: 'Documento', defaultVisible: true, group: 'Identidad' },
  { id: 'documentType', label: 'Tipo doc.', group: 'Identidad' },
  { id: 'email', label: 'Email corporativo', defaultVisible: true, group: 'Contacto' },
  { id: 'personalEmail', label: 'Email personal', group: 'Contacto' },
  { id: 'phone', label: 'Teléfono', defaultVisible: true, group: 'Contacto' },
  { id: 'status', label: 'Estado Buk', defaultVisible: true, group: 'Laboral' },
  { id: 'cargo', label: 'Cargo', defaultVisible: true, group: 'Laboral' },
  { id: 'area', label: 'Área / familia', defaultVisible: true, group: 'Laboral' },
  { id: 'sede', label: 'Sede / recinto', group: 'Laboral' },
  { id: 'contractType', label: 'Tipo contrato', group: 'Laboral' },
  { id: 'startDate', label: 'Inicio', defaultVisible: true, group: 'Laboral' },
  { id: 'endDate', label: 'Fin / baja', defaultVisible: true, group: 'Laboral' },
  { id: 'birthday', label: 'Nacimiento', group: 'Personal' },
  { id: 'gender', label: 'Género', group: 'Personal' },
  { id: 'nationality', label: 'Nacionalidad', group: 'Personal' },
  { id: 'address', label: 'Dirección', group: 'Personal' },
  { id: 'distrito', label: 'Distrito', group: 'Personal' },
  { id: 'departamento', label: 'Departamento', group: 'Personal' },
  { id: 'pensionFund', label: 'AFP', group: 'Planilla' },
  { id: 'healthCompany', label: 'EPS / salud', group: 'Planilla' },
  { id: 'paymentMethod', label: 'Forma pago', group: 'Planilla' },
  { id: 'bank', label: 'Banco', group: 'Planilla' },
  { id: 'bukId', label: 'ID Buk', group: 'Sistema' },
  { id: 'rutAsistencia', label: 'RUT asistencia', group: 'Asistencia (Ctrlit)' },
  { id: 'recintoLabel', label: 'Recinto asistencia', defaultVisible: true, group: 'Asistencia (Ctrlit)' },
  { id: 'areaAsistencia', label: 'Área asistencia', group: 'Asistencia (Ctrlit)' },
  { id: 'especialidad', label: 'Especialidad', group: 'Asistencia (Ctrlit)' },
  { id: 'supervisor', label: 'Supervisor', group: 'Asistencia (Ctrlit)' },
  { id: 'turnoAsistencia', label: 'Turno', defaultVisible: true, group: 'Asistencia (Ctrlit)' },
  { id: 'codigoTurno', label: 'Código turno', group: 'Asistencia (Ctrlit)' },
  { id: 'ultimaAsistenciaDia', label: 'Último día marcación', group: 'Asistencia (Ctrlit)' },
  { id: 'ultimaMarcacionEntrada', label: 'Última entrada', defaultVisible: true, group: 'Asistencia (Ctrlit)' },
  { id: 'ultimaMarcacionSalida', label: 'Última salida', group: 'Asistencia (Ctrlit)' },
  { id: 'turnoNoche', label: 'Turno noche', group: 'Asistencia (Ctrlit)' },
  { id: 'art22', label: 'Art. 22', group: 'Asistencia (Ctrlit)' },
];

export function defaultRrhhVisibleColumns(): string[] {
  return RRHH_COLUMN_DEFS.filter((c) => c.defaultVisible).map((c) => c.id);
}

export function getEmployeeCellValue(row: BukPeEmployeeRow, columnId: string): string {
  const v = row[columnId as keyof BukPeEmployeeRow];
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
}

function normEmail(v?: string): string {
  return (v ?? '').trim().toLowerCase();
}

function normDoc(v?: string): string {
  return (v ?? '').replace(/\D/g, '');
}

function normName(v?: string): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function autoLinkBukEmployeesToUsers(
  employees: BukPeEmployeeRow[],
  users: User[],
  existingLinks: RrhhUserLink[] = []
): RrhhUserLink[] {
  const byUserId = new Map(existingLinks.map((l) => [l.userId, l]));
  const usedBukIds = new Set(existingLinks.map((l) => l.bukEmployeeId));
  const now = new Date().toISOString();

  const activeUsers = users.filter((u) => u.status !== 'inactive');
  for (const emp of employees) {
    if (usedBukIds.has(emp.bukId)) continue;

    const empEmail = normEmail(emp.email);
    const empPersonal = normEmail(emp.personalEmail);
    const empDoc = normDoc(emp.documentNumber);
    const empName = normName(emp.fullName);

    let match: { user: User; method: RrhhUserLink['matchMethod'] } | null = null;

    for (const user of activeUsers) {
      if (byUserId.has(user.id)) continue;
      const uEmail = normEmail(user.email);
      if (empEmail && uEmail && empEmail === uEmail) {
        match = { user, method: 'email' };
        break;
      }
      if (empPersonal && uEmail && empPersonal === uEmail) {
        match = { user, method: 'personal_email' };
        break;
      }
    }

    if (!match && empDoc) {
      for (const user of activeUsers) {
        if (byUserId.has(user.id)) continue;
        const uDoc = normDoc((user as User & { documentNumber?: string }).documentNumber);
        if (uDoc && uDoc === empDoc) {
          match = { user, method: 'document' };
          break;
        }
      }
    }

    if (!match && empName) {
      for (const user of activeUsers) {
        if (byUserId.has(user.id)) continue;
        if (normName(user.name) === empName) {
          match = { user, method: 'name' };
          break;
        }
      }
    }

    if (!match) continue;

    const link: RrhhUserLink = {
      userId: match.user.id,
      bukEmployeeId: emp.bukId,
      matchMethod: match.method,
      linkedAt: now,
      employeeName: emp.fullName,
      employeeEmail: emp.email ?? emp.personalEmail,
    };
    byUserId.set(match.user.id, link);
    usedBukIds.add(emp.bukId);
  }

  return [...byUserId.values()];
}

export function findUserIdForEmployee(
  emp: BukPeEmployeeRow,
  links: RrhhUserLink[]
): string | undefined {
  return links.find((l) => l.bukEmployeeId === emp.bukId)?.userId;
}

export function computeRrhhDashboard(
  employees: BukPeEmployeeRow[],
  links: RrhhUserLink[],
  users: User[]
): RrhhDashboardKpis {
  const active = employees.filter((e) => e.isActive);
  const terminated = employees.filter((e) => e.isTerminated);
  const linkedBukIds = new Set(links.map((l) => l.bukEmployeeId));
  const linkedUserIds = new Set(links.map((l) => l.userId));

  const unlinkedActive = active.filter((e) => !linkedBukIds.has(e.bukId)).length;
  const withAsistencia = active.filter((e) => e.asistenciaEnriched).length;

  const pendingDisable = terminated.filter((e) => {
    const userId = findUserIdForEmployee(e, links);
    if (!userId) return false;
    const user = users.find((u) => u.id === userId);
    return user != null && user.status !== 'inactive';
  }).length;

  const countBy = (items: BukPeEmployeeRow[], pick: (e: BukPeEmployeeRow) => string | undefined) => {
    const map = new Map<string, number>();
    for (const e of items) {
      const key = pick(e)?.trim() || 'Sin dato';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  return {
    total: employees.length,
    active: active.length,
    terminated: terminated.length,
    linkedUsers: linkedUserIds.size,
    unlinkedActive,
    pendingDisable,
    withAsistencia,
    withoutAsistencia: Math.max(active.length - withAsistencia, 0),
    byArea: countBy(active, (e) => e.area),
    byCargo: countBy(active, (e) => e.cargo).map(({ area, count }) => ({ cargo: area, count })),
    byRecinto: countBy(active, (e) => e.recintoLabel || e.recintoNombre).map(({ area, count }) => ({
      recinto: area,
      count,
    })),
  };
}

export function buildRrhhRecommendations(
  kpis: RrhhDashboardKpis,
  employees: BukPeEmployeeRow[],
  links: RrhhUserLink[],
  autoDisable: boolean
): RrhhRecommendation[] {
  const recs: RrhhRecommendation[] = [];

  if (kpis.total === 0 && employees.length === 0) {
    recs.push({
      id: 'sync-empty',
      severity: 'action',
      title: 'Sincroniza con Buk.pe',
      detail: 'Aún no hay colaboradores en BD. Usa «Sincronizar colaboradores» para traer el maestro de empleados.',
    });
    return recs;
  }

  if (kpis.unlinkedActive > 0) {
    recs.push({
      id: 'unlink-active',
      severity: 'warning',
      title: `${kpis.unlinkedActive} activo(s) sin usuario GrooFlow`,
      detail: 'Vincula por email o documento para automatizar asistencia, turnos, uniformes y bajas.',
    });
  }

  if (kpis.pendingDisable > 0) {
    recs.push({
      id: 'pending-disable',
      severity: autoDisable ? 'info' : 'action',
      title: `${kpis.pendingDisable} baja(s) pendiente(s) en usuarios`,
      detail: autoDisable
        ? 'La sincronización deshabilitará usuarios vinculados con estado inactivo en Buk.'
        : 'Activa «Deshabilitar automáticamente en bajas» o hazlo manualmente desde la pestaña Bajas.',
    });
  }

  const recentTerminations = employees.filter((e) => e.isTerminated && e.endDate).length;
  if (recentTerminations > 0) {
    recs.push({
      id: 'review-bajas',
      severity: 'info',
      title: 'Revisa el registro de bajas',
      detail: `${recentTerminations} colaborador(es) con fecha de fin registrada en Buk.pe.`,
    });
  }

  const duplicateEmails = new Map<string, number>();
  for (const e of employees.filter((x) => x.isActive)) {
    const em = normEmail(e.email);
    if (!em) continue;
    duplicateEmails.set(em, (duplicateEmails.get(em) ?? 0) + 1);
  }
  const dups = [...duplicateEmails.values()].filter((n) => n > 1).length;
  if (dups > 0) {
    recs.push({
      id: 'dup-email',
      severity: 'warning',
      title: 'Emails corporativos duplicados en Buk',
      detail: 'Hay correos repetidos en el maestro; revisa la vinculación manual antes de automatizar.',
    });
  }

  if (links.length > 0 && kpis.linkedUsers / Math.max(kpis.active, 1) > 0.8) {
    recs.push({
      id: 'good-coverage',
      severity: 'info',
      title: 'Buena cobertura de vinculación',
      detail: 'La mayoría de activos ya tienen usuario en GrooFlow. Puedes activar bajas automáticas con confianza.',
    });
  }

  if (kpis.active > 0 && kpis.withoutAsistencia > 0) {
    const pct = Math.round((kpis.withAsistencia / kpis.active) * 100);
    recs.push({
      id: 'asistencia-coverage',
      severity: kpis.withAsistencia === 0 ? 'warning' : 'info',
      title: `Asistencia Buk: ${kpis.withAsistencia}/${kpis.active} activos (${pct}%)`,
      detail:
        kpis.withAsistencia === 0
          ? 'Activa Buk Asistencia en Integraciones y sincroniza de nuevo para ver recinto, turno y últimas marcaciones.'
          : `${kpis.withoutAsistencia} activo(s) sin cruce por RUT o nombre. Revisa documento en Buk.pe o el maestro de asistencia.`,
    });
  }

  const missingFromApi = employees.filter((e) => e.missingFromSource).length;
  if (missingFromApi > 0) {
    recs.push({
      id: 'stale-cache',
      severity: 'warning',
      title: `${missingFromApi} colaborador(es) ya no aparecen en Buk.pe`,
      detail: 'Se conservan en caché local. Si la baja es definitiva, revísalos en la pestaña Bajas.',
    });
  }

  return recs;
}

export function usersToDisableForTerminations(
  employees: BukPeEmployeeRow[],
  links: RrhhUserLink[],
  users: User[]
): User[] {
  const toDisable: User[] = [];
  for (const emp of employees.filter((e) => e.isTerminated)) {
    const userId = findUserIdForEmployee(emp, links);
    if (!userId) continue;
    const user = users.find((u) => u.id === userId);
    if (user && user.status !== 'inactive') {
      toDisable.push(user);
    }
  }
  return toDisable;
}
