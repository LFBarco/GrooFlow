import { CalendarClock } from 'lucide-react';

import type { StaffUniformRenewal } from '../../utils/uniformesRenewal';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

type Props = {
  renewals: StaffUniformRenewal[];
};

const STATUS_LABEL: Record<StaffUniformRenewal['status'], string> = {
  ok: 'Al día',
  due_soon: 'Próxima',
  overdue: 'Vencida',
  unknown: 'Sin registro',
};

const STATUS_VARIANT: Record<string, string> = {
  due_soon: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  overdue: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100',
};

export function UniformesRenewalPanel({ renewals }: Props) {
  if (renewals.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold">Renovaciones de uniforme pendientes</h3>
          <Badge variant="secondary" className="text-[10px]">
            {renewals.length}
          </Badge>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Colaboradores con más de 12 meses desde su última entrega (o dentro de 30 días de vencer).
        </p>
        <ul className="max-h-[220px] space-y-2 overflow-y-auto">
          {renewals.map((r) => (
            <li
              key={`${r.userId ?? r.staffName}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm dark:border-slate-700"
            >
              <div>
                <p className="font-medium">{r.staffName}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.jobTitle, r.workArea].filter(Boolean).join(' · ') || 'Sin cargo'}
                  {r.lastDeliveryDate ? ` · Última: ${r.lastDeliveryDate}` : ''}
                </p>
              </div>
              <div className="text-right">
                <Badge className={STATUS_VARIANT[r.status] ?? ''}>
                  {STATUS_LABEL[r.status]}
                </Badge>
                {r.nextDueDate ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">Vence: {r.nextDueDate}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
