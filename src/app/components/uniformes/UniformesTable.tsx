import { Eye, Pencil, Trash2 } from 'lucide-react';

import type { UniformDeliveryRecord } from '../../types/uniformes';
import {
  UNIFORM_ITEM_LABELS,
  UNIFORM_REASON_LABELS,
  UNIFORM_STATUS_LABELS,
} from '../../types/uniformes';
import { countItemsInRecord } from '../../utils/uniformesData';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
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
  canEdit: boolean;
  onView: (record: UniformDeliveryRecord) => void;
  onEdit: (record: UniformDeliveryRecord) => void;
  onDelete: (id: string) => void;
};

function formatItemsSummary(record: UniformDeliveryRecord): string {
  return record.items
    .map((i) => {
      const label = UNIFORM_ITEM_LABELS[i.itemType] ?? i.itemType;
      const qty = i.quantity > 1 ? ` ×${i.quantity}` : '';
      return `${label} (${i.size})${qty}`;
    })
    .join(', ');
}

export function UniformesTable({ records, canEdit, onView, onEdit, onDelete }: Props) {
  if (records.length === 0) {
    return (
      <Card className="border-dashed border-border dark:border-slate-700">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay entregas registradas en el periodo seleccionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border dark:border-slate-700">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Sede / Área</TableHead>
              <TableHead>Prendas</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="w-[110px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{r.deliveryDate}</TableCell>
                <TableCell>
                  <p className="font-medium">{r.staffName}</p>
                  <p className="text-xs text-muted-foreground">{r.jobTitle}</p>
                </TableCell>
                <TableCell className="text-xs">
                  {r.sede}
                  <br />
                  <span className="text-muted-foreground">{r.workArea}</span>
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-xs" title={formatItemsSummary(r)}>
                  {formatItemsSummary(r)}
                </TableCell>
                <TableCell className="text-xs">{UNIFORM_REASON_LABELS[r.reason]}</TableCell>
                <TableCell>
                  <Badge className={STATUS_VARIANT[r.status] ?? ''}>
                    {UNIFORM_STATUS_LABELS[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{countItemsInRecord(r)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => onView(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                      <>
                        <Button type="button" size="icon" variant="ghost" onClick={() => onEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-rose-600"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
