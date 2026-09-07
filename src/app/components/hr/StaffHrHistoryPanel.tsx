import type { WorkplaceAccidentRecord } from '../../types/accidentes';
import { ACCIDENT_EVENT_TYPE_LABELS, ACCIDENT_WORKFLOW_LABELS } from '../../types/accidentes';
import type { UniformDeliveryRecord } from '../../types/uniformes';
import { UNIFORM_REASON_LABELS } from '../../types/uniformes';

type Props = {
  userId?: string;
  staffName: string;
  asistenciaStaffId?: string;
  bukEmployeeId?: number;
  documentNumber?: string;
  accidents?: WorkplaceAccidentRecord[];
  uniforms?: UniformDeliveryRecord[];
  excludeAccidentId?: string;
  excludeUniformId?: string;
  maxItems?: number;
};

function docKey(raw?: string | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

function matchStaff(
  identity: {
    userId?: string;
    staffName: string;
    asistenciaStaffId?: string;
    bukEmployeeId?: number;
    documentNumber?: string;
  },
  record: {
    userId?: string;
    affectedName?: string;
    staffName?: string;
    asistenciaStaffId?: string;
    bukEmployeeId?: number;
    documentNumber?: string;
  }
): boolean {
  if (
    identity.asistenciaStaffId &&
    record.asistenciaStaffId &&
    identity.asistenciaStaffId === record.asistenciaStaffId
  ) {
    return true;
  }
  if (
    identity.bukEmployeeId &&
    record.bukEmployeeId &&
    identity.bukEmployeeId === record.bukEmployeeId
  ) {
    return true;
  }
  const docA = docKey(identity.documentNumber);
  const docB = docKey(record.documentNumber);
  if (docA && docB && docA === docB) return true;
  if (identity.userId && record.userId && identity.userId === record.userId) return true;
  const name = record.affectedName ?? record.staffName ?? '';
  return name.trim().toLowerCase() === identity.staffName.trim().toLowerCase();
}

export function StaffHrHistoryPanel({
  userId,
  staffName,
  asistenciaStaffId,
  bukEmployeeId,
  documentNumber,
  accidents = [],
  uniforms = [],
  excludeAccidentId,
  excludeUniformId,
  maxItems = 5,
}: Props) {
  const identity = { userId, staffName, asistenciaStaffId, bukEmployeeId, documentNumber };

  const accidentHistory = accidents
    .filter((r) => r.id !== excludeAccidentId && matchStaff(identity, r))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    .slice(0, maxItems);

  const uniformHistory = uniforms
    .filter((r) => r.id !== excludeUniformId && matchStaff(identity, r))
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
    .slice(0, maxItems);

  if (accidentHistory.length === 0 && uniformHistory.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3 dark:border-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Historial del colaborador
      </p>

      {accidentHistory.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">SST / Accidentes</p>
          <ul className="space-y-1.5">
            {accidentHistory.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs dark:border-slate-700"
              >
                <span>
                  {r.eventDate} · {ACCIDENT_EVENT_TYPE_LABELS[r.eventType ?? 'accidente']}
                </span>
                <span className="text-muted-foreground">
                  {ACCIDENT_WORKFLOW_LABELS[r.workflowStatus ?? 'reportado']}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {uniformHistory.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Uniformes</p>
          <ul className="space-y-1.5">
            {uniformHistory.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs dark:border-slate-700"
              >
                <span>
                  {r.deliveryDate} · {UNIFORM_REASON_LABELS[r.reason]}
                </span>
                <span className="text-muted-foreground">{r.items.length} ítem(s)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
