import type { AsistenciaSettings, AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';

function staffId(sede: string, key: string): string {
  const slug = sede.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sede';
  return `ejemplo_${slug}_${key}`;
}

/** Personal de ejemplo para organigrama (persistible en settings). */
export function buildExampleStaffForSede(sedeName: string): AsistenciaStaffMember[] {
  const base: Omit<AsistenciaStaffMember, 'id' | 'sedeName'>[] = [
    {
      fullName: 'María Encargada',
      cargoLabel: 'Encargado de sede',
      area: 'administracion',
      expectedTime: '08:00',
      shift: 'day',
      isCritical: true,
      isManager: true,
      rut: '11111111-1',
      sortOrder: 0,
    },
    {
      fullName: 'Carla Counter',
      cargoLabel: 'Counter',
      area: 'administracion',
      expectedTime: '08:30',
      shift: 'day',
      isCritical: true,
      rut: '12222222-2',
      sortOrder: 1,
    },
    {
      fullName: 'Diego Veterinario',
      cargoLabel: 'Médico veterinario',
      area: 'medica',
      expectedTime: '09:00',
      shift: 'day',
      isCritical: true,
      matchArea: 'MEDICOS VETERINARIOS',
      matchSpecialty: 'MEDICO VETERINARIO',
      rut: '13333333-3',
      sortOrder: 0,
    },
    {
      fullName: 'Lucía Asistente',
      cargoLabel: 'Asistente veterinario',
      area: 'medica',
      expectedTime: '09:00',
      shift: 'day',
      isCritical: false,
      matchArea: 'ASISTENTES VETERINARIOS',
      rut: '14444444-4',
      sortOrder: 1,
    },
    {
      fullName: 'Sofía Peluquera',
      cargoLabel: 'Peluquero',
      area: 'peluqueria',
      expectedTime: '10:00',
      shift: 'day',
      isCritical: true,
      matchArea: 'PELUQUEROS',
      rut: '15555555-5',
      sortOrder: 0,
    },
    {
      fullName: 'Andrea Baño',
      cargoLabel: 'Bañador',
      area: 'peluqueria',
      expectedTime: '10:00',
      shift: 'day',
      isCritical: false,
      matchArea: 'BANADORES',
      rut: '16666666-6',
      sortOrder: 1,
    },
    {
      fullName: 'Pedro Nocturno',
      cargoLabel: 'Médico veterinario',
      area: 'medica',
      expectedTime: '20:00',
      expectedTimeNight: '20:00',
      shift: 'night',
      isCritical: true,
      matchArea: 'MEDICOS VETERINARIOS',
      rut: '17777777-7',
      sortOrder: 2,
    },
  ];

  return base.map((row, i) => ({
    ...row,
    id: staffId(sedeName, String(i + 1)),
    sedeName,
  }));
}

/** Marcaciones Buk de ejemplo para dashboard / cruce (solo en memoria / caché UI). */
export function buildExampleBukRecords(opts: {
  sedeName: string;
  dateYmd: string;
  staff: AsistenciaStaffMember[];
}): BukAsistenciaRecord[] {
  const { sedeName, dateYmd, staff } = opts;
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dayLabel = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  const recinto = sedeName.slice(0, 12) || 'Sede';

  return staff
    .filter((s) => !s.isManager || s.fullName.includes('Encargada'))
    .map((s, idx) => {
      const isNight = s.shift === 'night';
      const entradaHour = isNight ? 20 : 8 + (idx % 3);
      const entradaMin = isNight ? 5 : 15 + idx * 3;
      const late = idx % 4 === 3;
      const absent = idx % 5 === 4;
      const hh = late ? entradaHour + 1 : entradaHour;
      const mm = late ? entradaMin + 10 : entradaMin;
      const entradaFormat = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const iso = `${dateYmd}T${entradaFormat}:00-05:00`;

      return {
        id: 9000 + idx,
        trab_id: 9000 + idx,
        rut_trabajador: s.rut ?? `${10000000 + idx}-K`,
        apellido_paterno: s.fullName.split(' ').slice(-1)[0] ?? 'Demo',
        nombre: s.fullName.split(' ')[0] ?? s.fullName,
        codigo_recinto: recinto,
        nombre_recinto: sedeName,
        especialidad: s.matchSpecialty ?? s.cargoLabel.toUpperCase(),
        area: s.matchArea ?? s.cargoLabel.toUpperCase(),
        dia_entrada: dayLabel,
        entrada: absent ? null : iso,
        salida: absent || isNight ? null : `${dateYmd}T18:00:00-05:00`,
        entrada_format: absent ? undefined : entradaFormat,
        turno_noche: isNight,
      } satisfies BukAsistenciaRecord;
    });
}

export function mergeExampleStaffIntoSettings(
  settings: AsistenciaSettings | undefined,
  sedeName: string,
  options?: { replaceSede?: boolean }
): AsistenciaSettings {
  const current = mergeAsistenciaSettings(settings);
  const example = buildExampleStaffForSede(sedeName);
  const others = options?.replaceSede
    ? (current.staff ?? []).filter((s) => s.sedeName !== sedeName)
    : (current.staff ?? []).filter((s) => !s.id.startsWith('ejemplo_') || s.sedeName !== sedeName);

  const profiles = current.sedeProfiles ?? [];
  const hasProfile = profiles.some((p) => p.sedeName === sedeName);
  const nextProfiles = hasProfile
    ? profiles
    : [
        ...profiles,
        {
          sedeName,
          scheduleStart: '08:00',
          scheduleEnd: '20:00',
          scheduleNightStart: '20:00',
          scheduleNightEnd: '08:00',
          scheduleToleranceMinutes: 15,
        },
      ];

  return mergeAsistenciaSettings({
    ...current,
    staff: [...others, ...example],
    sedeProfiles: nextProfiles,
  });
}
