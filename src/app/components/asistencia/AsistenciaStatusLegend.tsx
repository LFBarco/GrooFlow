import { ASISTENCIA_LIVE_STATUS_LABELS, type AsistenciaLiveStatus } from '../../types/asistencia';
import { STATUS_DOT } from './asistenciaLiveUi';

const ORDER: AsistenciaLiveStatus[] = ['trabajando', 'presente', 'tarde', 'ausente'];

export function AsistenciaStatusLegend({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground ${className ?? ''}`}
    >
      {ORDER.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          {ASISTENCIA_LIVE_STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}
