import { AlertTriangle } from 'lucide-react';

import type { AccidentesKpiConfig, AccidentesKpiSnapshot } from '../../types/accidentes';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type Props = {
  kpis: AccidentesKpiSnapshot;
  config: AccidentesKpiConfig;
};

export function AccidentesAlertBanner({ kpis, config }: Props) {
  const freqAlert =
    config.alertMaxFrequencyIndex != null &&
    config.alertMaxFrequencyIndex > 0 &&
    kpis.frequencyIndex > config.alertMaxFrequencyIndex;

  const gravAlert =
    config.alertMaxGravityIndex != null &&
    config.alertMaxGravityIndex > 0 &&
    kpis.gravityIndex > config.alertMaxGravityIndex;

  if (
    !freqAlert &&
    !gravAlert &&
    kpis.openInvestigations === 0 &&
    kpis.overdueCorrectiveActions === 0 &&
    kpis.pendingMtpeNotifications === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-2">
      {kpis.pendingMtpeNotifications > 0 ? (
        <Alert variant="destructive" className="border-rose-400 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {kpis.pendingMtpeNotifications} accidente(s) mortal(es) sin notificación al MTPE
          </AlertTitle>
          <AlertDescription>
            La notificación al Ministerio de Trabajo es obligatoria dentro de las 24 horas (DS
            005-2012-TR, art. 110). Registre la fecha y el número de notificación en el caso.
          </AlertDescription>
        </Alert>
      ) : null}
      {kpis.overdueCorrectiveActions > 0 ? (
        <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            {kpis.overdueCorrectiveActions} acción(es) correctiva(s) vencida(s)
          </AlertTitle>
          <AlertDescription>
            Hay acciones pendientes cuya fecha límite ya pasó. Revise los responsables en cada caso.
          </AlertDescription>
        </Alert>
      ) : null}
      {freqAlert ? (
        <Alert variant="destructive" className="border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Índice de frecuencia elevado</AlertTitle>
          <AlertDescription>
            IF actual {kpis.frequencyIndex.toFixed(2)} supera el umbral configurado (
            {config.alertMaxFrequencyIndex}). Revise los casos abiertos y acciones preventivas.
          </AlertDescription>
        </Alert>
      ) : null}
      {gravAlert ? (
        <Alert variant="destructive" className="border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Índice de gravedad elevado</AlertTitle>
          <AlertDescription>
            IG actual {kpis.gravityIndex.toFixed(2)} supera el umbral configurado (
            {config.alertMaxGravityIndex}). Priorice investigaciones y días de baja.
          </AlertDescription>
        </Alert>
      ) : null}
      {kpis.openInvestigations > 0 ? (
        <Alert className="border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30">
          <AlertTriangle className="h-4 w-4 text-sky-600" />
          <AlertTitle className="text-sky-900 dark:text-sky-100">
            {kpis.openInvestigations} caso(s) SST abiertos
          </AlertTitle>
          <AlertDescription>
            Hay registros cuyo flujo aún no está cerrado. Use el filtro preset &quot;Abiertos&quot; en
            la pestaña Registros.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
