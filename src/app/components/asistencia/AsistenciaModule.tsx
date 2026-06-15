import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings } from '../../types';
import type { AsistenciaSettings } from '../../types/asistencia';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { fetchBukAsistenciaAll } from '../../utils/bukAsistenciaApi';
import { buildLiveSedeSummary, formatSedeDateLabel, staffForSede } from '../../utils/asistenciaStaff';
import { AsistenciaLiveOrgChart } from './AsistenciaLiveOrgChart';
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
  onPersistSystemSettings,
  visibleSedes = [],
  canConfigure = false,
}: AsistenciaModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchBukAsistenciaAll>>>([]);
  const [mainTab, setMainTab] = useState<'live' | 'config'>('live');

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

  const refresh = useCallback(async () => {
    const bukCfg = asistencia.buk;
    if (!bukCfg?.enabled || !bukCfg.apiToken?.trim()) {
      toast.error('Activa Buk Asistencia y configura el token en Configuración → Integraciones.');
      return;
    }
    if (staffForSede(asistencia, activeSede).length === 0) {
      toast.error('Registra personal en la sede antes de actualizar el panel en vivo.');
      setMainTab('config');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchBukAsistenciaAll({
        baseUrl: bukCfg.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2',
        apiToken: bukCfg.apiToken,
      });
      setRecords(data);
      const onDate = data.filter((r) => {
        const key = formatSedeDateLabel(dateObj);
        return r.dia_entrada === key || (r.entrada && formatSedeDateLabel(new Date(r.entrada)) === key);
      });
      toast.success(
        `${data.length} registros Buk · ${onDate.length} en ${format(dateObj, 'dd/MM/yyyy')} para cruzar con ${activeSede}.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar asistencia.');
    } finally {
      setLoading(false);
    }
  }, [asistencia, activeSede, dateObj]);

  const saveAsistencia = useCallback(
    async (
      updater: (prev: AsistenciaSettings) => AsistenciaSettings,
      successMessage?: string
    ): Promise<boolean> => {
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
    [onPersistSystemSettings, onUpdateSystemSettings, systemSettings]
  );

  return (
    <div className="space-y-6">
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
            <Select value={activeSede} onValueChange={setSelectedSede}>
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
            Actualizar Buk
          </Button>
        </div>
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

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'live' | 'config')}>
        <TabsList className="bg-slate-900/80 border border-slate-800">
          <TabsTrigger value="live" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-1" /> Operativa en vivo
          </TabsTrigger>
          {canConfigure ? (
            <TabsTrigger value="config" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
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
          <AsistenciaLiveOrgChart
            summary={liveSummary}
            onRefresh={() => void refresh()}
            loading={loading}
          />
          {records.length > 0 && liveSummary.absentCount > 0 ? (
            <Card className="border-amber-500/30 bg-amber-950/10">
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm font-medium text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Diagnóstico de cruce Buk — {activeSede}
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {liveSummary.areas.flatMap((a) => a.staff)
                    .filter((s) => s.status === 'ausente' && s.matchHint)
                    .map((s) => (
                      <li key={s.staff.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                        <span className="font-medium text-white">{s.staff.fullName}</span>
                        <span className="text-slate-500"> · {s.staff.cargoLabel}</span>
                        <p className="mt-1 text-xs text-amber-100/90 leading-relaxed">{s.matchHint}</p>
                      </li>
                    ))}
                </ul>
                {liveSummary.bukRecintosOnDate.length > 0 ? (
                  <p className="text-xs text-slate-500">
                    Códigos recinto Buk ese día: <strong className="text-slate-300">{liveSummary.bukRecintosOnDate.join(', ')}</strong>
                    {' '}— úsalos en Configuración sede → Editar Sede si no coinciden con La Molina.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
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
              canConfigure={canConfigure}
              onSave={saveAsistencia}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
