import { Eye, Pencil, Trash2 } from 'lucide-react';

import type { WorkplaceAccidentRecord } from '../../types/accidentes';
import {
  ACCIDENT_EVENT_TYPE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_WORKFLOW_LABELS,
} from '../../types/accidentes';
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

const SEVERITY_VARIANT: Record<string, string> = {
  leve: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  grave: 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
  muy_grave: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100',
  mortal: 'bg-slate-900 text-white dark:bg-red-950 dark:text-red-100',
};

const WORKFLOW_VARIANT: Record<string, string> = {
  reportado: 'bg-slate-100 text-slate-700 dark:bg-slate-600/30',
  investigacion: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20',
  acciones: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20',
  cerrado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20',
};

type Props = {
  records: WorkplaceAccidentRecord[];
  canEdit: boolean;
  onView: (record: WorkplaceAccidentRecord) => void;
  onEdit: (record: WorkplaceAccidentRecord) => void;
  onDelete: (id: string) => void;
};

export function AccidentesTable({ records, canEdit, onView, onEdit, onDelete }: Props) {
  if (records.length === 0) {
    return (
      <Card className="border-dashed border-border dark:border-slate-700">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay registros en el periodo seleccionado.
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
              <TableHead>Afectado</TableHead>
              <TableHead>Tipo / Flujo</TableHead>
              <TableHead>Sede / Área</TableHead>
              <TableHead>Lesión</TableHead>
              <TableHead>Gravedad</TableHead>
              <TableHead className="text-right">Días baja</TableHead>
              <TableHead className="w-[110px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {r.eventDate}
                  <br />
                  <span className="text-muted-foreground">{r.eventTime}</span>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{r.affectedName}</p>
                  <p className="text-xs text-muted-foreground">{r.jobTitle}</p>
                </TableCell>
                <TableCell className="text-xs">
                  <p>{ACCIDENT_EVENT_TYPE_LABELS[r.eventType ?? 'accidente']}</p>
                  <Badge
                    className={`mt-1 text-[10px] ${WORKFLOW_VARIANT[r.workflowStatus ?? 'reportado'] ?? ''}`}
                  >
                    {ACCIDENT_WORKFLOW_LABELS[r.workflowStatus ?? 'reportado']}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {r.sede}
                  <br />
                  <span className="text-muted-foreground">{r.workArea}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {r.injuryNature}
                  <br />
                  <span className="text-muted-foreground">{r.bodyPart}</span>
                </TableCell>
                <TableCell>
                  <Badge className={SEVERITY_VARIANT[r.severity] ?? ''}>
                    {ACCIDENT_SEVERITY_LABELS[r.severity]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.estimatedLostDays}</TableCell>
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
