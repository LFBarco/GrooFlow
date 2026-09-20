import { useMemo, useState } from 'react';
import { Download, HardHat, Loader2, Plus, Settings2 } from 'lucide-react';

import type { SystemSettings, User } from '../../types';
import type { WorkplaceAccidentRecord, AccidentWorkflowStatus } from '../../types/accidentes';
import { buildFilterSedeOptions, buildFormSedeOptions } from '../../utils/gestionSedes';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { exportAccidentesExcel } from '../../utils/accidentesExport';
import {
  buildStaffOptions,
  filterAccidentRecords,
  removeAccidentRecord,
  upsertAccidentRecord,
} from '../../utils/accidentesData';
import { computeAccidentesKpis } from '../../utils/accidentesKpi';
import { useAccidentesModuleState } from '../../hooks/useAccidentesModuleState';
import { useHrCollaborators } from '../../hooks/useHrCollaborators';
import { useHrStaffRecords } from '../../hooks/useHrStaffRecords';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AccidentesAlertBanner } from './AccidentesAlertBanner';
import { AccidenteFormDialog } from './AccidenteFormDialog';
import { AccidenteDetailDialog } from './AccidenteDetailDialog';
import { AccidentesDashboard } from './AccidentesDashboard';
import { AccidentesFiltersBar, defaultAccidentesFilters } from './AccidentesFilters';
import { AccidentesTable } from './AccidentesTable';
import { appConfirm } from '../ui/app-dialog';

export interface AccidentesModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  visibleSedes?: string[];
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canConfigure?: boolean;
  canExport?: boolean;
  reportedBy?: string;
}

function defaultFilters() {
  return defaultAccidentesFilters();
}

export function AccidentesModule({
  users,
  systemSettings,
  visibleSedes = [],
  canAdd = false,
  canEdit = false,
  canDelete = false,
  canConfigure = false,
  canExport = true,
  reportedBy,
}: AccidentesModuleProps) {
  const canPersist = canAdd || canEdit || canDelete || canConfigure;
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const { settings, loading, saving, updateSettings } = useAccidentesModuleState(canPersist);
  const { employees: collaborators, loading: collaboratorsLoading } = useHrCollaborators();
  const { uniforms: uniformRecords } = useHrStaffRecords();
  const [filters, setFilters] = useState(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkplaceAccidentRecord | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<WorkplaceAccidentRecord | null>(null);

  const sedeOptions = useMemo(() => {
    const extras = [
      ...settings.records.map((r) => r.sede),
      ...(asistencia.staff ?? []).map((s) => s.sedeName),
      ...collaborators.map((c) => c.sede || ''),
    ];
    return buildFilterSedeOptions({ visibleSedes, extra: extras });
  }, [visibleSedes, settings.records, asistencia, collaborators]);

  const formSedeOptions = useMemo(
    () => buildFormSedeOptions(visibleSedes),
    [visibleSedes]
  );

  const staffOptions = useMemo(
    () =>
      buildStaffOptions({
        users,
        asistencia,
        visibleSedes: formSedeOptions,
        employees: collaborators,
      }),
    [users, asistencia, formSedeOptions, collaborators]
  );

  const areaFilterOptions = useMemo(() => {
    const fromStaff = staffOptions.map((s) => s.workArea);
    const fromRecords = settings.records.map((r) => r.workArea);
    return [...new Set([...fromStaff, ...fromRecords].map((a) => a.trim()).filter(Boolean))];
  }, [staffOptions, settings.records]);

  const filteredRecords = useMemo(
    () => filterAccidentRecords(settings.records, filters),
    [settings.records, filters]
  );

  const kpis = useMemo(
    () => computeAccidentesKpis({ settings, filters, users }),
    [settings, filters, users]
  );

  const openNew = () => {
    if (!canAdd) return;
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (record: WorkplaceAccidentRecord) => {
    if (!canEdit) return;
    setEditing(record);
    setFormOpen(true);
  };

  const handleSave = (
    record: Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    const isNew = !editing && !record.id;
    if (isNew && !canAdd) return;
    if (!isNew && !canEdit) return;
    updateSettings(
      (prev) => upsertAccidentRecord(prev, record),
      editing ? 'Accidente actualizado.' : 'Accidente registrado correctamente.'
    );
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) return;
    if (!await appConfirm('¿Eliminar este registro de accidente?')) return;
    updateSettings((prev) => removeAccidentRecord(prev, id), 'Registro eliminado.');
  };

  const handleAdvanceWorkflow = (recordId: string, status: AccidentWorkflowStatus) => {
    if (!canEdit) return;
    updateSettings((prev) => {
      const record = prev.records.find((r) => r.id === recordId);
      if (!record) return prev;
      const next = upsertAccidentRecord(prev, { ...record, workflowStatus: status });
      const updated = next.records.find((r) => r.id === recordId);
      if (updated) setDetailRecord(updated);
      return next;
    }, 'Flujo de investigación actualizado.');
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando módulo SST…
      </div>
    );
  }

  const formCanWrite = editing ? canEdit : canAdd;

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
            área y turno — sincronizado con Colaboradores (Buk.pe).
          </p>
          {collaboratorsLoading ? (
            <p className="text-xs text-muted-foreground">Cargando catálogo de colaboradores…</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {staffOptions.length} colaborador{staffOptions.length === 1 ? '' : 'es'} disponible
              {staffOptions.length === 1 ? '' : 's'} para el formulario.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdd ? (
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo registro
            </Button>
          ) : null}
          {canConfigure ? (
            <Button variant="outline" onClick={() => setConfigOpen((v) => !v)}>
              <Settings2 className="mr-1 h-4 w-4" />
              Config KPI
            </Button>
          ) : null}
          {canExport ? (
            <Button
              variant="outline"
              onClick={() => exportAccidentesExcel(filteredRecords, filters.dateFrom, filters.dateTo)}
              disabled={filteredRecords.length === 0}
            >
              <Download className="mr-1 h-4 w-4" />
              Exportar Excel
            </Button>
          ) : null}
        </div>
      </div>

      {configOpen && canConfigure ? (
        <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-3 lg:grid-cols-5 dark:border-slate-700">
          <div className="space-y-1">
            <Label className="text-xs">Horas hombre / trabajador / mes</Label>
            <Input
              type="number"
              min={1}
              value={settings.config.hoursPerWorkerMonth}
              disabled={!canEdit && !canConfigure}
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
              disabled={!canEdit && !canConfigure}
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
              disabled={!canEdit && !canConfigure}
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
          <div className="space-y-1">
            <Label className="text-xs">Alerta IF máx.</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder="Ej. 25"
              value={settings.config.alertMaxFrequencyIndex ?? ''}
              disabled={!canEdit && !canConfigure}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    alertMaxFrequencyIndex: e.target.value ? Number(e.target.value) : undefined,
                  },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alerta IG máx.</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder="Ej. 5"
              value={settings.config.alertMaxGravityIndex ?? ''}
              disabled={!canEdit && !canConfigure}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    alertMaxGravityIndex: e.target.value ? Number(e.target.value) : undefined,
                  },
                }))
              }
            />
          </div>
          {saving ? <p className="text-xs text-muted-foreground sm:col-span-5">Guardando…</p> : null}
        </div>
      ) : null}

      <AccidentesFiltersBar
        filters={filters}
        sedeOptions={sedeOptions}
        workAreaOptions={areaFilterOptions}
        onChange={setFilters}
      />

      <AccidentesAlertBanner kpis={kpis} config={settings.config} />

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
            canDelete={canDelete}
            onView={setDetailRecord}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <AccidenteDetailDialog
        record={detailRecord}
        open={Boolean(detailRecord)}
        onOpenChange={(open) => !open && setDetailRecord(null)}
        canEdit={canEdit}
        allRecords={settings.records}
        uniformRecords={uniformRecords}
        onAdvanceWorkflow={handleAdvanceWorkflow}
      />

      <AccidenteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editing}
        staffOptions={staffOptions}
        sedeOptions={formSedeOptions}
        canEdit={formCanWrite}
        reportedBy={reportedBy}
        onSave={handleSave}
      />
    </div>
  );
}
