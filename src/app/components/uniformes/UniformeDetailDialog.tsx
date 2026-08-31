import type { WorkplaceAccidentRecord } from '../../types/accidentes';
import {
  UNIFORM_ITEM_LABELS,
  UNIFORM_REASON_LABELS,
  UNIFORM_STATUS_LABELS,
  type UniformDeliveryRecord,
} from '../../types/uniformes';
import { countItemsInRecord } from '../../utils/uniformesData';
import { StaffHrHistoryPanel } from '../hr/StaffHrHistoryPanel';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const STATUS_VARIANT: Record<string, string> = {
  entregado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
  pendiente_firma: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  devuelto: 'bg-slate-200 text-slate-700 dark:bg-slate-600/30 dark:text-slate-200',
};

type Props = {
  record: UniformDeliveryRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRecords?: UniformDeliveryRecord[];
  accidentRecords?: WorkplaceAccidentRecord[];
};

export function UniformeDetailDialog({
  record,
  open,
  onOpenChange,
  allRecords = [],
  accidentRecords = [],
}: Props) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Entrega · {record.staffName}
            <Badge className={STATUS_VARIANT[record.status] ?? ''}>
              {UNIFORM_STATUS_LABELS[record.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-xs text-muted-foreground">Fecha</span>
              <br />
              {record.deliveryDate}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Motivo</span>
              <br />
              {UNIFORM_REASON_LABELS[record.reason]}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Sede</span>
              <br />
              {record.sede}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Área</span>
              <br />
              {record.workArea}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Cargo</span>
              <br />
              {record.jobTitle}
            </p>
            <p>
              <span className="text-xs text-muted-foreground">Total prendas</span>
              <br />
              {countItemsInRecord(record)} unidades
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Ítems entregados</p>
            <ul className="space-y-2">
              {record.items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-slate-700"
                >
                  <span>{UNIFORM_ITEM_LABELS[item.itemType] ?? item.itemType}</span>
                  <span className="text-muted-foreground">
                    Talla {item.size}
                    {item.color ? ` · ${item.color}` : ''} · ×{item.quantity || 1}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {record.notes ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Observaciones</p>
              <p className="mt-1 whitespace-pre-wrap">{record.notes}</p>
            </div>
          ) : null}
          {record.deliveredBy ? (
            <p className="text-xs text-muted-foreground">Entregado por: {record.deliveredBy}</p>
          ) : null}
          {record.signatureActDataUrl ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Acta firmada</p>
              <a
                href={record.signatureActDataUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {record.signatureActName ?? 'Ver acta de entrega'}
              </a>
            </div>
          ) : null}

          <StaffHrHistoryPanel
            userId={record.userId}
            staffName={record.staffName}
            accidents={accidentRecords}
            uniforms={allRecords}
            excludeUniformId={record.id}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
