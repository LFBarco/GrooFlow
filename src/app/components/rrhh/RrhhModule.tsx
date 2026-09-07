import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Columns3, Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings, User } from '../../types';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { mergeBukPeSettings } from '../../utils/bukPeApi';
import {
  RRHH_COLUMN_DEFS,
  buildRrhhRecommendations,
  computeRrhhDashboard,
} from '../../utils/bukPeEmployeeUtils';
import {
  fetchRrhhDbStats,
  fetchRrhhPipelineHealth,
  projectAsistenciaStaffFromRrhh,
  runRrhhPipelines,
  syncRrhhToDatabase,
  type RrhhDbStats,
  type RrhhPipelineHealth,
} from '../../utils/rrhhApi';
import { useRrhhModuleState } from '../../hooks/useRrhhModuleState';
import { RrhhDashboard } from './RrhhDashboard';
import { RrhhEmployeesDataTable } from './RrhhEmployeesDataTable';
import { RrhhIdentityDiagnosisPanel } from './RrhhIdentityDiagnosisPanel';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

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
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const { settings, loading, saving, updateSettings } = useRrhhModuleState(canEdit);
  const [syncing, setSyncing] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [draftColumns, setDraftColumns] = useState<string[]>(settings.visibleColumns);
  const [dbStats, setDbStats] = useState<RrhhDbStats | null>(null);
  const [tableRefresh, setTableRefresh] = useState(0);
  const [pipelineHealth, setPipelineHealth] = useState<RrhhPipelineHealth | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [projecting, setProjecting] = useState(false);

  const reloadDbStats = async () => {
    try {
      setDbStats(await fetchRrhhDbStats());
    } catch {
      /* ignore */
    }
  };

  const reloadPipelineHealth = async () => {
    try {
      setPipelineHealth(await fetchRrhhPipelineHealth());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void reloadDbStats();
    void reloadPipelineHealth();
  }, [tableRefresh]);

  // Soft tick: al abrir RRHH, dispara pipelines solo si están due (no fuerza).
  useEffect(() => {
    if (!canEdit || settings.staffSyncEnabled === false) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await runRrhhPipelines({});
        if (cancelled || !result.ok) return;
        const ranSomething = Object.values(result.steps ?? {}).some(
          (s) => s && typeof s === 'object' && (s as { ran?: boolean }).ran === true
        );
        if (ranSomething) {
          setTableRefresh((n) => n + 1);
          if (result.health) setPipelineHealth(result.health);
        } else {
          await reloadPipelineHealth();
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo al montar el módulo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPipelinesNow = async (force = false) => {
    if (!canEdit) return;
    setPipelineRunning(true);
    try {
      const result = await runRrhhPipelines({ force });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.health) setPipelineHealth(result.health);
      setTableRefresh((n) => n + 1);
      toast.success(result.message || 'Pipelines ejecutados');
    } finally {
      setPipelineRunning(false);
    }
  };

  const kpis = useMemo(() => {
    if (dbStats) {
      return {
        total: dbStats.total,
        active: dbStats.activos,
        terminated: dbStats.bajas,
        linkedUsers: dbStats.linkedActivos,
        unlinkedActive: dbStats.unlinkedActivos,
        pendingDisable: 0,
        withAsistencia: dbStats.enriched,
        withoutAsistencia: Math.max(0, dbStats.activos - dbStats.enriched),
        byArea: dbStats.byArea ?? [],
        byCargo: dbStats.byCargo ?? [],
        byRecinto: dbStats.byRecinto ?? [],
      };
    }
    return computeRrhhDashboard(settings.employees, settings.userLinks, users);
  }, [dbStats, settings.employees, settings.userLinks, users]);

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

  const runSync = async () => {
    if (!canEdit) return;
    setSyncing(true);
    try {
      toast.info('Sincronizando Buk.pe → BD…');
      const result = await syncRrhhToDatabase({
        includeAsistencia: settings.includeAsistenciaEnrichment !== false,
      });
      const at = new Date().toISOString();
      if (!result.ok) {
        updateSettings((prev) => ({
          ...prev,
          lastSyncAt: at,
          lastSyncOk: false,
          lastSyncMessage: result.message,
          syncLog: [{ at, ok: false, message: result.message }, ...prev.syncLog].slice(0, 30),
        }));
        toast.error(result.message);
        return;
      }
      updateSettings((prev) => ({
        ...prev,
        employees: [], // maestro vive en MySQL
        lastSyncAt: at,
        lastSyncOk: true,
        lastSyncMessage: result.message,
        lastSyncStats: result.stats,
        syncLog: [
          {
            at,
            ok: true,
            message: result.message,
            employeesLoaded: result.stats?.total,
            stats: result.stats,
            asistenciaMatched: result.asistenciaMatched,
            durationMs: result.duration_ms,
          },
          ...prev.syncLog,
        ].slice(0, 30),
      }));
      setTableRefresh((n) => n + 1);
      if (result.truncated) {
        toast.warning(result.message);
      } else {
        toast.success(result.message);
      }
      // Fase 4: proyectar organigrama tras sync maestro.
      try {
        const proj = await projectAsistenciaStaffFromRrhh();
        if (proj.ok) toast.message(proj.message);
      } catch {
        /* ignore */
      }
    } finally {
      setSyncing(false);
    }
  };

  const runProjectOrganigrama = async () => {
    if (!canEdit) return;
    setProjecting(true);
    try {
      const proj = await projectAsistenciaStaffFromRrhh();
      if (!proj.ok) {
        toast.error(proj.message);
        return;
      }
      toast.success(proj.message);
      setTableRefresh((n) => n + 1);
    } finally {
      setProjecting(false);
    }
  };

  const disableGrooflowUser = async (userId: string) => {
    if (!onUpdateUsers || !onPersistUsers) return;
    let next: User[] = [];
    onUpdateUsers((prev) => {
      next = prev.map((u) => (u.id === userId ? { ...u, status: 'inactive' as const } : u));
      return next;
    });
    const ok = await onPersistUsers(next);
    if (ok) toast.success('Usuario deshabilitado');
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
            Maestro de colaboradores en MySQL (sync Buk.pe + asistencia Ctrlit). La tabla pagina y busca
            desde el servidor; cada página consulta la BD, no la API de Buk.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={bukPe.enabled ? 'default' : 'secondary'}>
              Buk.pe {bukPe.enabled ? 'activo' : 'inactivo'}
            </Badge>
            <Badge variant={asistencia.buk?.enabled ? 'default' : 'secondary'}>
              Asistencia {asistencia.buk?.enabled ? 'activa' : 'inactiva'}
            </Badge>
            {dbStats ? (
              <Badge variant="outline">{dbStats.total} en BD</Badge>
            ) : null}
            {settings.lastSyncAt ? (
              <Badge variant={settings.lastSyncOk === false ? 'destructive' : 'outline'}>
                Sync {format(new Date(settings.lastSyncAt), 'd MMM HH:mm', { locale: es })}
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
                  Sincronizando a BD…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sincronizar colaboradores
                </>
              )}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runProjectOrganigrama()}
              disabled={projecting || syncing}
            >
              {projecting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-1" />
              )}
              Proyectar organigrama
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void runPipelinesNow(true)}
              disabled={pipelineRunning || syncing}
            >
              {pipelineRunning ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Pipelines
            </Button>
          ) : null}
        </div>
      </div>

      {pipelineHealth ? (
        <Card className={pipelineHealth.ok ? 'border-dashed' : 'border-amber-300'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline identidad (Fase 3)</CardTitle>
            <CardDescription>{pipelineHealth.summary}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            <Badge variant={pipelineHealth.rrhh.syncedToday ? 'default' : 'secondary'}>
              RRHH {pipelineHealth.rrhh.syncedToday ? 'hoy' : 'sin sync hoy'}
            </Badge>
            <Badge variant="outline">
              {pipelineHealth.rrhh.pendingAccess} pendientes acceso
            </Badge>
            <Badge variant="outline">
              {pipelineHealth.rrhh.unmatchedPct}% sin vínculo
            </Badge>
            {pipelineHealth.marcaciones.enabled ? (
              <Badge variant={pipelineHealth.marcaciones.syncedToday ? 'default' : 'secondary'}>
                Marcaciones {pipelineHealth.marcaciones.syncedToday ? 'hoy' : 'pendiente'}
                {pipelineHealth.marcaciones.lastCount
                  ? ` · ${pipelineHealth.marcaciones.lastCount}`
                  : ''}
              </Badge>
            ) : (
              <Badge variant="outline">Marcaciones off</Badge>
            )}
            {pipelineHealth.issues.length > 0
              ? pipelineHealth.issues.slice(0, 4).map((issue) => (
                  <Badge key={issue} variant="outline" className="text-amber-700 border-amber-300">
                    {issue}
                  </Badge>
                ))
              : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Deshabilitar usuario en bajas Buk</p>
            <p className="text-xs text-muted-foreground">
              Política Fase 0: cesado en Buk → desactivar acceso Gestión y sacar del organigrama.
            </p>
          </div>
          <Switch
            checked={settings.autoDisableOnTermination}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              updateSettings(
                (prev) => ({ ...prev, autoDisableOnTermination: v }),
                v ? 'Bajas automáticas activadas.' : 'Bajas automáticas desactivadas.'
              )
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Enriquecer con asistencia Buk</p>
            <p className="text-xs text-muted-foreground">
              Recinto, área, turno, supervisor y últimas marcaciones desde Ctrlit (por DNI).
            </p>
          </div>
          <Switch
            checked={settings.includeAsistenciaEnrichment !== false}
            disabled={!canEdit}
            onCheckedChange={(v) =>
              updateSettings(
                (prev) => ({ ...prev, includeAsistenciaEnrichment: v }),
                v ? 'Asistencia activada en sync.' : 'Solo maestro Buk.pe en sync.'
              )
            }
          />
        </div>
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sync automático a BD</p>
              <p className="text-xs text-muted-foreground">
                Cron cada 15 min; solo corre si pasó el intervalo (default 60). Guarda la respuesta completa de Buk
                en MySQL.
              </p>
            </div>
            <Switch
              checked={settings.staffSyncEnabled !== false}
              disabled={!canEdit}
              onCheckedChange={(v) =>
                updateSettings(
                  (prev) => ({ ...prev, staffSyncEnabled: v }),
                  v ? 'Sync automático RRHH activado.' : 'Sync automático RRHH desactivado.'
                )
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rrhh-sync-interval" className="text-xs">
              Intervalo (minutos)
            </Label>
            <Input
              id="rrhh-sync-interval"
              type="number"
              min={15}
              max={1440}
              disabled={!canEdit || settings.staffSyncEnabled === false}
              value={settings.staffSyncIntervalMinutes ?? 60}
              onChange={(e) => {
                const n = Math.max(15, Math.min(1440, Number(e.target.value) || 60));
                updateSettings((prev) => ({ ...prev, staffSyncIntervalMinutes: n }));
              }}
              onBlur={() => {
                const n = Math.max(15, Math.min(1440, Number(settings.staffSyncIntervalMinutes) || 60));
                updateSettings(
                  (prev) => ({ ...prev, staffSyncIntervalMinutes: n }),
                  `Intervalo RRHH: ${n} min`
                );
              }}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="colaboradores">
        <TabsList>
          <TabsTrigger value="colaboradores">Colaboradores ({dbStats?.activos ?? 0})</TabsTrigger>
          <TabsTrigger value="bajas">Bajas ({dbStats?.bajas ?? 0})</TabsTrigger>
          <TabsTrigger value="identidad">Identidad</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="space-y-3 mt-4">
          <RrhhEmployeesDataTable
            visibleColumns={settings.visibleColumns}
            links={settings.userLinks}
            users={users}
            tab="activos"
            refreshKey={tableRefresh}
          />
        </TabsContent>

        <TabsContent value="bajas" className="mt-4">
          <RrhhEmployeesDataTable
            visibleColumns={settings.visibleColumns}
            links={settings.userLinks}
            users={users}
            tab="bajas"
            refreshKey={tableRefresh}
            canEdit={canEdit}
            onDisableUser={(id) => void disableGrooflowUser(id)}
          />
        </TabsContent>

        <TabsContent value="identidad" className="mt-4">
          <RrhhIdentityDiagnosisPanel
            users={users}
            canEdit={canEdit}
            onDisableUser={(id) => void disableGrooflowUser(id)}
            onLinksChanged={() => setTableRefresh((n) => n + 1)}
            onProjectOrganigrama={canEdit ? () => void runProjectOrganigrama() : undefined}
            projecting={projecting}
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
      </Tabs>

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Columnas visibles</DialogTitle>
            <DialogDescription>
              Campos de Buk.pe y, si sincronizas con asistencia, datos de Ctrlit.
            </DialogDescription>
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
                            checked ? [...prev, col.id] : prev.filter((id) => id !== col.id)
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
