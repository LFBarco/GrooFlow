import { FileText, Printer } from 'lucide-react';
import { format } from 'date-fns';

import {
  UNIFORM_STATUS_LABELS,
  type UniformDeliveryRecord,
} from '../../types/uniformes';
import { printUniformDeliveryActa } from '../../utils/uniformesPrint';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

const STATUS_VARIANT: Record<string, string> = {
  entregado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
  pendiente_firma: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  devuelto: 'bg-slate-200 text-slate-700 dark:bg-slate-600/30 dark:text-slate-200',
};

type Props = {
  records: UniformDeliveryRecord[];
  currentUserId?: string;
  currentUserName?: string;
  canEdit?: boolean;
  onConfirmReception: (record: UniformDeliveryRecord) => void;
  onOpenDetail: (record: UniformDeliveryRecord) => void;
};

export function UniformesActasPanel({
  records,
  currentUserId,
  currentUserName,
  canEdit = false,
  onConfirmReception,
  onOpenDetail,
}: Props) {
  const sorted = [...records].sort((a, b) =>
    (b.deliveryDate || '').localeCompare(a.deliveryDate || '')
  );

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Aún no hay actas. Al registrar una entrega se genera el acta automáticamente.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Historial de actas de entrega. Imprima / guarde PDF y confirme la recepción (colaborador
        notificado en el Centro de alertas).
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Confirmación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => {
              const canConfirm =
                r.status === 'pendiente_firma' &&
                ((currentUserId && r.userId === currentUserId) || canEdit);
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.deliveryDate}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-primary hover:underline"
                      onClick={() => onOpenDetail(r)}
                    >
                      {r.staffName}
                    </button>
                    <div className="text-xs text-muted-foreground">{r.workArea}</div>
                  </TableCell>
                  <TableCell>{r.sede}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_VARIANT[r.status] ?? ''}>
                      {UNIFORM_STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.receptionConfirmedAt
                      ? `${format(new Date(r.receptionConfirmedAt), 'dd/MM/yyyy HH:mm')}${
                          r.receptionConfirmedBy ? ` · ${r.receptionConfirmedBy}` : ''
                        }`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => printUniformDeliveryActa(r)}
                      >
                        <Printer className="mr-1 h-3.5 w-3.5" />
                        PDF / Imprimir
                      </Button>
                      {canConfirm ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onConfirmReception(r)}
                        >
                          <FileText className="mr-1 h-3.5 w-3.5" />
                          Confirmar recepción
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!currentUserName ? null : (
        <p className="text-[11px] text-muted-foreground">
          Sesión: {currentUserName}. Si eres el colaborador vinculado, puedes confirmar tu acta.
        </p>
      )}
    </div>
  );
}
