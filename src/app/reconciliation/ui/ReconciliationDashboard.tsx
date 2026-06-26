import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getActiveSession } from '../domain/dataset';
import type { ReconciliationDataset } from '../domain/types';
import { computeReconciliationHealth, countByStatus } from '../engines/healthScore';

type Props = {
  dataset: ReconciliationDataset;
};

const RISK_LABEL = {
  low: { text: 'Bajo', className: 'text-emerald-500' },
  medium: { text: 'Medio', className: 'text-amber-500' },
  high: { text: 'Alto', className: 'text-red-500' },
} as const;

export function ReconciliationDashboard({ dataset }: Props) {
  const session = getActiveSession(dataset);
  const health = computeReconciliationHealth(dataset);
  const counts = countByStatus(dataset);
  const risk = RISK_LABEL[health.riskLevel];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sesión activa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{session.label}</p>
            <p className="text-xs text-muted-foreground">{counts.total} movimientos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <p className="text-3xl font-bold">{health.overallPercent.toFixed(1)}%</p>
            <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Riesgo financiero</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${risk.className}`}>{risk.text}</p>
            <p className="text-xs text-muted-foreground">
              Confiabilidad {health.reliabilityPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas abiertas</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <p className="text-3xl font-bold">{counts.openAlerts}</p>
            <AlertTriangle className="mb-1 h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Conciliación por fuente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {health.bySource.map((row) => (
            <div key={row.sourceType}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{row.label}</span>
                <span className="font-medium">
                  {row.percent.toFixed(1)}% ({row.reconciled}/{row.total})
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, row.percent)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground">Conciliados</p>
          <p className="text-xl font-semibold text-emerald-600">{counts.reconciled}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground">Pendientes</p>
          <p className="text-xl font-semibold text-amber-600">{counts.pending}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground">Con diferencia</p>
          <p className="text-xl font-semibold text-red-600">{counts.difference}</p>
        </div>
      </div>
    </div>
  );
}
