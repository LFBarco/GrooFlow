import type { User } from '../types';
import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import { ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';

function newStaffId() {
  return `staff_${Math.random().toString(36).slice(2, 9)}`;
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

function staffKey(name: string, sede: string): string {
  return `${name.trim().toLowerCase()}::${sede.trim().toLowerCase()}`;
}

export type StaffSyncResult = {
  settings: AsistenciaSettings;
  added: number;
  updated: number;
  skipped: number;
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

  const index = new Map(staff.map((s) => [staffKey(s.fullName, s.sedeName), s]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const sede = u.sedes?.[0] ?? u.location ?? 'Principal';
    if (!targetSet.has(sede)) {
      skipped += 1;
      continue;
    }

    const key = staffKey(u.name, sede);
    const existing = index.get(key) ?? staff.find(
      (s) => s.email && u.email && s.email.toLowerCase() === u.email.toLowerCase() && s.sedeName === sede
    );

    const patch: Partial<AsistenciaStaffMember> = {
      fullName: u.name,
      cargoLabel: u.jobTitle?.trim() || u.role || 'Colaborador',
      email: u.email,
      avatarUrl: u.avatarUrl,
    };

    if (existing) {
      // No pisar overrides operativos (área / crítico / manager / turnos).
      Object.assign(existing, patch);
      if (!existing.usuarioId && u.id) existing.usuarioId = u.id;
      updated += 1;
    } else {
      const member: AsistenciaStaffMember = {
        id: newStaffId(),
        sedeName: sede,
        fullName: u.name,
        cargoLabel: patch.cargoLabel!,
        area: mapUserWorkAreaToAsistenciaColumn(u.workArea, u.jobTitle),
        expectedTime: ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
        shift: 'day',
        isCritical: false,
        email: u.email,
        avatarUrl: u.avatarUrl,
        usuarioId: u.id,
        source: 'users',
      };
      staff.push(member);
      index.set(key, member);
      added += 1;
    }
  }

  return {
    settings: { ...merged, staff },
    added,
    updated,
    skipped,
  };
}
