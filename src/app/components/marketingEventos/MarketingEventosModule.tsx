import { useMemo, useState } from 'react';
import { Loader2, Plus, Sparkles } from 'lucide-react';

import type { MarketingEventRecord } from '../../types/marketingEventos';
import {
  computeMarketingEventosKpis,
  defaultMarketingEventosFilters,
  filterMarketingEvents,
  removeMarketingEvent,
  upsertMarketingEvent,
} from '../../utils/marketingEventosData';
import { useMarketingEventosModuleState } from '../../hooks/useMarketingEventosModuleState';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { appConfirm } from '../ui/app-dialog';
import { MarketingEventosDashboard } from './MarketingEventosDashboard';
import { MarketingEventosFiltersBar } from './MarketingEventosFilters';
import { MarketingEventosTable } from './MarketingEventosTable';
import { MarketingEventoFormDialog } from './MarketingEventoFormDialog';
import { MarketingEventoWorkspaceDialog } from './MarketingEventoWorkspaceDialog';

export interface MarketingEventosModuleProps {
  canEdit?: boolean;
}

export function MarketingEventosModule({ canEdit = false }: MarketingEventosModuleProps) {
  const { settings, loading, saving, updateSettings } = useMarketingEventosModuleState(canEdit);
  const [filters, setFilters] = useState(defaultMarketingEventosFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingEventRecord | null>(null);
  const [workspace, setWorkspace] = useState<MarketingEventRecord | null>(null);
  const [openWorkspaceAfterCreate, setOpenWorkspaceAfterCreate] = useState(false);

  const filtered = useMemo(
    () => filterMarketingEvents(settings.events, filters),
    [settings.events, filters]
  );

  const kpis = useMemo(() => computeMarketingEventosKpis(filtered), [filtered]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const e of settings.events) {
      if (e.startDate?.length >= 4) years.add(e.startDate.slice(0, 4));
    }
    const current = String(new Date().getFullYear());
    years.add(current);
    return Array.from(years);
  }, [settings.events]);

  const openNew = () => {
    setEditing(null);
    setOpenWorkspaceAfterCreate(true);
    setFormOpen(true);
  };

  const openEditMeta = (record: MarketingEventRecord) => {
    setEditing(record);
    setOpenWorkspaceAfterCreate(false);
    setFormOpen(true);
  };

  const handleSaveMeta = (
    payload: Omit<MarketingEventRecord, 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
    }
  ) => {
    const wasNew = !payload.id;
    let createdEvent: MarketingEventRecord | null = null;
    updateSettings((prev) => {
      const result = upsertMarketingEvent(prev, payload);
      createdEvent = result.event;
      return result.settings;
    }, wasNew ? 'Evento creado. Completa presupuesto y reales.' : 'Datos del evento actualizados.');
    if (wasNew && openWorkspaceAfterCreate && createdEvent) {
      queueMicrotask(() => setWorkspace(createdEvent));
    }
  };

  const handleSaveLines = (next: {
    id: string;
    incomeLines: MarketingEventRecord['incomeLines'];
    expenseLines: MarketingEventRecord['expenseLines'];
  }) => {
    const current = settings.events.find((e) => e.id === next.id);
    if (!current) return;
    updateSettings(
      (prev) =>
        upsertMarketingEvent(prev, {
          ...current,
          incomeLines: next.incomeLines,
          expenseLines: next.expenseLines,
        }).settings,
      'Presupuesto y reales guardados.'
    );
  };

  const handleDelete = async (id: string) => {
    if (!(await appConfirm('¿Eliminar este evento/curso y todos sus montos?'))) return;
    updateSettings((prev) => removeMarketingEvent(prev, id), 'Evento eliminado.');
    if (workspace?.id === id) setWorkspace(null);
  };

  /** Mantener el workspace sincronizado con settings */
  const workspaceLive = useMemo(() => {
    if (!workspace) return null;
    return settings.events.find((e) => e.id === workspace.id) ?? workspace;
  }, [workspace, settings.events]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando Marketing Eventos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-300">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Marketing</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Eventos y cursos
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Control operativo del área: ingresos y egresos con presupuesto vs real, y un estado de
            resultados simple para ver si ganaron o perdieron. No se vincula a cuentas contables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo evento / curso
            </Button>
          ) : null}
        </div>
      </div>

      {saving ? <p className="text-xs text-muted-foreground">Guardando…</p> : null}

      <MarketingEventosFiltersBar
        filters={filters}
        yearOptions={yearOptions}
        onChange={setFilters}
      />

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
          <TabsTrigger value="lista">Lista ({filtered.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <MarketingEventosDashboard kpis={kpis} />
        </TabsContent>
        <TabsContent value="lista" className="mt-4">
          <MarketingEventosTable
            records={filtered}
            canEdit={canEdit}
            onOpen={setWorkspace}
            onEdit={openEditMeta}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <MarketingEventoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editing}
        canEdit={canEdit}
        onSave={handleSaveMeta}
      />

      <MarketingEventoWorkspaceDialog
        open={Boolean(workspaceLive)}
        onOpenChange={(open) => !open && setWorkspace(null)}
        record={workspaceLive}
        canEdit={canEdit}
        onSaveLines={handleSaveLines}
      />
    </div>
  );
}
