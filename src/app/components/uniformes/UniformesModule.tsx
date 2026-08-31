import { useMemo, useState } from 'react';
import { Download, Loader2, Plus, Settings2, Shirt } from 'lucide-react';

import type { SystemSettings, User } from '../../types';
import type { UniformDeliveryRecord } from '../../types/uniformes';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { buildStaffOptions } from '../../utils/accidentesData';
import { exportUniformesExcel } from '../../utils/uniformesExport';
import {
  computeUniformesKpis,
  defaultUniformesFilters,
  filterUniformDeliveries,
  removeUniformDelivery,
  upsertUniformDelivery,
} from '../../utils/uniformesData';
import { useUniformesModuleState } from '../../hooks/useUniformesModuleState';
import { useHrStaffRecords } from '../../hooks/useHrStaffRecords';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { UniformeEntregaFormDialog } from './UniformeEntregaFormDialog';
import { UniformeDetailDialog } from './UniformeDetailDialog';
import { UniformesDashboard } from './UniformesDashboard';
import { UniformesFiltersBar } from './UniformesFilters';
import { UniformesKitsDialog } from './UniformesKitsDialog';
import { UniformesRenewalPanel } from './UniformesRenewalPanel';
import { UniformesTable } from './UniformesTable';
import { listUniformRenewals } from '../../utils/uniformesRenewal';

export interface UniformesModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  visibleSedes?: string[];
  canEdit?: boolean;
  deliveredBy?: string;
}

function defaultFilters() {
  return defaultUniformesFilters();
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
  const { accidents: accidentRecords } = useHrStaffRecords();
  const [filters, setFilters] = useState(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UniformDeliveryRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<UniformDeliveryRecord | null>(null);
  const [kitsOpen, setKitsOpen] = useState(false);

  const kits = settings.kits ?? [];

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

  const kpis = useMemo(
    () => computeUniformesKpis(filteredRecords, { allRecords: settings.records, users }),
    [filteredRecords, settings.records, users]
  );

  const renewalList = useMemo(
    () => listUniformRenewals(settings.records, users),
    [settings.records, users]
  );

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
          {canEdit ? (
            <Button variant="outline" onClick={() => setKitsOpen(true)}>
              <Settings2 className="mr-1 h-4 w-4" />
              Kits
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => exportUniformesExcel(filteredRecords, filters.dateFrom, filters.dateTo)}
            disabled={filteredRecords.length === 0}
          >
            <Download className="mr-1 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {saving ? <p className="text-xs text-muted-foreground">Guardando…</p> : null}

      <UniformesFiltersBar filters={filters} sedeOptions={sedeOptions} onChange={setFilters} />

      <UniformesRenewalPanel renewals={renewalList} />

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
          <TabsTrigger value="registros">Entregas ({filteredRecords.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <UniformesDashboard kpis={kpis} />
        </TabsContent>
        <TabsContent value="registros" className="mt-4">
          <UniformesTable
            records={filteredRecords}
            canEdit={canEdit}
            onView={setDetailRecord}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <UniformeDetailDialog
        record={detailRecord}
        open={Boolean(detailRecord)}
        onOpenChange={(open) => !open && setDetailRecord(null)}
        allRecords={settings.records}
        accidentRecords={accidentRecords}
      />

      <UniformesKitsDialog
        open={kitsOpen}
        onOpenChange={setKitsOpen}
        kits={kits}
        canEdit={canEdit}
        onSave={(nextKits) =>
          updateSettings((prev) => ({ ...prev, kits: nextKits }), 'Kits actualizados.')
        }
      />

      <UniformeEntregaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editing}
        staffOptions={staffOptions}
        sedeOptions={sedeOptions}
        kits={kits}
        canEdit={canEdit}
        deliveredBy={deliveredBy}
        onSave={handleSave}
      />
    </div>
  );
}
