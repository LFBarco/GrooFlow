import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Eye, EyeOff, Loader2, Plug, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings } from '../../types';
import type { BukAsistenciaIntegrationSettings } from '../../types/asistencia';
import {
  DEFAULT_BUK_ASISTENCIA_BASE_URL,
  sanitizeBukBaseUrl,
  syncBukUsuariosToGestion,
  validateBukAsistenciaConnection,
} from '../../utils/bukAsistenciaApi';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { patchAsistenciaSettings } from '../../utils/asistenciaPersistence';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type Props = {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (
    nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings)
  ) => void;
  onPersistSystemSettings?: (
    nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings),
    successMessage?: string
  ) => Promise<boolean>;
  onPersistAsistenciaSettings?: (
    updater: (prev: import('../../types/asistencia').AsistenciaSettings) => import('../../types/asistencia').AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
  readOnly?: boolean;
};

type LiveTestResult = {
  ok: boolean;
  message: string;
  status?: number;
  at: string;
};

export function BukAsistenciaIntegrationSection({
  systemSettings,
  onUpdateSystemSettings,
  onPersistSystemSettings,
  onPersistAsistenciaSettings,
  readOnly = false,
}: Props) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const buk = asistencia.buk ?? {};
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSec, setTestingSec] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [liveTest, setLiveTest] = useState<LiveTestResult | null>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const baseUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!testing) {
      setTestingSec(0);
      return;
    }
    const id = window.setInterval(() => setTestingSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [testing]);

  const patchBuk = (
    partial: Partial<BukAsistenciaIntegrationSettings>,
    options?: { persist?: boolean; message?: string }
  ) => {
    const applyAsistencia = (prev: import('../../types/asistencia').AsistenciaSettings) =>
      patchAsistenciaSettings(prev, {
        buk: { ...mergeAsistenciaSettings(prev).buk, ...partial },
      });

    if (options?.persist && onPersistAsistenciaSettings) {
      void onPersistAsistenciaSettings(applyAsistencia, options.message);
      return;
    }
    if (options?.persist && onPersistSystemSettings) {
      void onPersistSystemSettings(
        (prev) => ({ ...prev, asistencia: applyAsistencia(mergeAsistenciaSettings(prev.asistencia)) }),
        options.message
      );
      return;
    }
    onUpdateSystemSettings((prev) => ({
      ...prev,
      asistencia: applyAsistencia(mergeAsistenciaSettings(prev.asistencia)),
    }));
  };

  const handleTest = async () => {
    const apiToken = (tokenRef.current?.value ?? buk.apiToken ?? '').trim();
    const apiBaseUrl = sanitizeBukBaseUrl(
      (baseUrlRef.current?.value ?? buk.apiBaseUrl ?? DEFAULT_BUK_ASISTENCIA_BASE_URL).trim()
    );

    if (!apiToken) {
      const msg = 'Indica el token de la API antes de probar.';
      setLiveTest({ ok: false, message: msg, at: new Date().toISOString() });
      toast.error(msg);
      return;
    }

    setTesting(true);
    toast.info('Probando conexión con Buk Asistencia…');
    try {
      const result = await validateBukAsistenciaConnection({
        baseUrl: apiBaseUrl || DEFAULT_BUK_ASISTENCIA_BASE_URL,
        apiToken,
      });
      const at = new Date().toISOString();
      setLiveTest({
        ok: result.ok,
        message: result.message,
        status: result.status,
        at,
      });
      patchBuk(
        {
          apiToken,
          apiBaseUrl: apiBaseUrl || DEFAULT_BUK_ASISTENCIA_BASE_URL,
          enabled: result.ok ? true : buk.enabled,
          lastValidatedAt: at,
          lastValidationOk: result.ok,
          lastValidationMessage: result.message,
        },
        { persist: true, message: result.ok ? 'Integración Buk guardada y activada en la nube.' : undefined }
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al probar la conexión.';
      const at = new Date().toISOString();
      setLiveTest({ ok: false, message: msg, at });
      patchBuk({
        lastValidatedAt: at,
        lastValidationOk: false,
        lastValidationMessage: msg,
      });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleStaffSync = async () => {
    if (readOnly || syncing) return;
    setSyncing(true);
    toast.info('Sincronizando usuarios con Buk…');
    try {
      const result = await syncBukUsuariosToGestion({
        baseUrl: sanitizeBukBaseUrl(
          (baseUrlRef.current?.value ?? buk.apiBaseUrl ?? DEFAULT_BUK_ASISTENCIA_BASE_URL).trim()
        ),
        apiToken: (tokenRef.current?.value ?? buk.apiToken ?? '').trim() || '********',
      });
      const at = new Date().toISOString();
      if (!result.ok) {
        const msg = result.error || 'No se pudo sincronizar con Buk.';
        patchBuk(
          {
            lastStaffSyncAt: at,
            lastStaffSyncOk: false,
            lastStaffSyncMessage: msg,
          },
          { persist: true }
        );
        toast.error(msg);
        return;
      }
      const msg =
        result.message ||
        `Actualizados ${result.updated ?? 0} usuario(s); coincidencias ${result.matched ?? 0}.`;
      patchBuk(
        {
          lastStaffSyncAt: at,
          lastStaffSyncOk: true,
          lastStaffSyncMessage: msg,
          staffSyncEnabled: buk.staffSyncEnabled !== false,
        },
        { persist: true, message: 'Sync Buk de usuarios guardado.' }
      );
      toast.success(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar con Buk.';
      patchBuk({
        lastStaffSyncAt: new Date().toISOString(),
        lastStaffSyncOk: false,
        lastStaffSyncMessage: msg,
      });
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const displayTest = liveTest ?? (buk.lastValidatedAt
    ? {
        ok: buk.lastValidationOk === true,
        message: buk.lastValidationMessage || '—',
        status: undefined,
        at: buk.lastValidatedAt,
      }
    : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Buk Asistencia (Ctrlit)
        </CardTitle>
        <CardDescription>
          Conexión a marcaciones de personal. El token se envía vía servidor GrooFlow (evita CORS).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Integración activa</p>
            <p className="text-xs text-muted-foreground">Habilita el panel de asistencia del día.</p>
          </div>
          <Switch
            checked={buk.enabled === true}
            disabled={readOnly}
            onCheckedChange={(v) =>
              patchBuk(
                { enabled: v },
                {
                  persist: true,
                  message: v ? 'Buk Asistencia activado.' : 'Buk Asistencia desactivado.',
                }
              )
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buk-base-url">URL base API</Label>
          <Input
            id="buk-base-url"
            ref={baseUrlRef}
            placeholder={DEFAULT_BUK_ASISTENCIA_BASE_URL}
            defaultValue={sanitizeBukBaseUrl(buk.apiBaseUrl ?? DEFAULT_BUK_ASISTENCIA_BASE_URL)}
            disabled={readOnly}
            onBlur={(e) =>
              patchBuk(
                { apiBaseUrl: sanitizeBukBaseUrl(e.target.value.trim()) },
                { persist: true }
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Solo la base (hasta <code className="text-[11px]">/ctrl/api/v2</code>). En Postman la ruta completa es distinta; no pegues{' '}
            <code className="text-[11px]">/asistencia-empresa</code> aquí.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="buk-token">Token</Label>
          <div className="flex gap-2">
            <Input
              id="buk-token"
              ref={tokenRef}
              type={showToken ? 'text' : 'password'}
              defaultValue={buk.apiToken ?? ''}
              disabled={readOnly}
              onBlur={(e) =>
                patchBuk({ apiToken: e.target.value.trim() }, { persist: true })
              }
              autoComplete="off"
              placeholder="Pega el token de Buk Asistencia"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowToken((s) => !s)}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {!readOnly ? (
          <div className="space-y-2">
            <Button type="button" variant="secondary" onClick={() => void handleTest()} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Probando…{testingSec > 0 ? ` (${testingSec}s)` : ''}
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-1" />
                  Probar conexión
                </>
              )}
            </Button>
          </div>
        ) : null}

        {testing ? (
          <Alert className="border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            <AlertTitle className="text-sm">
              Probando conexión{testingSec > 0 ? ` (${testingSec}s)` : ''}
            </AlertTitle>
            <AlertDescription className="text-sm">
              Consultando Buk vía servidor GrooFlow. Si tarda más de 35 s, revisa red o contacta soporte.
            </AlertDescription>
          </Alert>
        ) : displayTest ? (
          <Alert
            variant={displayTest.ok ? 'default' : 'destructive'}
            className={
              displayTest.ok
                ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                : undefined
            }
          >
            {displayTest.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle className="text-sm">
              {liveTest ? 'Resultado de la prueba' : 'Última prueba'} —{' '}
              {format(new Date(displayTest.at), "d MMM yyyy, HH:mm", { locale: es })}
              {displayTest.status != null ? ` · HTTP ${displayTest.status}` : ''}
            </AlertTitle>
            <AlertDescription className="text-sm">{displayTest.message}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pulsa «Probar conexión» para verificar URL y token. El resultado aparecerá aquí.
          </p>
        )}

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Auto-refresh en módulo Asistencia</p>
              <p className="text-xs text-muted-foreground">
                Actualiza Buk automáticamente dentro de la ventana horaria operativa.
              </p>
            </div>
            <Switch
              checked={buk.autoRefreshEnabled === true}
              disabled={readOnly || buk.enabled !== true}
              onCheckedChange={(v) =>
                patchBuk(
                  { autoRefreshEnabled: v },
                  { persist: true, message: v ? 'Auto-refresh activado.' : 'Auto-refresh desactivado.' }
                )
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="buk-auto-interval">Intervalo (min)</Label>
              <Input
                id="buk-auto-interval"
                type="number"
                min={5}
                max={120}
                defaultValue={buk.autoRefreshIntervalMinutes ?? 30}
                disabled={readOnly}
                onBlur={(e) => {
                  const n = Math.max(5, Math.min(120, Number(e.target.value) || 30));
                  patchBuk({ autoRefreshIntervalMinutes: n }, { persist: true });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="buk-auto-start">Desde</Label>
              <Input
                id="buk-auto-start"
                type="time"
                defaultValue={buk.autoRefreshWindowStart ?? '06:00'}
                disabled={readOnly}
                onBlur={(e) =>
                  patchBuk({ autoRefreshWindowStart: e.target.value || '06:00' }, { persist: true })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="buk-auto-end">Hasta</Label>
              <Input
                id="buk-auto-end"
                type="time"
                defaultValue={buk.autoRefreshWindowEnd ?? '22:00'}
                disabled={readOnly}
                onBlur={(e) =>
                  patchBuk({ autoRefreshWindowEnd: e.target.value || '22:00' }, { persist: true })
                }
              />
            </div>
          </div>
          {buk.lastAutoRefreshAt ? (
            <p className="text-xs text-muted-foreground">
              Último auto-refresh:{' '}
              {format(new Date(buk.lastAutoRefreshAt), "d MMM yyyy, HH:mm", { locale: es })}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sync usuarios (nómina / turnos → Gestión)</p>
              <p className="text-xs text-muted-foreground">
                Actualiza área, puesto, DNI y turno en <code className="text-[11px]">app_usuarios</code> por
                coincidencia de documento. El cron corre cada 15 min y respeta el intervalo configurable
                (por defecto 60 min).
              </p>
            </div>
            <Switch
              checked={buk.staffSyncEnabled !== false}
              disabled={readOnly}
              onCheckedChange={(v) =>
                patchBuk(
                  { staffSyncEnabled: v },
                  {
                    persist: true,
                    message: v ? 'Sync programado de usuarios activado.' : 'Sync programado desactivado.',
                  }
                )
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="buk-staff-sync-interval">Intervalo sync usuarios (min)</Label>
              <Input
                id="buk-staff-sync-interval"
                type="number"
                min={15}
                max={1440}
                defaultValue={buk.staffSyncIntervalMinutes ?? 60}
                disabled={readOnly}
                onBlur={(e) => {
                  const n = Math.max(15, Math.min(1440, Number(e.target.value) || 60));
                  patchBuk({ staffSyncIntervalMinutes: n }, { persist: true });
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                disabled={readOnly || syncing}
                onClick={() => void handleStaffSync()}
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {syncing ? 'Sincronizando…' : 'Sync con Buk ahora'}
              </Button>
            </div>
          </div>
          {buk.lastStaffSyncAt ? (
            <Alert
              variant={buk.lastStaffSyncOk === false ? 'destructive' : 'default'}
              className={
                buk.lastStaffSyncOk === false
                  ? undefined
                  : 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
              }
            >
              {buk.lastStaffSyncOk === false ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <AlertTitle className="text-sm">
                Último sync —{' '}
                {format(new Date(buk.lastStaffSyncAt), "d MMM yyyy, HH:mm", { locale: es })}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {buk.lastStaffSyncMessage || '—'}
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aún no hay sync de usuarios. Usa el botón o espera al cron programado.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
