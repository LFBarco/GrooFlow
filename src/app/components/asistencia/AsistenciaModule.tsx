import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings } from '../../types';
import type { AsistenciaSettings } from '../../types/asistencia';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { fetchBukAsistenciaAll, sanitizeBukBaseUrl } from '../../utils/bukAsistenciaApi';
import {
  cacheAgeLabel,
  loadBukAsistenciaCache,
  mergeBukAsistenciaRecords,
  saveBukAsistenciaCache,
} from '../../utils/bukAsistenciaCache';
import { buildLiveConsolidatedSummary, buildLiveSedeSummary, formatSedeDateLabel, staffForSede } from '../../utils/asistenciaStaff';
import { AsistenciaBukDashboard } from './AsistenciaBukDashboard';
import { AsistenciaLiveView } from './AsistenciaLiveView';
import { AsistenciaSedeConfigPanel } from './AsistenciaSedeConfigPanel';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent } from '../ui/card';

export interface AsistenciaModuleProps {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (settings: SystemSettings) => void;
  onPersistAsistenciaSettings?: (
    updater: (prev: AsistenciaSettings) => AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
  onPersistSystemSettings?: (
    nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings),
    successMessage?: string
  ) => Promise<boolean>;
  visibleSedes?: string[];
  canConfigure?: boolean;
}

export function AsistenciaModule({
  systemSettings,
  onUpdateSystemSettings,
  onPersistAsistenciaSettings,
  onPersistSystemSettings,
  visibleSedes = [],
  canConfigure = false,
}: AsistenciaModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchBukAsistenciaAll>>>([]);
  const [cacheFetchedAt, setCacheFetchedAt] = useState<number | null>(null);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'live' | 'dashboard' | 'config'>('live');
  const [liveViewMode, setLiveViewMode] = useState<'single' | 'consolidated'>('single');
  const [editLayout, setEditLayout] = useState(false);

  const bukBaseUrl = sanitizeBukBaseUrl(asistencia.buk?.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2');
  const bukToken = asistencia.buk?.apiToken?.trim() ?? '';

  useEffect(() => {
    if (!asistencia.buk?.enabled || !bukToken) return;
    const cached = loadBukAsistenciaCache({ baseUrl: bukBaseUrl, apiToken: bukToken });
    if (cached?.records.length) {
      setRecords(cached.records);
      setCacheFetchedAt(cached.fetchedAt);
    }
  }, [asistencia.buk?.enabled, bukBaseUrl, bukToken]);

  const sedeOptions = useMemo(() => {
    const fromStaff = (asistencia.staff ?? []).map((s) => s.sedeName);
    const fromProfiles = (asistencia.sedeProfiles ?? []).map((p) => p.sedeName);
    const fromReqs = asistencia.requirements.map((r) => r.sedeName);
    const fromMap = (asistencia.sedeMappings ?? []).map((m) => m.sedeName);
    const all = [...new Set([...visibleSedes, ...fromStaff, ...fromProfiles, ...fromReqs, ...fromMap])].filter(Boolean);
    return all.length > 0 ? all : ['Principal'];
  }, [visibleSedes, asistencia]);

  const [selectedSede, setSelectedSede] = useState(() => sedeOptions[0] ?? 'Principal');

  const activeSede = sedeOptions.includes(selectedSede) ? selectedSede : sedeOptions[0];

  const dateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);

  const liveSummary = useMemo(
    () =>
      buildLiveSedeSummary({
        sedeName: activeSede,
        settings: asistencia,
        records,
        date: dateObj,
      }),
    [activeSede, asistencia, records, dateObj]
  );

  const consolidatedSummary = useMemo(
    () =>
      buildLiveConsolidatedSummary({
        sedeNames: sedeOptions,
        settings: asistencia,
        records,
        date: dateObj,
      }),
    [sedeOptions, asistencia, records, dateObj]
  );

  const hasAnyStaff = useMemo(
    () => sedeOptions.some((s) => staffForSede(asistencia, s).length > 0),
    [sedeOptions, asistencia]
  );

  const refresh = useCallback(async () => {
    const bukCfg = asistencia.buk;
    const resolvedBase = sanitizeBukBaseUrl(bukCfg?.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2');
    if (!bukCfg?.enabled || !bukCfg.apiToken?.trim()) {
      toast.error('Activa Buk Asistencia y configura el token en Configuración → Integraciones.');
      return;
    }
    if (
      mainTab === 'live' &&
      !hasAnyStaff
    ) {
      toast.error('Registra personal en al menos una sede para el organigrama en vivo.');
      setMainTab('config');
      return;
    }
    if (
      mainTab === 'live' &&
      liveViewMode === 'single' &&
      staffForSede(asistencia, activeSede).length === 0
    ) {
      toast.error('Registra personal en la sede seleccionada o usa vista consolidada.');
      setMainTab('config');
      return;
    }
    setLoading(true);
    setFetchProgress(null);
    const cached = loadBukAsistenciaCache({
      baseUrl: resolvedBase,
      apiToken: bukCfg.apiToken,
    });
    const priorCount = cached?.records.length ?? 0;
    if (cached?.records.length) {
      setRecords(cached.records);
      setCacheFetchedAt(cached.fetchedAt);
    }
    try {
      const fresh = await fetchBukAsistenciaAll({
        baseUrl: resolvedBase,
        apiToken: bukCfg.apiToken,
        onProgress: (loaded, total) => {
          setFetchProgress(
            loaded === 0
              ? 'Conectando con Buk vía servidor…'
              : `Buk ${loaded}/${total} páginas…`
          );
        },
      });
      const merged = mergeBukAsistenciaRecords(cached?.records ?? [], fresh);
      const now = Date.now();
      saveBukAsistenciaCache({
        baseUrl: resolvedBase,
        apiToken: bukCfg.apiToken,
        records: merged,
        fetchedAt: now,
      });
      setRecords(merged);
      setCacheFetchedAt(now);
      const onDate = merged.filter((r) => {
        const key = formatSedeDateLabel(dateObj);
        return r.dia_entrada === key || (r.entrada && formatSedeDateLabel(new Date(r.entrada)) === key);
      });
      const delta = Math.max(0, merged.length - priorCount);
      toast.success(
        `${merged.length} registros (${delta > 0 ? `+${delta} nuevos · ` : ''}${onDate.length} hoy para ${activeSede}). Caché 48 h.`
      );
    } catch (err) {
      if (cached?.records.length) {
        toast.error(
          err instanceof Error
            ? `${err.message} — mostrando caché ${cacheAgeLabel(cached.fetchedAt)}.`
            : 'Error Buk — mostrando caché local.'
        );
      } else {
        toast.error(err instanceof Error ? err.message : 'No se pudo cargar asistencia.');
      }
    } finally {
      setLoading(false);
      setFetchProgress(null);
    }
  }, [asistencia, activeSede, dateObj, bukBaseUrl, bukToken, mainTab, liveViewMode, hasAnyStaff]);

  const saveAsistencia = useCallback(
    async (
      updater: (prev: AsistenciaSettings) => AsistenciaSettings,
      successMessage?: string
    ): Promise<boolean> => {
      if (onPersistAsistenciaSettings) {
        const ok = await onPersistAsistenciaSettings(updater, successMessage);
        if (!ok) {
          toast.error('No se pudo guardar en la nube. Revisa tu sesión e intenta de nuevo.');
        }
        return ok;
      }
      if (onPersistSystemSettings) {
        const ok = await onPersistSystemSettings(
          (prev) => ({
            ...prev,
            asistencia: updater(mergeAsistenciaSettings(prev.asistencia)),
          }),
          successMessage
        );
        if (!ok) {
          toast.error('No se pudo guardar en la nube. Revisa tu sesión e intenta de nuevo.');
        }
        return ok;
      }
      const next = updater(mergeAsistenciaSettings(systemSettings.asistencia));
      onUpdateSystemSettings({ ...systemSettings, asistencia: next });
      if (successMessage) toast.success(successMessage);
      return true;
    },
    [onPersistAsistenciaSettings, onPersistSystemSettings, onUpdateSystemSettings, systemSettings]
  );

  return (
    <div className="space-y-6" data-testid="asistencia-module">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300">
            <Users className="h-5 w-5" />
            <span className="text-sm font-medium">Asistencia del día</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Panel de dotación operativa</h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Gestiona el personal por sede y visualiza el organigrama en vivo cruzado con Buk Asistencia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Sede</label>
            <Select
              value={activeSede}
              onValueChange={setSelectedSede}
              disabled={liveViewMode === 'consolidated' && mainTab === 'live'}
            >
              <SelectTrigger className="w-[180px] bg-slate-900/60 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sedeOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Fecha</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[160px] bg-slate-900/60 border-slate-700 text-white"
            />
          </div>
          <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {loading && fetchProgress ? fetchProgress : 'Actualizar Buk'}
          </Button>
          {mainTab === 'live' ? (
            <Button
              type="button"
              variant={liveViewMode === 'consolidated' ? 'default' : 'outline'}
              className={
                liveViewMode === 'consolidated'
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-0'
                  : 'border-slate-600 text-slate-200 bg-slate-900/60'
              }
              onClick={() =>
                setLiveViewMode((m) => (m === 'consolidated' ? 'single' : 'consolidated'))
              }
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              {liveViewMode === 'consolidated' ? 'Consolidado' : 'Por sede'}
            </Button>
          ) : null}
        </div>
        {cacheFetchedAt && records.length > 0 ? (
          <p className="w-full text-xs text-slate-500">
            Caché local: {records.length} registros · actualizado {cacheAgeLabel(cacheFetchedAt)} · válido 48 h
          </p>
        ) : null}
      </div>

      {!asistencia.buk?.enabled ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium">Integración Buk no activa</p>
              <p className="text-sm text-muted-foreground">
                Un administrador debe activar Buk en Configuración → Integraciones y probar la conexión.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'live' | 'dashboard' | 'config')}>
        <TabsList className="bg-slate-900/80 border border-slate-800">
          <TabsTrigger value="live" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-1" /> Operativa en vivo
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard Buk
          </TabsTrigger>
          {canConfigure ? (
            <TabsTrigger value="config" data-testid="asistencia-tab-config" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Settings2 className="h-4 w-4 mr-1" /> Configuración sede
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="live" className="mt-4 space-y-4">
          {records.length === 0 && !loading ? (
            <Card className="border-slate-800 bg-slate-950/50">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Pulsa «Actualizar Buk» para cargar marcaciones de{' '}
                {format(dateObj, "d 'de' MMMM", { locale: es })}. El organigrama mostrará ausentes en rojo.
              </CardContent>
            </Card>
          ) : null}
          <AsistenciaLiveView
            mode={liveViewMode}
            summary={liveViewMode === 'single' ? liveSummary : undefined}
            consolidated={liveViewMode === 'consolidated' ? consolidatedSummary : undefined}
            editLayout={editLayout}
            canEditLayout={canConfigure}
            onEditLayoutChange={setEditLayout}
            onPersistLayout={saveAsistencia}
            onRefresh={() => void refresh()}
            loading={loading}
          />
          {records.length > 0 &&
          (liveViewMode === 'consolidated'
            ? consolidatedSummary.absentCount > 0
            : liveSummary.absentCount > 0) ? (
            <Card className="border-amber-500/30 bg-amber-950/10">
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm font-medium text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Diagnóstico de cruce Buk —{' '}
                  {liveViewMode === 'consolidated' ? 'todas las sedes' : activeSede}
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {(liveViewMode === 'consolidated'
                    ? consolidatedSummary.sedes.flatMap((s) => s.areas.flatMap((a) => a.staff))
                    : liveSummary.areas.flatMap((a) => a.staff)
                  )
                    .filter((s) => s.status === 'ausente' && s.matchHint)
                    .map((s) => (
                      <li key={s.staff.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                        <span className="font-medium text-white">{s.staff.fullName}</span>
                        <span className="text-slate-500">
                          {' '}
                          · {s.staff.cargoLabel} · {s.staff.sedeName}
                        </span>
                        <p className="mt-1 text-xs text-amber-100/90 leading-relaxed">{s.matchHint}</p>
                      </li>
                    ))}
                </ul>
                {(liveViewMode === 'consolidated'
                  ? consolidatedSummary.sedes.some((s) => s.bukRecintosOnDate.length > 0)
                  : liveSummary.bukRecintosOnDate.length > 0) ? (
                  <p className="text-xs text-slate-500">
                    Revisa códigos recinto Buk en Configuración sede si el cruce falla.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <AsistenciaBukDashboard
            records={records}
            settings={asistencia}
            sedeName={activeSede}
            date={dateObj}
          />
        </TabsContent>

        {canConfigure ? (
          <TabsContent value="config" className="mt-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Configurando: <strong className="text-foreground">{activeSede}</strong>
            </div>
            <AsistenciaSedeConfigPanel
              sedeName={activeSede}
              settings={asistencia}
              sedeOptions={sedeOptions}
              canConfigure={canConfigure}
              onSave={saveAsistencia}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
