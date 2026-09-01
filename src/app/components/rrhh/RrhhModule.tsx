import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Columns3,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings, User } from '../../types';
import { mergeBukPeSettings } from '../../utils/bukPeApi';
import { fetchAllBukPeEmployees } from '../../utils/bukPeEmployeesApi';
import {
  RRHH_COLUMN_DEFS,
  autoLinkBukEmployeesToUsers,
  buildRrhhRecommendations,
  computeRrhhDashboard,
  usersToDisableForTerminations,
} from '../../utils/bukPeEmployeeUtils';
import { useRrhhModuleState } from '../../hooks/useRrhhModuleState';
import { RrhhBajasPanel } from './RrhhBajasPanel';
import { RrhhDashboard } from './RrhhDashboard';
import { RrhhEmployeesTable } from './RrhhEmployeesTable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';

export interface RrhhModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  canEdit?: boolean;
  onUpdateUsers?: (updater: (prev: User[]) => User[]) => void;
  onPersistUsers?: (users: User[]) => Promise<boolean>;
}

export function RrhhModule({
  users,
  systemSettings,
  canEdit = false,
  onUpdateUsers,
  onPersistUsers,
}: RrhhModuleProps) {
  const bukPe = mergeBukPeSettings(systemSettings.bukPe);
  const { settings, loading, saving, updateSettings, persistNow } = useRrhhModuleState(canEdit);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [draftColumns, setDraftColumns] = useState<string[]>(settings.visibleColumns);

  const activeEmployees = useMemo(
    () => settings.employees.filter((e) => e.isActive),
    [settings.employees]
  );

  const kpis = useMemo(
    () => computeRrhhDashboard(settings.employees, settings.userLinks, users),
    [settings.employees, settings.userLinks, users]
  );

  const recommendations = useMemo(
    () =>
      buildRrhhRecommendations(
        kpis,
        settings.employees,
        settings.userLinks,
        settings.autoDisableOnTermination
      ),
    [kpis, settings.employees, settings.userLinks, settings.autoDisableOnTermination]
  );

  const applyDisableUsers = async (userIds: string[]) => {
    if (!canEdit || userIds.length === 0) return;
    const idSet = new Set(userIds);
    const nextUsers = users.map((u) =>
      idSet.has(u.id) ? { ...u, status: 'inactive' as const } : u
    );
    onUpdateUsers?.(() => nextUsers);
    const ok = onPersistUsers ? await onPersistUsers(nextUsers) : true;
    if (ok) toast.success(`${userIds.length} usuario(s) deshabilitado(s).`);
    else toast.error('No se pudieron guardar los usuarios.');
  };

  const disableUser = (userId: string) => {
    void applyDisableUsers([userId]);
  };

  const disableAllPending = () => {
    const pending = usersToDisableForTerminations(settings.employees, settings.userLinks, users);
    void applyDisableUsers(pending.map((u) => u.id));
  };

  const runSync = async () => {
    if (!canEdit) return;
    setSyncing(true);
    try {
      const result = await fetchAllBukPeEmployees({ bukPe: systemSettings.bukPe });
      if (!result.ok) {
        toast.error(result.message);
        updateSettings(
          (prev) => ({
            ...prev,
            lastSyncAt: new Date().toISOString(),
            lastSyncOk: false,
            lastSyncMessage: result.message,
            syncLog: [
              { at: new Date().toISOString(), ok: false, message: result.message },
              ...prev.syncLog,
            ].slice(0, 30),
          }),
          undefined
        );
        return;
      }

      const links = autoLinkBukEmployeesToUsers(result.employees, users, settings.userLinks);
      let usersDisabled = 0;

      if (settings.autoDisableOnTermination) {
        const toDisable = usersToDisableForTerminations(result.employees, links, users);
        if (toDisable.length > 0) {
          const nextUsers = users.map((u) =>
            toDisable.some((d) => d.id === u.id) ? { ...u, status: 'inactive' as const } : u
          );
          onUpdateUsers?.(() => nextUsers);
          if (onPersistUsers) await onPersistUsers(nextUsers);
          usersDisabled = toDisable.length;
        }
      }

      const at = new Date().toISOString();
      const logMessage = `${result.message}${usersDisabled > 0 ? ` ${usersDisabled} usuario(s) deshabilitado(s).` : ''}`;

      const nextSettings = {
        ...settings,
        employees: result.employees,
        userLinks: links,
        lastSyncAt: at,
        lastSyncOk: true,
        lastSyncMessage: logMessage,
        syncLog: [
          {
            at,
            ok: true,
            message: logMessage,
            employeesLoaded: result.employees.length,
            usersDisabled,
            usersLinked: links.length,
          },
          ...settings.syncLog,
        ].slice(0, 30),
      };

      updateSettings(() => nextSettings);
      await persistNow(nextSettings, 'Sincronización Buk.pe completada.');
      toast.success(logMessage);
    } finally {
      setSyncing(false);
    }
  };

  const openColumns = () => {
    setDraftColumns(settings.visibleColumns);
    setColumnsOpen(true);
  };

  const saveColumns = () => {
    updateSettings((prev) => ({ ...prev, visibleColumns: draftColumns }), 'Columnas guardadas.');
    setColumnsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando Recursos Humanos…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7" />
            Recursos Humanos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Maestro de colaboradores desde Buk.pe — tabla configurable, bajas y vinculación con usuarios GrooFlow.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={bukPe.enabled ? 'default' : 'secondary'}>
              Buk.pe {bukPe.enabled ? 'activo' : 'inactivo'}
            </Badge>
            {settings.lastSyncAt ? (
              <Badge variant="outline">
                Sync {format(new Date(settings.lastSyncAt), "d MMM HH:mm", { locale: es })}
              </Badge>
            ) : null}
            {saving ? <Badge variant="outline">Guardando…</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openColumns}>
            <Columns3 className="h-4 w-4 mr-1" />
            Columnas
          </Button>
          {canEdit ? (
            <Button type="button" size="sm" onClick={() => void runSync()} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Sincronizando…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Actualizar desde Buk.pe
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Deshabilitar usuario en bajas Buk</p>
          <p className="text-xs text-muted-foreground">
            Si Buk marca inactivo/desvinculado, el usuario vinculado pasa a inactivo en GrooFlow al sincronizar.
          </p>
        </div>
        <Switch
          checked={settings.autoDisableOnTermination}
          disabled={!canEdit}
          onCheckedChange={(v) =>
            updateSettings((prev) => ({ ...prev, autoDisableOnTermination: v }), v ? 'Bajas automáticas activadas.' : 'Bajas automáticas desactivadas.')
          }
        />
      </div>

      <Tabs defaultValue="colaboradores">
        <TabsList>
          <TabsTrigger value="colaboradores">Colaboradores ({activeEmployees.length})</TabsTrigger>
          <TabsTrigger value="bajas">Bajas ({kpis.terminated})</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="vinculacion">Vinculación ({kpis.linkedUsers})</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="space-y-3 mt-4">
          <Input
            placeholder="Buscar por nombre, email, documento, cargo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <RrhhEmployeesTable
            employees={activeEmployees}
            visibleColumns={settings.visibleColumns}
            links={settings.userLinks}
            users={users}
            search={search}
          />
        </TabsContent>

        <TabsContent value="bajas" className="mt-4">
          <RrhhBajasPanel
            employees={settings.employees}
            links={settings.userLinks}
            users={users}
            canEdit={canEdit}
            onDisableUser={disableUser}
            onDisableAllPending={disableAllPending}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <RrhhDashboard
            kpis={kpis}
            recommendations={recommendations}
            lastSyncAt={settings.lastSyncAt}
            lastSyncMessage={settings.lastSyncMessage}
          />
        </TabsContent>

        <TabsContent value="vinculacion" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Vinculación automática por email corporativo, email personal, documento o nombre exacto.
            Tras cada sync se intentan nuevos enlaces sin romper los manuales existentes.
          </p>
          <RrhhEmployeesTable
            employees={settings.employees.filter((e) => e.isActive)}
            visibleColumns={['fullName', 'email', 'documentNumber', 'cargo', 'status']}
            links={settings.userLinks}
            users={users}
            search={search}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Columnas visibles</DialogTitle>
            <DialogDescription>Elige qué campos de Buk.pe mostrar en la tabla de colaboradores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[...new Set(RRHH_COLUMN_DEFS.map((c) => c.group ?? 'General'))].map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{group}</p>
                <div className="space-y-2">
                  {RRHH_COLUMN_DEFS.filter((c) => (c.group ?? 'General') === group).map((col) => (
                    <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={draftColumns.includes(col.id)}
                        onCheckedChange={(checked) => {
                          setDraftColumns((prev) =>
                            checked
                              ? [...prev, col.id]
                              : prev.filter((id) => id !== col.id)
                          );
                        }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setColumnsOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveColumns} disabled={draftColumns.length === 0}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
