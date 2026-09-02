import { AlertTriangle, Info, Lightbulb } from 'lucide-react';

import type { RrhhDashboardKpis, RrhhRecommendation } from '../../types/rrhh';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type Props = {
  kpis: RrhhDashboardKpis;
  recommendations: RrhhRecommendation[];
  lastSyncAt?: string;
  lastSyncMessage?: string;
};

function KpiCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  );
}

export function RrhhDashboard({ kpis, recommendations, lastSyncAt, lastSyncMessage }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total colaboradores" value={kpis.total} />
        <KpiCard label="Activos" value={kpis.active} hint="Estado activo en Buk.pe" />
        <KpiCard label="Bajas / inactivos" value={kpis.terminated} />
        <KpiCard label="Vinculados a usuario" value={kpis.linkedUsers} hint={`${kpis.unlinkedActive} activos sin usuario`} />
        <KpiCard label="Con asistencia" value={kpis.withAsistencia} hint={`${kpis.withoutAsistencia} sin cruce`} />
      </div>

      {lastSyncAt ? (
        <p className="text-xs text-muted-foreground">
          Última sincronización: {new Date(lastSyncAt).toLocaleString('es-PE')}
          {lastSyncMessage ? ` — ${lastSyncMessage}` : ''}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos por área</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.byArea.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            ) : (
              kpis.byArea.map((row) => (
                <div key={row.area} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{row.area}</span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos por cargo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.byCargo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            ) : (
              kpis.byCargo.map((row) => (
                <div key={row.cargo} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{row.cargo}</span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos por recinto (asistencia)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.byRecinto.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de asistencia.</p>
            ) : (
              kpis.byRecinto.map((row) => (
                <div key={row.recinto} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{row.recinto}</span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Recomendaciones
        </h3>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todo en orden por ahora.</p>
        ) : (
          recommendations.map((rec) => (
            <Alert
              key={rec.id}
              variant={rec.severity === 'action' ? 'destructive' : 'default'}
              className={
                rec.severity === 'warning'
                  ? 'border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20'
                  : undefined
              }
            >
              {rec.severity === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertTitle className="text-sm">{rec.title}</AlertTitle>
              <AlertDescription className="text-sm">{rec.detail}</AlertDescription>
            </Alert>
          ))
        )}
      </div>
    </div>
  );
}
