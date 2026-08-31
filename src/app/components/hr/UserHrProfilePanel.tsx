import type { User } from '../../types';
import type { WorkplaceAccidentRecord } from '../../types/accidentes';
import type { UniformDeliveryRecord } from '../../types/uniformes';
import { computeStaffUniformRenewal } from '../../utils/uniformesRenewal';
import { Badge } from '../ui/badge';
import { StaffHrHistoryPanel } from './StaffHrHistoryPanel';

type Props = {
  user: Pick<User, 'id' | 'name' | 'jobTitle' | 'workArea'>;
  accidents: WorkplaceAccidentRecord[];
  uniforms: UniformDeliveryRecord[];
  loading?: boolean;
};

export function UserHrProfilePanel({ user, accidents, uniforms, loading }: Props) {
  const renewal = computeStaffUniformRenewal({
    records: uniforms,
    userId: user.id,
    staffName: user.name,
  });

  const openCases = accidents.filter(
    (r) =>
      (r.userId === user.id ||
        r.affectedName.trim().toLowerCase() === user.name.trim().toLowerCase()) &&
      (r.workflowStatus ?? 'reportado') !== 'cerrado'
  ).length;

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">Cargando historial SST / uniformes…</p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3 dark:border-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ficha HR — SST y uniformes
      </p>

      <div className="flex flex-wrap gap-2">
        {openCases > 0 ? (
          <Badge className="bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100">
            {openCases} caso(s) SST abierto(s)
          </Badge>
        ) : null}
        {renewal.status === 'overdue' ? (
          <Badge className="bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100">
            Renovación vencida
          </Badge>
        ) : null}
        {renewal.status === 'due_soon' ? (
          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
            Renovación próxima
          </Badge>
        ) : null}
        {renewal.status === 'unknown' ? (
          <Badge variant="secondary">Sin entrega registrada</Badge>
        ) : null}
      </div>

      {renewal.lastDeliveryDate ? (
        <p className="text-xs text-muted-foreground">
          Última entrega: {renewal.lastDeliveryDate}
          {renewal.nextDueDate ? ` · Próxima renovación: ${renewal.nextDueDate}` : ''}
        </p>
      ) : null}

      <StaffHrHistoryPanel
        userId={user.id}
        staffName={user.name}
        accidents={accidents}
        uniforms={uniforms}
        maxItems={8}
      />
    </div>
  );
}
