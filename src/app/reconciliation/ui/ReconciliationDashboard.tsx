import { AlertTriangle, CheckCircle2, HelpCircle, Shield } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { AUDIT_GLOSSARY, SOURCE_LABELS } from '../domain/auditLabels';
import { getActiveSession } from '../domain/dataset';
import type { ReconciliationDataset } from '../domain/types';
import { computeAuditSummary } from '../engines/auditQueries';
import { computeReconciliationHealth, countByStatus } from '../engines/healthScore';

type Props = {
  dataset: ReconciliationDataset;
};

const RISK_LABEL = {
  low: { text: 'Bajo', className: 'text-emerald-500', hint: 'Pocos huérfanos y alertas críticas.' },
  medium: { text: 'Medio', className: 'text-amber-500', hint: 'Revisar excepciones antes de cerrar.' },
  high: { text: 'Alto', className: 'text-red-500', hint: 'Muchos movimientos sin cruce — acción requerida.' },
} as const;

function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function formatMoney(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReconciliationDashboard({ dataset }: Props) {
  const session = getActiveSession(dataset);
  const health = computeReconciliationHealth(dataset);
  const audit = computeAuditSummary(dataset);
  const counts = countByStatus(dataset);
  const risk = RISK_LABEL[health.riskLevel];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                Sesión activa
                <HelpTip text="Lote de trabajo actual. Cada importación se acumula en esta sesión hasta que abra una nueva." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{session.label}</p>
              <p className="text-xs text-muted-foreground">
                {counts.total.toLocaleString('es-PE')} movimientos · {dataset.batches.length} importación(es)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                Health Score
                <HelpTip text={AUDIT_GLOSSARY.healthScore.body} />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <p className="text-3xl font-bold">{health.overallPercent.toFixed(1)}%</p>
              <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-500" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                Riesgo financiero
                <HelpTip text={`${AUDIT_GLOSSARY.risk.body} ${risk.hint}`} />
              </CardTitle>
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
              <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                Alertas resumidas
                <HelpTip text="Resumen de hallazgos. El detalle fila a fila está en la pestaña Cruces." />
              </CardTitle>
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
              <HelpTip text={AUDIT_GLOSSARY.bySource.body} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.bySource.map((row) => (
              <div key={row.sourceType}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="font-medium" title="Conciliados / Total importado de esta fuente">
                    {row.percent.toFixed(1)}% ({row.reconciled.toLocaleString('es-PE')}/
                    {row.total.toLocaleString('es-PE')})
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, row.percent)}%` }}
                  />
                </div>
                {row.total === 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Sin datos importados de {row.label}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-muted-foreground">
              Conciliados
              <HelpTip text={AUDIT_GLOSSARY.reconciled.body} />
            </p>
            <p className="text-xl font-semibold text-emerald-600">{counts.reconciled.toLocaleString('es-PE')}</p>
            <p className="text-xs text-muted-foreground">{formatMoney(audit.totalAmountReconciled)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-muted-foreground">
              Pendientes
              <HelpTip text={AUDIT_GLOSSARY.pending.body} />
            </p>
            <p className="text-xl font-semibold text-amber-600">{counts.pending.toLocaleString('es-PE')}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-muted-foreground">
              Con diferencia
              <HelpTip text={AUDIT_GLOSSARY.difference.body} />
            </p>
            <p className="text-xl font-semibold text-red-600">{counts.difference.toLocaleString('es-PE')}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-muted-foreground">
              Banco sin venta
              <HelpTip text={AUDIT_GLOSSARY.orphanBank.body} />
            </p>
            <p className="text-xl font-semibold text-red-600">{audit.orphanBank.toLocaleString('es-PE')}</p>
            <p className="text-xs text-muted-foreground">{formatMoney(audit.totalAmountOrphanBank)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-muted-foreground">
              Venta sin banco
              <HelpTip text={AUDIT_GLOSSARY.orphanSales.body} />
            </p>
            <p className="text-xl font-semibold text-amber-600">{audit.orphanSales.toLocaleString('es-PE')}</p>
            <p className="text-xs text-muted-foreground">{formatMoney(audit.totalAmountOrphanSales)}</p>
          </div>
        </div>

        <Card className="border-dashed bg-muted/20">
          <CardContent className="pt-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Cómo leer las barras (ejemplo Mercado Pago 71% — 2265/3192)</p>
            <p>
              De {SOURCE_LABELS.mercado_pago} importaste <strong>3192</strong> movimientos. De esos,{' '}
              <strong>2265</strong> encontraron una venta ERP emparejada (mismo N° operación o monto+fecha). Los{' '}
              <strong>927</strong> restantes aparecen como «banco sin venta» en Cruces. Lo mismo aplica a BCP, Niubiz
              y Ventas ERP desde su perspectiva.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
