import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  closeMonthlySession,
  countMovementsBySession,
  ensureMonthlySession,
  getActiveSession,
  isMonthSessionLabel,
  monthSessionLabel,
  sessionWithMostMovements,
  setActiveSession,
  startNewMonthlySession,
} from '../domain/dataset';
import { useReconciliationDataset } from '../hooks/useReconciliationDataset';
import { runReconciliationEngine } from '../engines/reconciliationRunner';
import { AUDIT_ALL_SESSIONS, type AuditSessionScope } from '../engines/auditQueries';
import type { AuditNavRequest } from '../domain/auditLabels';
import { ReconciliationAuditPanel } from './ReconciliationAuditPanel';
import { ReconciliationDashboard } from './ReconciliationDashboard';
import { ReconciliationExceptionsPanel } from './ReconciliationExceptionsPanel';
import { ReconciliationImportPanel } from './ReconciliationImportPanel';

const nativeSelectClass =
  'h-9 rounded-md border border-input bg-input-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function ReconciliationModule() {
  const { dataset, setDataset, loaded, saving } = useReconciliationDataset(true);
  const session = getActiveSession(dataset);
  const [auditScope, setAuditScope] = useState<AuditSessionScope>(dataset.activeSessionId);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [auditNav, setAuditNav] = useState<AuditNavRequest | null>(null);

  const movementCounts = useMemo(() => countMovementsBySession(dataset), [dataset]);
  const activeCount = movementCounts.get(dataset.activeSessionId) ?? 0;
  const totalMovements = dataset.movements.length;
  const richest = sessionWithMostMovements(dataset);

  useEffect(() => {
    setAuditScope(dataset.activeSessionId);
  }, [dataset.activeSessionId]);

  useEffect(() => {
    if (!loaded) return;
    setDataset((d) => ensureMonthlySession(d));
  }, [loaded, setDataset]);

  if (!loaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground text-sm">
        Cargando conciliación…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conciliación de ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Cruce ventas vs BCP, Mercado Pago y Niubiz — mes activo{' '}
            <strong>{session.label}</strong>
            {session.closedAt ? ' (cerrado)' : ''}
            {saving ? ' · Guardando…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${nativeSelectClass} min-w-[220px]`}
            value={dataset.activeSessionId}
            onChange={(e) => setDataset((d) => setActiveSession(d, e.target.value))}
            aria-label="Sesión activa para importar"
          >
            {dataset.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {isMonthSessionLabel(s.label) ? s.label : s.label} (
                {(movementCounts.get(s.id) ?? 0).toLocaleString('es-PE')} movs)
                {s.closedAt ? ' · cerrado' : ''}
              </option>
            ))}
          </select>
          <input
            type="month"
            className={`${nativeSelectClass} w-[140px]`}
            defaultValue={monthSessionLabel()}
            aria-label="Crear o abrir mes"
            onChange={(e) => {
              const label = e.target.value;
              if (!label) return;
              setDataset((d) => startNewMonthlySession(d, label));
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDataset((d) => runReconciliationEngine(d))}
            title="Solo re-cruza pendientes; los conciliados se conservan"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-ejecutar motor
          </Button>
          {!session.closedAt && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDataset((d) => closeMonthlySession(d, session.id))}
            >
              Cerrar mes
            </Button>
          )}
        </div>
      </div>

      {activeCount === 0 && totalMovements > 0 && richest && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p>
              La sesión activa está vacía, pero hay{' '}
              <strong>{totalMovements.toLocaleString('es-PE')}</strong> movimientos en otras sesiones.
            </p>
            <p className="text-muted-foreground">
              Sus importaciones pueden estar en «
              {dataset.sessions.find((s) => s.id === richest.sessionId)?.label ?? 'otra sesión'}» (
              {richest.count.toLocaleString('es-PE')} movs). Elija esa sesión arriba o use «Todas las sesiones» en
              Cruces.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => setDataset((d) => setActiveSession(d, richest.sessionId))}
            >
              Ir a sesión con datos
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="dashboard">Panel</TabsTrigger>
          <TabsTrigger value="audit">Cruces</TabsTrigger>
          <TabsTrigger value="import">Importar</TabsTrigger>
          <TabsTrigger value="exceptions">Excepciones</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <ReconciliationDashboard dataset={dataset} onDatasetChange={setDataset} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          {activeTab === 'audit' && (
          <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Ver cruces de:</span>
            <select
              className={`${nativeSelectClass} min-w-[240px]`}
              value={auditScope}
              onChange={(e) => setAuditScope(e.target.value)}
              aria-label="Alcance de sesión en Cruces"
            >
              <option value={AUDIT_ALL_SESSIONS}>
                Todas las sesiones ({totalMovements.toLocaleString('es-PE')} movs)
              </option>
              {dataset.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({(movementCounts.get(s.id) ?? 0).toLocaleString('es-PE')} movs)
                  {s.id === dataset.activeSessionId ? ' · activa' : ''}
                </option>
              ))}
            </select>
          </div>
          <ReconciliationAuditPanel
            dataset={dataset}
            sessionScope={auditScope}
            navRequest={auditNav}
            onNavConsumed={() => setAuditNav(null)}
          />
          </>
          )}
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <ReconciliationImportPanel dataset={dataset} onDatasetChange={setDataset} />
        </TabsContent>
        <TabsContent value="exceptions" className="mt-4">
          <ReconciliationExceptionsPanel
            dataset={dataset}
            onDatasetChange={setDataset}
            onNavigateToAudit={(nav) => {
              setAuditNav(nav);
              setActiveTab('audit');
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
