import { useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { HardHat, Loader2, Plus, Settings2 } from 'lucide-react';

import type { SystemSettings, User } from '../../types';
import type { AccidentesFilters, WorkplaceAccidentRecord } from '../../types/accidentes';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import {
  buildStaffOptions,
  filterAccidentRecords,
  removeAccidentRecord,
  upsertAccidentRecord,
} from '../../utils/accidentesData';
import { computeAccidentesKpis } from '../../utils/accidentesKpi';
import { useAccidentesModuleState } from '../../hooks/useAccidentesModuleState';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AccidenteFormDialog } from './AccidenteFormDialog';
import { AccidentesDashboard } from './AccidentesDashboard';
import { AccidentesFiltersBar } from './AccidentesFilters';
import { AccidentesTable } from './AccidentesTable';

export interface AccidentesModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  visibleSedes?: string[];
  canEdit?: boolean;
  reportedBy?: string;
}

function defaultFilters(): AccidentesFilters {
  const now = new Date();
  const from = startOfMonth(subMonths(now, 11));
  return {
    dateFrom: format(from, 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
    sede: 'Todas',
    workArea: 'Todas',
    workShift: 'Todas',
    bodyPart: 'Todas',
    injuryNature: 'Todas',
  };
}

export function AccidentesModule({
  users,
  systemSettings,
  visibleSedes = [],
  canEdit = false,
  reportedBy,
}: AccidentesModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const { settings, loading, saving, updateSettings } = useAccidentesModuleState(canEdit);
  const [filters, setFilters] = useState(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkplaceAccidentRecord | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

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
    () => filterAccidentRecords(settings.records, filters),
    [settings.records, filters]
  );

  const kpis = useMemo(
    () => computeAccidentesKpis({ settings, filters, users }),
    [settings, filters, users]
  );

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (record: WorkplaceAccidentRecord) => {
    setEditing(record);
    setFormOpen(true);
  };

  const handleSave = (
    record: Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    updateSettings(
      (prev) => upsertAccidentRecord(prev, record),
      editing ? 'Accidente actualizado.' : 'Accidente registrado correctamente.'
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este registro de accidente?')) return;
    updateSettings((prev) => removeAccidentRecord(prev, id), 'Registro eliminado.');
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando módulo SST…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300">
            <HardHat className="h-5 w-5" />
            <span className="text-sm font-medium">Seguridad y salud ocupacional</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Accidentes de trabajo</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Registro estandarizado, KPI de frecuencia y gravedad, mapa corporal y análisis por sede,
            área y turno — integrado con colaboradores de la clínica veterinaria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo registro
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setConfigOpen((v) => !v)}>
            <Settings2 className="mr-1 h-4 w-4" />
            Config KPI
          </Button>
        </div>
      </div>

      {configOpen ? (
        <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-3 dark:border-slate-700">
          <div className="space-y-1">
            <Label className="text-xs">Horas hombre / trabajador / mes</Label>
            <Input
              type="number"
              min={1}
              value={settings.config.hoursPerWorkerMonth}
              disabled={!canEdit}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    hoursPerWorkerMonth: Number(e.target.value) || 208,
                  },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Costo diario baja (S/)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={settings.config.dailyLostDayCost}
              disabled={!canEdit}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    dailyLostDayCost: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Headcount manual (opcional)</Label>
            <Input
              type="number"
              min={0}
              value={settings.config.manualHeadcount ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    manualHeadcount: e.target.value ? Number(e.target.value) : undefined,
                  },
                }))
              }
            />
          </div>
          {saving ? <p className="text-xs text-muted-foreground sm:col-span-3">Guardando…</p> : null}
        </div>
      ) : null}

      <AccidentesFiltersBar filters={filters} sedeOptions={sedeOptions} onChange={setFilters} />

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard KPI</TabsTrigger>
          <TabsTrigger value="registros">Registros ({filteredRecords.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <AccidentesDashboard kpis={kpis} />
        </TabsContent>
        <TabsContent value="registros" className="mt-4">
          <AccidentesTable
            records={filteredRecords}
            canEdit={canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <AccidenteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editing}
        staffOptions={staffOptions}
        sedeOptions={sedeOptions}
        canEdit={canEdit}
        reportedBy={reportedBy}
        onSave={handleSave}
      />
    </div>
  );
}
