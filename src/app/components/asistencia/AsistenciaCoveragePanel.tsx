import { ShieldCheck } from 'lucide-react';

import type { AsistenciaAreaGroup, AsistenciaDaySummary } from '../../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS } from '../../types/asistencia';
import { AreaGroupLabel, CoverageBar, CoverageStatusBadge } from './asistenciaUiHelpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const AREA_GROUPS: AsistenciaAreaGroup[] = ['medica', 'peluqueria', 'global'];

type Props = {
  summary: AsistenciaDaySummary;
  sedeName?: string;
  compact?: boolean;
};

function coverageStatus(
  present: number,
  required: number
): 'complete' | 'partial' | 'missing' | 'over' {
  if (required <= 0) return present > 0 ? 'over' : 'missing';
  if (present >= required) return present > required ? 'over' : 'complete';
  if (present > 0) return 'partial';
  return 'missing';
}

export function AsistenciaCoveragePanel({ summary, sedeName, compact }: Props) {
  const sedeCov = sedeName ? summary.sedes.find((s) => s.sedeName === sedeName) : undefined;
  const totalRequired = sedeCov?.totalRequired ?? summary.sedes.reduce((n, s) => n + s.totalRequired, 0);
  const totalPresent = sedeCov?.totalPresent ?? summary.sedes.reduce((n, s) => n + s.totalPresent, 0);

  const globalByArea = sedeCov
    ? AREA_GROUPS.reduce(
        (acc, group) => {
          const slots = sedeCov.byArea[group];
          acc[group] = {
            required: slots.reduce((n, c) => n + c.requiredCount, 0),
            present: slots.reduce((n, c) => n + c.presentCount, 0),
            slots: slots.length,
            completeSlots: slots.filter((c) => c.status === 'complete' || c.status === 'over').length,
          };
          return acc;
        },
        {} as AsistenciaDaySummary['globalByArea']
      )
    : summary.globalByArea;

  if (totalRequired === 0 && summary.sedes.every((s) => s.totalSlots === 0)) {
    return (
      <Card className="border-dashed border-border bg-muted/30 dark:border-slate-700">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Sin requisitos de dotación configurados. Define cargos mínimos en Configuración sede.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card dark:border-slate-800">
      <CardHeader className={compact ? 'pb-2 pt-4' : 'pb-3'}>
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          Cobertura operativa
          {sedeName ? (
            <span className="text-sm font-normal text-muted-foreground">· {sedeName}</span>
          ) : null}
        </CardTitle>
        {!compact ? (
          <CardDescription>
            Dotación requerida vs presentes según marcaciones Buk · {summary.dateLabel}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <CoverageBar present={totalPresent} required={totalRequired} />
          <CoverageStatusBadge status={coverageStatus(totalPresent, totalRequired)} />
          <span className="text-xs text-muted-foreground">
            {summary.totalPresentUnique} persona(s) únicas en sede(s) ese día
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {AREA_GROUPS.map((group) => {
            const g = globalByArea[group];
            if (g.slots === 0 && g.required === 0) return null;
            return (
              <div
                key={group}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <AreaGroupLabel group={group} />
                  <CoverageStatusBadge status={coverageStatus(g.present, g.required)} />
                </div>
                <CoverageBar present={g.present} required={g.required} />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {g.completeSlots}/{g.slots} cargo(s) cubiertos · {ASISTENCIA_AREA_GROUP_LABELS[group]}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
