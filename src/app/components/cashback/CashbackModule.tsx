import { useCallback, useEffect, useState } from 'react';
import { HandCoins, Loader2, RefreshCw } from 'lucide-react';

import type { CashbackInvoice, CashbackMeResponse, CashbackSettings } from '../../types/cashback';
import { fetchCashbackMe } from '../../utils/cashbackApi';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CashbackInvoiceDialog } from './CashbackInvoiceDialog';
import { CashbackLiquidationPanel } from './CashbackLiquidationPanel';
import { CashbackMyInvoices } from './CashbackMyInvoices';
import { CashbackReportsPanel } from './CashbackReportsPanel';
import { CashbackReviewPanel } from './CashbackReviewPanel';
import { CashbackSettingsPanel } from './CashbackSettingsPanel';

export function CashbackModule() {
  const [data, setData] = useState<CashbackMeResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashbackInvoice | null>(null);
  const [tab, setTab] = useState('mis');

  const load = useCallback(async () => {
    try {
      setData(await fetchCashbackMe());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar Cashback.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando Cashback…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>{error || 'No se pudo cargar Cashback.'}</p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  const { capabilities, settings } = data;
  const canSeeTeam = capabilities.review || capabilities.export || capabilities.configure;
  const setSettings = (next: CashbackSettings) => setData((d) => (d ? { ...d, settings: next } : d));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
            <HandCoins className="h-5 w-5" />
            <span className="text-sm font-medium">Finanzas · Beneficio colaborador</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Cashback por facturas</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Trae tu factura a nombre de la empresa y te reconocemos un importe. Contabilidad valida cada comprobante, el
            saldo se acumula mes a mes y se libera al alcanzar la meta.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Actualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="mis">Mis facturas</TabsTrigger>
          {canSeeTeam ? <TabsTrigger value="validacion">Validación</TabsTrigger> : null}
          {canSeeTeam ? <TabsTrigger value="liquidacion">Saldos y liquidación</TabsTrigger> : null}
          {canSeeTeam ? <TabsTrigger value="reportes">Reportes</TabsTrigger> : null}
          {capabilities.configure ? <TabsTrigger value="config">Reglas</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="mis" className="mt-4">
          <CashbackMyInvoices
            data={data}
            onNew={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            onEdit={(inv) => {
              setEditing(inv);
              setDialogOpen(true);
            }}
            onChanged={() => void load()}
          />
        </TabsContent>
        {canSeeTeam ? (
          <TabsContent value="validacion" className="mt-4">
            <CashbackReviewPanel
              settings={settings}
              canReview={capabilities.review}
              canExport={capabilities.export || capabilities.configure}
              onChanged={() => void load()}
            />
          </TabsContent>
        ) : null}
        {canSeeTeam ? (
          <TabsContent value="liquidacion" className="mt-4">
            <CashbackLiquidationPanel settings={settings} canConfigure={capabilities.configure} onChanged={() => void load()} />
          </TabsContent>
        ) : null}
        {canSeeTeam ? (
          <TabsContent value="reportes" className="mt-4">
            <CashbackReportsPanel settings={settings} canExport={capabilities.export || capabilities.configure} />
          </TabsContent>
        ) : null}
        {capabilities.configure ? (
          <TabsContent value="config" className="mt-4">
            <CashbackSettingsPanel settings={settings} onSaved={setSettings} />
          </TabsContent>
        ) : null}
      </Tabs>

      <CashbackInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        settings={settings}
        editing={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
