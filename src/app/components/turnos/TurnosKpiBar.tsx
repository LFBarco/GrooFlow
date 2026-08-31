import { AlertTriangle, Building2, Briefcase, Sun, Users } from 'lucide-react';

import type { TurnosPeriodKpi } from '../../types/turnos';
import { Card, CardContent } from '../ui/card';

type Props = {
  kpis: TurnosPeriodKpi;
};

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Sun;
  accent: string;
}) {
  return (
    <Card className="border-border dark:border-slate-700">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TurnosKpiBar({ kpis }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="Turnos día"
        value={String(kpis.dayShifts)}
        subtitle={`${kpis.nightShifts} noches · ${kpis.offShifts} libres`}
        icon={Sun}
        accent="bg-[#FEF3C7] text-[#92400E] dark:bg-amber-500/20 dark:text-amber-200"
      />
      <KpiCard
        title="COV inter-sede"
        value={String(kpis.coverShifts)}
        subtitle="Cobertura interna"
        icon={Building2}
        accent="bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200"
      />
      <KpiCard
        title="EXT externos"
        value={String(kpis.externalCoverShifts)}
        subtitle="Personal externo"
        icon={Briefcase}
        accent="bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200"
      />
      <KpiCard
        title="Vacantes"
        value={String(kpis.openVacancies)}
        subtitle={`${kpis.pendingApplications} postulación(es)`}
        icon={Users}
        accent="bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200"
      />
      <KpiCard
        title="Sin asignar"
        value={String(kpis.unassignedStaff)}
        subtitle={`de ${kpis.activeStaff} en roster`}
        icon={Users}
        accent="bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200"
      />
      <KpiCard
        title="Días con alerta"
        value={String(kpis.understaffedDays)}
        subtitle="Dotación bajo mínimo"
        icon={AlertTriangle}
        accent={
          kpis.understaffedDays > 0
            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
        }
      />
    </div>
  );
}
