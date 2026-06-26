import { RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { getActiveSession, startNewSession } from '../domain/dataset';
import { useReconciliationDataset } from '../hooks/useReconciliationDataset';
import { runReconciliationEngine } from '../engines/reconciliationRunner';
import { ReconciliationAuditPanel } from './ReconciliationAuditPanel';
import { ReconciliationDashboard } from './ReconciliationDashboard';
import { ReconciliationExceptionsPanel } from './ReconciliationExceptionsPanel';
import { ReconciliationImportPanel } from './ReconciliationImportPanel';

export function ReconciliationModule() {
  const { dataset, setDataset, loaded, saving } = useReconciliationDataset(true);
  const session = getActiveSession(dataset);

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
            Cruce ventas vs BCP, Mercado Pago y Niubiz — sesión {session.label}
            {saving ? ' · Guardando…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDataset((d) => runReconciliationEngine(d))}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-ejecutar motor
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDataset((d) => startNewSession(d))}
          >
            Nueva sesión (día)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="dashboard">Panel</TabsTrigger>
          <TabsTrigger value="audit">Cruces</TabsTrigger>
          <TabsTrigger value="import">Importar</TabsTrigger>
          <TabsTrigger value="exceptions">Excepciones</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <ReconciliationDashboard dataset={dataset} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <ReconciliationAuditPanel dataset={dataset} />
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <ReconciliationImportPanel dataset={dataset} onDatasetChange={setDataset} />
        </TabsContent>
        <TabsContent value="exceptions" className="mt-4">
          <ReconciliationExceptionsPanel dataset={dataset} onDatasetChange={setDataset} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
