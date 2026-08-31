import type { AsistenciaDaySummary, AsistenciaRequirementCoverage } from '../../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS, type AsistenciaAreaGroup } from '../../types/asistencia';
import { CoverageBar, CoverageStatusBadge } from './asistenciaUiHelpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const GROUPS: AsistenciaAreaGroup[] = ['medica', 'peluqueria', 'global'];

type Props = {
  summary: AsistenciaDaySummary;
  sedeName?: string;
};

function RequirementRow({ cov }: { cov: AsistenciaRequirementCoverage }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm dark:border-slate-700">
      <div>
        <p className="font-medium">{cov.requirement.cargoLabel}</p>
        <p className="text-xs text-muted-foreground">{cov.requirement.sedeName}</p>
      </div>
      <div className="flex items-center gap-2">
        <CoverageBar present={cov.presentCount} required={cov.requiredCount} />
        <CoverageStatusBadge status={cov.status} />
      </div>
    </div>
  );
}

export function AsistenciaCoverageDetailPanel({ summary, sedeName }: Props) {
  const sedes = sedeName ? summary.sedes.filter((s) => s.sedeName === sedeName) : summary.sedes;

  if (sedes.every((s) => s.totalSlots === 0)) {
    return null;
  }

  return (
    <Card className="border-border dark:border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Detalle de requisitos</CardTitle>
        <CardDescription>
          Cargos mínimos vs presentes según marcaciones Buk · {summary.dateLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sedes.map((sede) => (
          <div key={sede.sedeName} className="space-y-3">
            {!sedeName ? (
              <p className="text-sm font-semibold text-foreground">{sede.sedeName}</p>
            ) : null}
            {GROUPS.map((group) => {
              const slots = sede.byArea[group];
              if (slots.length === 0) return null;
              return (
                <div key={`${sede.sedeName}-${group}`} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {ASISTENCIA_AREA_GROUP_LABELS[group]}
                  </p>
                  {slots.map((cov) => (
                    <RequirementRow key={cov.requirement.id} cov={cov} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
