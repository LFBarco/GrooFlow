import { Lock, LockOpen } from 'lucide-react';

import type { TurnosSettings } from '../../types/turnos';
import {
  getWeekPublishStatus,
  publishWeek,
  unpublishWeek,
  weekKeyForAnchor,
} from '../../utils/turnosAudit';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

type Props = {
  settings: TurnosSettings;
  anchor: Date;
  workSede: string;
  canEdit: boolean;
  currentUserName?: string;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

export function TurnosPublishBar({
  settings,
  anchor,
  workSede,
  canEdit,
  currentUserName,
  onUpdate,
}: Props) {
  if (workSede === 'Todas') return null;

  const weekKey = weekKeyForAnchor(anchor);
  const pub = getWeekPublishStatus(settings, weekKey, workSede);
  const isPublished = pub?.status === 'published';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm dark:border-slate-700">
      <Badge variant={isPublished ? 'default' : 'secondary'}>
        {isPublished ? 'Semana publicada' : 'Borrador'}
      </Badge>
      {isPublished && pub?.publishedAt ? (
        <span className="text-xs text-muted-foreground">
          {pub.publishedBy ? `Por ${pub.publishedBy} · ` : ''}
          {new Date(pub.publishedAt).toLocaleString('es')}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          Publica el encargado de sede. Hasta entonces es borrador operativo.
        </span>
      )}
      {canEdit ? (
        isPublished ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onUpdate(
                (prev) => unpublishWeek(prev, weekKey, workSede, currentUserName),
                'Semana revertida a borrador.'
              )
            }
          >
            <LockOpen className="mr-1 h-4 w-4" />
            Volver a borrador
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onUpdate(
                (prev) => publishWeek(prev, weekKey, workSede, currentUserName),
                'Semana publicada para la sede.'
              )
            }
          >
            <Lock className="mr-1 h-4 w-4" />
            Publicar semana
          </Button>
        )
      ) : (
        <span className="text-xs text-amber-700 dark:text-amber-300">
          Solo el encargado de esta sede (o admin) puede publicar.
        </span>
      )}
    </div>
  );
}
