import { useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { Loader2, Plus, Shirt } from 'lucide-react';

import type { SystemSettings, User } from '../../types';
import type { UniformDeliveryRecord, UniformesFilters } from '../../types/uniformes';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { buildStaffOptions } from '../../utils/accidentesData';
import {
  computeUniformesKpis,
  filterUniformDeliveries,
  removeUniformDelivery,
  upsertUniformDelivery,
} from '../../utils/uniformesData';
import { useUniformesModuleState } from '../../hooks/useUniformesModuleState';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { UniformeEntregaFormDialog } from './UniformeEntregaFormDialog';
import { UniformesDashboard } from './UniformesDashboard';
import { UniformesFiltersBar } from './UniformesFilters';
import { UniformesTable } from './UniformesTable';

export interface UniformesModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  visibleSedes?: string[];
  canEdit?: boolean;
  deliveredBy?: string;
}

function defaultFilters(): UniformesFilters {
  const now = new Date();
  const from = startOfMonth(subMonths(now, 11));
  return {
    dateFrom: format(from, 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
    sede: 'Todas',
    workArea: 'Todas',
    itemType: 'Todas',
    status: 'Todas',
    reason: 'Todas',
  };
}

export function UniformesModule({
  users,
  systemSettings,
  visibleSedes = [],
  canEdit = false,
  deliveredBy,
}: UniformesModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const { settings, loading, saving, updateSettings } = useUniformesModuleState(canEdit);
  const [filters, setFilters] = useState(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UniformDeliveryRecord | null>(null);

  const sedeOptions = useMemo(() => {
    const fromRecords = settings.records.map((r) => r.sede);
    const fromUsers = users.flatMap((u) => u.sedes ?? (u.location ? [u.location] : []));
    const fromStaff = (asistencia.staff ?? []).map((s) => s.sedeName);
    const all = [...new Set([...visibleSedes, ...fromRecords, ...fromUsers, ...fromStaff])].filter(Boolean);
    return all.length > 0 ? all : ['Principal'];
  }, [visibleSedes, settings.records, users, asistencia]);

  const staffOptions = useMemo(
    () => buildStaffOptions({ users, asistencia, visibleSedes: sedeOptions }),
    [users, asistencia, sedeOptions]
  );

  const filteredRecords = useMemo(
    () => filterUniformDeliveries(settings.records, filters),
    [settings.records, filters]
  );

  const kpis = useMemo(() => computeUniformesKpis(filteredRecords), [filteredRecords]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (record: UniformDeliveryRecord) => {
    setEditing(record);
    setFormOpen(true);
  };

  const handleSave = (
    record: Omit<UniformDeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    updateSettings(
      (prev) => upsertUniformDelivery(prev, record),
      editing ? 'Entrega actualizada.' : 'Entrega registrada correctamente.'
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este registro de entrega?')) return;
    updateSettings((prev) => removeUniformDelivery(prev, id), 'Registro eliminado.');
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando módulo de uniformes…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
            <Shirt className="h-5 w-5" />
            <span className="text-sm font-medium">Recursos humanos</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Entrega de uniformes</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Registro de entregas de indumentaria al personal: polo, bata, delantal, zapatos y más.
            Control por sede, talla, motivo y estado de confirmación.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Nueva entrega
            </Button>
          ) : null}
        </div>
      </div>

      {saving ? <p className="text-xs text-muted-foreground">Guardando…</p> : null}

      <UniformesFiltersBar filters={filters} sedeOptions={sedeOptions} onChange={setFilters} />

      <Tabs defaultValue="registros">
        <TabsList>
          <TabsTrigger value="registros">Entregas ({filteredRecords.length})</TabsTrigger>
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
        </TabsList>
        <TabsContent value="registros" className="mt-4">
          <UniformesTable
            records={filteredRecords}
            canEdit={canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <UniformesDashboard kpis={kpis} />
        </TabsContent>
      </Tabs>

      <UniformeEntregaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editing}
        staffOptions={staffOptions}
        sedeOptions={sedeOptions}
        canEdit={canEdit}
        deliveredBy={deliveredBy}
        onSave={handleSave}
      />
    </div>
  );
}
