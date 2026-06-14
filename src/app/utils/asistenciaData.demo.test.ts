/**
 * Demo de flujo Asistencia: simula registros Buk y muestra el resumen del panel.
 * Ejecutar: npx vitest run src/app/utils/asistenciaData.demo.test.ts
 */
import { describe, expect, it } from 'vitest';

import type { BukAsistenciaRecord } from '../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS } from '../types/asistencia';
import {
  buildAsistenciaDaySummary,
  buildDefaultRequirementsForSede,
  mergeAsistenciaSettings,
} from './asistenciaData';

const HOY = '10/06/2026';

function mk(
  partial: Partial<BukAsistenciaRecord> & Pick<BukAsistenciaRecord, 'nombre' | 'area'>
): BukAsistenciaRecord {
  return {
    id: partial.id ?? Math.floor(Math.random() * 1e6),
    trab_id: partial.trab_id ?? partial.id ?? 1,
    rut_trabajador: partial.rut_trabajador ?? `1${String(partial.id ?? 1).padStart(8, '0')}-K`,
    apellido_paterno: partial.apellido_paterno ?? 'Demo',
    nombre: partial.nombre,
    codigo_recinto: partial.codigo_recinto ?? 'Petmax',
    nombre_recinto: partial.nombre_recinto ?? 'Petmax Principal',
    especialidad: partial.especialidad ?? partial.area,
    area: partial.area,
    dia_entrada: HOY,
    entrada: partial.entrada ?? '2026-06-10T08:30:00Z',
    salida: partial.salida ?? null,
    entrada_format: partial.entrada_format ?? '08:30',
  };
}

/** Registros de ejemplo inspirados en la API asistencia-empresa de Ctrlit. */
function sampleBukRecords(): BukAsistenciaRecord[] {
  return [
    mk({ id: 1, nombre: 'Carla', area: 'MEDICOS VETERINARIOS', especialidad: 'MEDICO VETERINARIO' }),
    mk({ id: 2, nombre: 'Diego', area: 'MEDICOS VETERINARIOS', especialidad: 'MEDICO VETERINARIO' }),
    mk({ id: 3, nombre: 'Lucía', area: 'ASISTENTES VETERINARIOS', especialidad: 'ASISTENTE VETERINARIO' }),
    mk({ id: 4, nombre: 'Marco', area: 'COUNTER', especialidad: 'COUNTER' }),
    mk({ id: 5, nombre: 'Sofía', area: 'PELUQUEROS', especialidad: 'PELUQUERO' }),
    mk({ id: 6, nombre: 'Andrea', area: 'LIMPIEZA', especialidad: 'AUXILIAR DE ASEO' }),
    // Segunda sede
    mk({
      id: 7,
      nombre: 'Pedro',
      area: 'MEDICOS VETERINARIOS',
      codigo_recinto: 'Sur',
      nombre_recinto: 'Petmax Sur',
    }),
    mk({
      id: 8,
      nombre: 'Valentina',
      area: 'BANADORES',
      codigo_recinto: 'Sur',
      nombre_recinto: 'Petmax Sur',
    }),
  ];
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    complete: '✓ Completo',
    partial: '◐ Parcial',
    missing: '✗ Falta',
    over: '↑ Sobre dotación',
  };
  return map[status] ?? status;
}

describe('demo asistencia (simulación panel del día)', () => {
  it('muestra resumen de cobertura por sede, área y cargo', () => {
    const settings = mergeAsistenciaSettings({
      buk: { enabled: true, apiToken: '***', lastValidationOk: true },
      requirements: [
        ...buildDefaultRequirementsForSede('Petmax Principal', 'Petmax'),
        ...buildDefaultRequirementsForSede('Petmax Sur', 'Sur'),
      ],
      sedeMappings: [
        { sedeName: 'Petmax Principal', bukRecintoCode: 'Petmax' },
        { sedeName: 'Petmax Sur', bukRecintoCode: 'Sur' },
      ],
    });

    const records = sampleBukRecords();
    const summary = buildAsistenciaDaySummary({
      date: new Date('2026-06-10T12:00:00'),
      records,
      settings,
    });

    const lines: string[] = [];
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('  DEMO — Panel Asistencia del día (10/06/2026)');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push(`  Registros Buk simulados: ${records.length}`);
    lines.push(`  Personal presente (únicos): ${summary.totalPresentUnique}`);
    lines.push('');

    for (const [area, stats] of Object.entries(summary.globalByArea)) {
      const label = ASISTENCIA_AREA_GROUP_LABELS[area as keyof typeof ASISTENCIA_AREA_GROUP_LABELS];
      lines.push(
        `  ${label}: ${stats.present}/${stats.required} requeridos · ${stats.completeSlots}/${stats.slots} cargos OK`
      );
    }
    lines.push('');

    for (const sede of summary.sedes) {
      lines.push(`  ▶ ${sede.sedeName} (Buk: ${sede.bukRecintoCode ?? '—'})`);
      lines.push(
        `    ${sede.totalPresent} presentes / ${sede.totalRequired} req. · ${sede.isComplete ? 'DOTACIÓN COMPLETA' : `${sede.completeSlots}/${sede.totalSlots} cargos OK`}`
      );
      const rows = [...sede.byArea.medica, ...sede.byArea.peluqueria, ...sede.byArea.global];
      for (const row of rows) {
        const names =
          row.present.length > 0
            ? row.present.map((p) => p.fullName).join(', ')
            : '(nadie)';
        lines.push(
          `      · ${row.requirement.cargoLabel}: ${row.presentCount}/${row.requiredCount} — ${statusLabel(row.status)}`
        );
        if (row.present.length > 0) {
          lines.push(`        → ${names}`);
        }
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════');
    console.log(lines.join('\n'));

    // Aserciones mínimas del escenario demo
    expect(summary.totalPresentUnique).toBe(8);
    expect(summary.sedes).toHaveLength(2);

    const principal = summary.sedes.find((s) => s.sedeName === 'Petmax Principal')!;
    const medicos = principal.byArea.medica.find((c) => c.requirement.cargoLabel.includes('Médico'))!;
    expect(medicos.presentCount).toBe(2);
    expect(medicos.status).toBe('complete');

    const asistentes = principal.byArea.medica.find((c) => c.requirement.cargoLabel.includes('Asistente'))!;
    expect(asistentes.presentCount).toBe(1);
    expect(asistentes.status).toBe('partial');

    const banadorSur = summary.sedes
      .find((s) => s.sedeName === 'Petmax Sur')!
      .byArea.peluqueria.find((c) => c.requirement.cargoLabel.includes('Bañador'))!;
    expect(banadorSur.presentCount).toBe(1);
  });
});
