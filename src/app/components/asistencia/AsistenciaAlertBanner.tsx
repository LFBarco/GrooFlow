import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';

import type { AsistenciaOperationalAlert } from '../../utils/asistenciaAlerts';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type Props = {
  alerts: AsistenciaOperationalAlert[];
};

export function AsistenciaAlertBanner({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Alert
          key={a.id}
          variant={a.severity === 'critical' ? 'destructive' : 'default'}
          className={
            a.severity === 'critical'
              ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
              : a.severity === 'warning'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30'
          }
        >
          {a.severity === 'critical' ? (
            <ShieldAlert className="h-4 w-4" />
          ) : a.severity === 'warning' ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <Clock className="h-4 w-4 text-sky-600" />
          )}
          <AlertTitle className="text-sm">{a.title}</AlertTitle>
          <AlertDescription className="text-sm">{a.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
