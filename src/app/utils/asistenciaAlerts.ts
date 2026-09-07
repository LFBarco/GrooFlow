import type { SystemAlert } from '../types';
import type {
  AsistenciaOperationalContext,
  AsistenciaRequirementCoverage,
  AsistenciaSettings,
} from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { cacheAgeHours, loadAsistenciaOperationalContext } from './asistenciaOperationalContext';

export type AsistenciaOperationalAlert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
};

export function coverageGapsFromSummary(
  settings: AsistenciaSettings,
  sedeNames: string[]
): AsistenciaOperationalContext['coverageGaps'] {
  const merged = mergeAsistenciaSettings(settings);
  const gaps: AsistenciaOperationalContext['coverageGaps'] = [];
  for (const req of merged.requirements) {
    if (sedeNames.length && !sedeNames.includes(req.sedeName)) continue;
    gaps.push({
      sedeName: req.sedeName,
      cargoLabel: req.cargoLabel,
      required: req.requiredCount,
      present: 0,
    });
  }
  return gaps;
}

export function buildAsistenciaOperationalAlerts(
  ctx: AsistenciaOperationalContext | null
): AsistenciaOperationalAlert[] {
  if (!ctx) return [];
  const out: AsistenciaOperationalAlert[] = [];
  const ageH = cacheAgeHours(ctx.cacheFetchedAt);

  if (ctx.bukEnabled && ageH != null && ageH > 24) {
    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Solo alerta de frescura si el contexto es del día operativo actual.
    if (ctx.dateYmd === todayYmd) {
      out.push({
        id: 'asistencia-stale-cache',
        severity: 'warning',
        title: 'Marcaciones de hoy desactualizadas',
        message: `Sin sync reciente (${Math.round(ageH)} h). Actualiza Buk en Asistencia para el día de hoy.`,
      });
    }
  }

  if (ctx.criticalMissing.length > 0) {
    out.push({
      id: `asistencia-critical-${ctx.dateYmd}`,
      severity: 'critical',
      title: `${ctx.criticalMissing.length} puesto(s) crítico(s) ausente(s)`,
      message: ctx.criticalMissing
        .slice(0, 4)
        .map((s) => `${s.fullName} (${s.sedeName})`)
        .join(' · '),
    });
  }

  const gaps = ctx.coverageGaps.filter((g) => g.required > 0 && g.present < g.required);
  if (gaps.length > 0) {
    out.push({
      id: `asistencia-coverage-${ctx.dateYmd}`,
      severity: 'warning',
      title: `${gaps.length} cargo(s) bajo dotación mínima`,
      message: gaps
        .slice(0, 3)
        .map((g) => `${g.cargoLabel} ${g.sedeName}: ${g.present}/${g.required}`)
        .join(' · '),
    });
  }

  if (ctx.bukEnabled && ctx.cacheFetchedAt == null) {
    out.push({
      id: 'asistencia-no-cache',
      severity: 'info',
      title: 'Sin caché Buk cargada',
      message: 'Abre Asistencia y pulsa «Actualizar Buk» para cruzar marcaciones.',
    });
  }

  return out;
}

export function buildAsistenciaSystemAlerts(
  settings?: AsistenciaSettings | null
): SystemAlert[] {
  const ctx = loadAsistenciaOperationalContext();
  const merged = mergeAsistenciaSettings(settings);
  const alerts = buildAsistenciaOperationalAlerts(ctx);
  const today = new Date();

  if (!merged.buk?.enabled && (merged.staff?.length ?? 0) > 0) {
    return [
      {
        id: 'asistencia-buk-disabled',
        title: '[Asistencia] Integración Buk inactiva',
        message: 'Hay personal configurado pero Buk no está activo. Actívalo en Configuración → Integraciones.',
        severity: 'warning',
        type: 'operational',
        category: 'operational',
        date: today,
        actionLink: 'asistencia',
        actionLabel: 'Abrir asistencia',
        read: false,
      },
    ];
  }

  return alerts.map((a) => ({
    id: a.id,
    title: `[Asistencia] ${a.title}`,
    message: a.message,
    severity: a.severity,
    type: 'operational' as const,
    category: 'operational' as const,
    date: today,
    actionLink: 'asistencia',
    actionLabel: 'Abrir asistencia',
    read: false,
  }));
}

export function requirementGapRows(coverage: AsistenciaRequirementCoverage[]): {
  sedeName: string;
  cargoLabel: string;
  required: number;
  present: number;
}[] {
  return coverage
    .filter((c) => c.requiredCount > 0 && c.presentCount < c.requiredCount)
    .map((c) => ({
      sedeName: c.requirement.sedeName,
      cargoLabel: c.requirement.cargoLabel,
      required: c.requiredCount,
      present: c.presentCount,
    }));
}
