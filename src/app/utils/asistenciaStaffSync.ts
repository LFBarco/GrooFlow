import type { User } from '../types';
import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import { ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';

function newStaffId() {
  return `staff_${Math.random().toString(36).slice(2, 9)}`;
}

/** DNI/RUT solo dígitos para cruce canónico. */
export function normalizeStaffDocKey(raw?: string | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

export function mapUserWorkAreaToAsistenciaColumn(workArea?: string, jobTitle?: string): string {
  const w = `${workArea ?? ''} ${jobTitle ?? ''}`.toLowerCase();
  if (w.includes('méd') || w.includes('medic') || w.includes('vet') || w.includes('asistente')) {
    return 'medica';
  }
  if (w.includes('groom') || w.includes('pelu') || w.includes('bañ') || w.includes('banad')) {
    return 'peluqueria';
  }
  return 'administracion';
}

function staffNameSedeKey(name: string, sede: string): string {
  return `${normalizePersonName(name)}::${sede.trim().toLowerCase()}`;
}

/** Busca ficha existente por identidad estable (usuario → RUT → email → nombre+sede). */
export function findStaffMatch(
  staff: AsistenciaStaffMember[],
  candidate: {
    usuarioId?: string;
    documentNumber?: string;
    email?: string;
    fullName: string;
    sedeName: string;
  }
): AsistenciaStaffMember | undefined {
  const uid = String(candidate.usuarioId ?? '').trim();
  if (uid) {
    const byUser = staff.find((s) => String(s.usuarioId ?? '').trim() === uid);
    if (byUser) return byUser;
  }
  const doc = normalizeStaffDocKey(candidate.documentNumber);
  if (doc) {
    const byDoc = staff.find((s) => normalizeStaffDocKey(s.rut) === doc);
    if (byDoc) return byDoc;
  }
  const email = candidate.email?.trim().toLowerCase();
  if (email) {
    const byEmail = staff.find(
      (s) =>
        s.email?.trim().toLowerCase() === email &&
        s.sedeName.trim().toLowerCase() === candidate.sedeName.trim().toLowerCase()
    );
    if (byEmail) return byEmail;
  }
  const nameKey = staffNameSedeKey(candidate.fullName, candidate.sedeName);
  return staff.find((s) => staffNameSedeKey(s.fullName, s.sedeName) === nameKey);
}

export type StaffSyncResult = {
  settings: AsistenciaSettings;
  added: number;
  updated: number;
  skipped: number;
  /** Usuarios que ya estaban (mismo RUT/usuario) y solo se vincularon/actualizaron. */
  linked: number;
};

export function syncStaffFromUsers(input: {
  users: User[];
  settings: AsistenciaSettings;
  sedeNames: string[];
  /** Si true, reemplaza personal en las sedes objetivo antes de importar. */
  replaceTargetSedes?: boolean;
}): StaffSyncResult {
  const merged = mergeAsistenciaSettings(input.settings);
  const targetSet = new Set(input.sedeNames);
  let staff = [...(merged.staff ?? [])];

  if (input.replaceTargetSedes) {
    staff = staff.filter((s) => !targetSet.has(s.sedeName));
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let linked = 0;

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const sede = u.sedes?.[0] ?? u.location ?? 'Principal';
    if (!targetSet.has(sede)) {
      skipped += 1;
      continue;
    }

    const doc = normalizeStaffDocKey(u.documentNumber);
    const existing = findStaffMatch(staff, {
      usuarioId: u.id,
      documentNumber: u.documentNumber,
      email: u.email,
      fullName: u.name,
      sedeName: sede,
    });

    const patch: Partial<AsistenciaStaffMember> = {
      fullName: u.name,
      cargoLabel: u.jobTitle?.trim() || u.role || 'Colaborador',
      email: u.email,
      avatarUrl: u.avatarUrl,
      usuarioId: u.id,
      source: existing?.source === 'buk_pe' ? 'buk_pe' : existing?.source === 'manual' ? 'manual' : 'users',
    };
    if (doc && !existing?.rut) {
      patch.rut = u.documentNumber?.trim() || doc;
    } else if (doc && existing?.rut && normalizeStaffDocKey(existing.rut) !== doc) {
      // Preferir DNI de Gestión si la ficha no tenía RUT usable.
      if (!normalizeStaffDocKey(existing.rut)) patch.rut = u.documentNumber?.trim() || doc;
    } else if (doc && !existing) {
      patch.rut = u.documentNumber?.trim() || doc;
    }
    if (!existing?.sedeBase) {
      patch.sedeBase = sede;
    }

    if (existing) {
      // No pisar overrides operativos (área / crítico / manager / turnos / sede plantilla).
      Object.assign(existing, patch);
      if (!existing.usuarioId && u.id) existing.usuarioId = u.id;
      // Si estaba en otra sede por nombre raro pero mismo RUT, no mover sedeName automáticamente.
      updated += 1;
      linked += 1;
    } else {
      const member: AsistenciaStaffMember = {
        id: newStaffId(),
        sedeName: sede,
        sedeBase: sede,
        fullName: u.name,
        cargoLabel: patch.cargoLabel!,
        area: mapUserWorkAreaToAsistenciaColumn(u.workArea, u.jobTitle),
        expectedTime: ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
        shift: 'day',
        isCritical: false,
        email: u.email,
        avatarUrl: u.avatarUrl,
        usuarioId: u.id,
        rut: patch.rut,
        source: 'users',
      };
      staff.push(member);
      added += 1;
    }
  }

  return {
    settings: { ...merged, staff },
    added,
    updated,
    skipped,
    linked,
  };
}

/**
 * Aplica nombre/cargo de Gestión sobre el staff de Asistencia (sin perder área/crítico/manager).
 * No pisa `sedeName` (plantilla); solo rellena `sedeBase` si falta.
 */
export function enrichStaffDisplayFromUsers(
  staff: AsistenciaStaffMember[],
  users: User[]
): AsistenciaStaffMember[] {
  if (!users.length) return staff;
  const byId = new Map(users.filter((u) => u.status !== 'inactive').map((u) => [u.id, u]));
  const byEmail = new Map<string, User>();
  const byDoc = new Map<string, User>();
  for (const u of users) {
    if (u.status === 'inactive') continue;
    const em = u.email?.trim().toLowerCase();
    if (em) byEmail.set(em, u);
    const d = normalizeStaffDocKey(u.documentNumber);
    if (d) byDoc.set(d, u);
  }

  return staff.map((s) => {
    const uid = String(s.usuarioId ?? '').trim();
    const linked =
      (uid ? byId.get(uid) : undefined) ||
      (s.email ? byEmail.get(s.email.trim().toLowerCase()) : undefined) ||
      (s.rut ? byDoc.get(normalizeStaffDocKey(s.rut)) : undefined);
    if (!linked) return s;
    const gestionSede = linked.sedes?.[0]?.trim() || linked.location?.trim() || undefined;
    return {
      ...s,
      fullName: linked.name?.trim() || s.fullName,
      cargoLabel: linked.jobTitle?.trim() || s.cargoLabel,
      email: linked.email ?? s.email,
      avatarUrl: linked.avatarUrl ?? s.avatarUrl,
      usuarioId: linked.id,
      rut: s.rut || linked.documentNumber || s.rut,
      sedeBase: s.sedeBase || gestionSede || s.sedeName,
      // sedeName = plantilla del organigrama; no sobrescribir con Gestión.
    };
  });
}

export type SedeStaffDiagnosis = {
  withoutRut: AsistenciaStaffMember[];
  /** Grupos con mismo nombre normalizado en la sede (posible duplicado). */
  duplicateNameGroups: { name: string; members: AsistenciaStaffMember[] }[];
  /** Mismo RUT en más de una ficha. */
  duplicateRutGroups: { rut: string; members: AsistenciaStaffMember[] }[];
};

/** Diagnóstico de calidad del personal de una sede (anti-duplicados / RUT). */
export function diagnoseSedeStaff(staff: AsistenciaStaffMember[]): SedeStaffDiagnosis {
  const withoutRut = staff.filter((s) => !normalizeStaffDocKey(s.rut));

  const byName = new Map<string, AsistenciaStaffMember[]>();
  for (const s of staff) {
    const key = normalizePersonName(s.fullName);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(s);
    byName.set(key, list);
  }
  const duplicateNameGroups = [...byName.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([name, members]) => ({ name: members[0]!.fullName, members }));

  const byRut = new Map<string, AsistenciaStaffMember[]>();
  for (const s of staff) {
    const key = normalizeStaffDocKey(s.rut);
    if (!key) continue;
    const list = byRut.get(key) ?? [];
    list.push(s);
    byRut.set(key, list);
  }
  const duplicateRutGroups = [...byRut.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([rut, members]) => ({ rut, members }));

  return { withoutRut, duplicateNameGroups, duplicateRutGroups };
}

/**
 * Mantiene perfil de sede y mapa sede→recinto alineados (una sola fuente de verdad).
 */
export function syncBukRecintoCodeInSettings(
  settings: AsistenciaSettings,
  sedeName: string,
  bukRecintoCode: string | undefined
): AsistenciaSettings {
  const code = bukRecintoCode?.trim() || undefined;
  const profiles = [...(settings.sedeProfiles ?? [])];
  const idx = profiles.findIndex((p) => p.sedeName === sedeName);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx]!, bukRecintoCode: code };
  } else if (code) {
    profiles.push({
      sedeName,
      scheduleStart: '08:00',
      scheduleEnd: '18:00',
      bukRecintoCode: code,
    });
  }
  const mappings = (settings.sedeMappings ?? []).filter((m) => m.sedeName !== sedeName);
  if (code) {
    mappings.push({ sedeName, bukRecintoCode: code });
  }
  return mergeAsistenciaSettings({
    ...settings,
    sedeProfiles: profiles,
    sedeMappings: mappings,
  });
}
