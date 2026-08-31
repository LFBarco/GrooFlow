import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { History } from 'lucide-react';

import type { TurnosSettings } from '../../types/turnos';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';

type Props = {
  settings: TurnosSettings;
};

const ACTION_LABELS: Record<string, string> = {
  vacancy_created: 'Vacante creada',
  vacancy_cancelled: 'Vacante cancelada',
  coverage_approved: 'Cobertura aprobada',
  coverage_rejected: 'Postulación rechazada',
  week_published: 'Semana publicada',
  week_unpublished: 'Semana en borrador',
  template_saved: 'Plantilla guardada',
  template_applied: 'Plantilla aplicada',
};

export function TurnosHistoryDialog({ settings }: Props) {
  const log = settings.changeLog ?? [];
  if (log.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <History className="mr-1 h-4 w-4" />
          Historial ({log.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Historial de cambios</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-2">
          <ul className="space-y-3 text-sm">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border px-3 py-2 dark:border-slate-700"
              >
                <p className="font-medium">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                {entry.detail ? (
                  <p className="text-xs text-muted-foreground">{entry.detail}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {format(parseISO(entry.at), "d MMM yyyy HH:mm", { locale: es })}
                  {entry.by ? ` · ${entry.by}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
