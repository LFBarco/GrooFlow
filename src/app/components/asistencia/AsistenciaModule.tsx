import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings } from '../../types';
import type { AsistenciaAreaGroup, AsistenciaSettings } from '../../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS } from '../../types/asistencia';
import {
  buildAsistenciaDaySummary,
  mergeAsistenciaSettings,
} from '../../utils/asistenciaData';
import { fetchBukAsistenciaAll } from '../../utils/bukAsistenciaApi';
import { AsistenciaOrgConfigDialog } from './AsistenciaOrgConfigDialog';
import { AreaGroupLabel, CoverageBar, CoverageStatusBadge } from './asistenciaUiHelpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

export interface AsistenciaModuleProps {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (settings: SystemSettings) => void;
  visibleSedes?: string[];
  canConfigure?: boolean;
}

const AREA_TABS: AsistenciaAreaGroup[] = ['medica', 'peluqueria', 'global'];

export function AsistenciaModule({
  systemSettings,
  onUpdateSystemSettings,
  visibleSedes = [],
  canConfigure = false,
}: AsistenciaModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchBukAsistenciaAll>>>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [areaTab, setAreaTab] = useState<AsistenciaAreaGroup | 'all'>('all');

  const dateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);

  const summary = useMemo(() => {
    if (records.length === 0) return null;
    return buildAsistenciaDaySummary({
      date: dateObj,
      records,
      settings: asistencia,
      visibleSedes: visibleSedes.length > 0 ? visibleSedes : undefined,
    });
  }, [records, dateObj, asistencia, visibleSedes]);

  const refresh = useCallback(async () => {
    const buk = asistencia.buk;
    if (!buk?.enabled || !buk.apiToken?.trim()) {
      toast.error('Configura Buk Asistencia en Configuración → Integraciones.');
      return;
    }
    if (asistencia.requirements.length === 0) {
      toast.error('Define la estructura organizacional antes de consultar.');
      setConfigOpen(true);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchBukAsistenciaAll({
        baseUrl: buk.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2',
        apiToken: buk.apiToken,
      });
      setRecords(data);
      toast.success(`${data.length} registros de asistencia cargados.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar asistencia.');
    } finally {
      setLoading(false);
    }
  }, [asistencia]);

  const saveSettings = (next: AsistenciaSettings) => {
    onUpdateSystemSettings({ ...systemSettings, asistencia: next });
  };

  const sedeOptions = useMemo(() => {
    const fromReqs = asistencia.requirements.map((r) => r.sedeName);
    const fromMap = (asistencia.sedeMappings ?? []).map((m) => m.sedeName);
    return [...new Set([...visibleSedes, ...fromReqs, ...fromMap])].filter(Boolean);
  }, [visibleSedes, asistencia]);

  const filteredSedes = summary?.sedes ?? [];

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
            Compara quién marcó entrada en Buk Asistencia contra la estructura organizacional por sede, área y cargo.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
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
            Actualizar
          </Button>
          {canConfigure ? (
            <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Estructura
            </Button>
          ) : null}
        </div>
      </div>

      {!asistencia.buk?.enabled ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium">Integración Buk no activa</p>
              <p className="text-sm text-muted-foreground">
                Un administrador debe configurar URL y token en Configuración → Integraciones → Buk Asistencia.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Personal presente (únicos)</CardDescription>
                <CardTitle className="text-3xl">{summary.totalPresentUnique}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
              </CardContent>
            </Card>
            {AREA_TABS.map((area) => (
              <Card key={area}>
                <CardHeader className="pb-2">
                  <CardDescription>{ASISTENCIA_AREA_GROUP_LABELS[area]}</CardDescription>
                  <CardTitle className="text-2xl">
                    {summary.globalByArea[area].present}
                    <span className="text-base font-normal text-muted-foreground">
                      {' '}/ {summary.globalByArea[area].required} req.
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {summary.globalByArea[area].completeSlots}/{summary.globalByArea[area].slots} cargos completos
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={areaTab} onValueChange={(v) => setAreaTab(v as typeof areaTab)}>
            <TabsList>
              <TabsTrigger value="all">Todas las áreas</TabsTrigger>
              {AREA_TABS.map((a) => (
                <TabsTrigger key={a} value={a}>{ASISTENCIA_AREA_GROUP_LABELS[a]}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={areaTab} className="space-y-4 mt-4">
              {filteredSedes.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No hay sedes con estructura configurada para tu alcance.
                  </CardContent>
                </Card>
              ) : (
                filteredSedes.map((sede) => {
                  const rows =
                    areaTab === 'all'
                      ? [...sede.byArea.medica, ...sede.byArea.peluqueria, ...sede.byArea.global]
                      : sede.byArea[areaTab];

                  return (
                    <Card key={sede.sedeName}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-lg">{sede.sedeName}</CardTitle>
                            {sede.bukRecintoCode ? (
                              <span className="text-xs text-muted-foreground">· Buk: {sede.bukRecintoCode}</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {sede.isComplete ? (
                              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" /> Dotación completa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                                <AlertTriangle className="h-4 w-4" /> {sede.completeSlots}/{sede.totalSlots} cargos OK
                              </span>
                            )}
                          </div>
                        </div>
                        <CardDescription>
                          {sede.totalPresent} presentes · {sede.totalRequired} requeridos en estructura
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Área</TableHead>
                              <TableHead>Cargo</TableHead>
                              <TableHead>Cobertura</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Presentes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                  Sin cargos en esta vista.
                                </TableCell>
                              </TableRow>
                            ) : (
                              rows.map((row) => (
                                <TableRow key={row.requirement.id}>
                                  <TableCell><AreaGroupLabel group={row.requirement.areaGroup} /></TableCell>
                                  <TableCell className="font-medium">{row.requirement.cargoLabel}</TableCell>
                                  <TableCell>
                                    <CoverageBar present={row.presentCount} required={row.requiredCount} />
                                  </TableCell>
                                  <TableCell><CoverageStatusBadge status={row.status} /></TableCell>
                                  <TableCell>
                                    {row.present.length === 0 ? (
                                      <span className="text-muted-foreground text-sm">—</span>
                                    ) : (
                                      <ul className="text-sm space-y-0.5">
                                        {row.present.map((p) => (
                                          <li key={p.rut}>
                                            <span className="font-medium">{p.fullName}</span>
                                            <span className="text-muted-foreground text-xs ml-1">
                                              {p.entradaFormat ? `· ${p.entradaFormat}` : ''}
                                              {p.stillOnSite ? ' · en sede' : ''}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Pulsa «Actualizar» para cargar la asistencia del día desde Buk.
            </p>
            {canConfigure && asistencia.requirements.length === 0 ? (
              <Button variant="outline" onClick={() => setConfigOpen(true)}>
                Configurar estructura organizacional
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      <AsistenciaOrgConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        settings={asistencia}
        sedeOptions={sedeOptions.length > 0 ? sedeOptions : ['Principal']}
        onSave={saveSettings}
      />
    </div>
  );
}
