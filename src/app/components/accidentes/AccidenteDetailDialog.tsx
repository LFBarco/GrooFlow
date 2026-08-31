import { ChevronRight } from 'lucide-react';

import {
  ACCIDENT_CARE_LABELS,
  ACCIDENT_EVENT_TYPE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SHIFT_LABELS,
  ACCIDENT_WORKFLOW_LABELS,
  type AccidentWorkflowStatus,
  type WorkplaceAccidentRecord,
} from '../../types/accidentes';
import type { UniformDeliveryRecord } from '../../types/uniformes';
import {
  ACCIDENT_WORKFLOW_ORDER,
  nextAccidentWorkflowStatus,
} from '../../utils/accidentesData';
import { StaffHrHistoryPanel } from '../hr/StaffHrHistoryPanel';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const SEVERITY_VARIANT: Record<string, string> = {
  leve: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  grave: 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
  muy_grave: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100',
  mortal: 'bg-slate-900 text-white dark:bg-red-950 dark:text-red-100',
};

const WORKFLOW_VARIANT: Record<AccidentWorkflowStatus, string> = {
  reportado: 'bg-slate-100 text-slate-800 dark:bg-slate-600/30 dark:text-slate-100',
  investigacion: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100',
  acciones: 'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100',
  cerrado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
};

type Props = {
  record: WorkplaceAccidentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  allRecords?: WorkplaceAccidentRecord[];
  uniformRecords?: UniformDeliveryRecord[];
  onAdvanceWorkflow?: (recordId: string, status: AccidentWorkflowStatus) => void;
};

function Row({ label, value }: { label: string; value: string | number }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function AccidenteDetailDialog({
  record,
  open,
  onOpenChange,
  canEdit = false,
  allRecords = [],
  uniformRecords = [],
  onAdvanceWorkflow,
}: Props) {
  if (!record) return null;

  const workflow = record.workflowStatus ?? 'reportado';
  const nextStatus = nextAccidentWorkflowStatus(workflow);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {record.affectedName}
            <Badge className={SEVERITY_VARIANT[record.severity] ?? ''}>
              {ACCIDENT_SEVERITY_LABELS[record.severity]}
            </Badge>
            <Badge className={WORKFLOW_VARIANT[workflow]}>
              {ACCIDENT_WORKFLOW_LABELS[workflow]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap gap-1">
          {ACCIDENT_WORKFLOW_ORDER.map((step, i) => (
            <span key={step} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {i > 0 ? <ChevronRight className="h-3 w-3" /> : null}
              <span className={step === workflow ? 'font-semibold text-foreground' : ''}>
                {ACCIDENT_WORKFLOW_LABELS[step]}
              </span>
            </span>
          ))}
        </div>

        {canEdit && nextStatus && onAdvanceWorkflow ? (
          <Button
            type="button"
            size="sm"
            className="mb-3"
            onClick={() => onAdvanceWorkflow(record.id, nextStatus)}
          >
            Avanzar a: {ACCIDENT_WORKFLOW_LABELS[nextStatus]}
          </Button>
        ) : null}

        <dl className="space-y-3">
          <Row
            label="Tipo"
            value={ACCIDENT_EVENT_TYPE_LABELS[record.eventType ?? 'accidente']}
          />
          <Row label="Fecha / hora" value={`${record.eventDate} · ${record.eventTime}`} />
          <Row label="Sede" value={record.sede} />
          <Row label="Ubicación" value={record.exactLocation} />
          <Row label="Cargo" value={record.jobTitle} />
          <Row label="Área" value={record.workArea} />
          <Row label="Turno" value={ACCIDENT_SHIFT_LABELS[record.workShift]} />
          <Row label="Lesión" value={record.injuryNature} />
          <Row label="Parte del cuerpo" value={record.bodyPart} />
          <Row label="Agente causante" value={record.causingAgent} />
          <Row label="Atención inmediata" value={ACCIDENT_CARE_LABELS[record.immediateCare]} />
          <Row label="Días de baja" value={String(record.estimatedLostDays)} />
          <Row
            label="Costos"
            value={`Médico S/ ${record.medicalCost.toLocaleString('es-PE')} · Indemn. S/ ${record.indemnizationCost.toLocaleString('es-PE')}`}
          />
          <Row label="Contrato" value={record.contractType} />
          <Row label="Antigüedad" value={`${record.seniorityMonths} meses`} />
          {record.description ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Descripción</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{record.description}</p>
            </div>
          ) : null}
          {record.preventiveActions ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Acciones preventivas</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{record.preventiveActions}</p>
            </div>
          ) : null}
          {(record.correctiveActions ?? []).length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Acciones correctivas</p>
              <ul className="space-y-2">
                {(record.correctiveActions ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-border px-3 py-2 text-sm dark:border-slate-700"
                  >
                    <p>{a.description || '—'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.responsible ? `Resp: ${a.responsible}` : ''}
                      {a.dueDate ? ` · Vence: ${a.dueDate}` : ''}
                      {' · '}
                      {a.status === 'completada' ? 'Completada' : 'Pendiente'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {(record.attachments ?? []).length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Adjuntos</p>
              <ul className="space-y-1">
                {(record.attachments ?? []).map((att) => (
                  <li key={att.id}>
                    <a
                      href={att.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {att.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {record.reportedBy ? <Row label="Reportado por" value={record.reportedBy} /> : null}
        </dl>

        <StaffHrHistoryPanel
          userId={record.userId}
          staffName={record.affectedName}
          accidents={allRecords}
          uniforms={uniformRecords}
          excludeAccidentId={record.id}
        />
      </DialogContent>
    </Dialog>
  );
}
