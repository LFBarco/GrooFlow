import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Eye, EyeOff, Loader2, Plug, RefreshCw, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { BukCatalogEndpointConfig, SystemSettings } from '../../types';
import {
  DEFAULT_BUK_PE_BASE_URL,
  isBukPeTokenRedacted,
  mergeBukPeSettings,
  normalizeBukPeToken,
  sanitizeBukPeBaseUrl,
  syncBukPeUsuariosToGestion,
  validateBukPeConnection,
} from '../../utils/bukPeApi';
import { BukEndpointsExplorer } from './BukEndpointsExplorer';
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
  readOnly?: boolean;
};

export function BukPeIntegrationSection({
  systemSettings,
  onUpdateSystemSettings,
  onPersistSystemSettings,
  readOnly = false,
}: Props) {
  const bukPe = mergeBukPeSettings(systemSettings.bukPe, systemSettings.asistencia?.buk);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSec, setTestingSec] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [liveTest, setLiveTest] = useState<{
    ok: boolean;
    message: string;
    status?: number;
    triedUrl?: string;
    at: string;
  } | null>(null);
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

  const patchBukPe = (
    partial: Partial<typeof bukPe>,
    options?: { persist?: boolean; message?: string }
  ) => {
    const apply = (prev: SystemSettings) => ({
      ...prev,
      bukPe: mergeBukPeSettings({ ...mergeBukPeSettings(prev.bukPe, prev.asistencia?.buk), ...partial }),
    });
    if (options?.persist && onPersistSystemSettings) {
      void onPersistSystemSettings(apply, options.message);
      return;
    }
    onUpdateSystemSettings(apply);
  };

  const handleTest = async () => {
    const apiToken = normalizeBukPeToken(tokenRef.current?.value ?? bukPe.apiToken ?? '');
    const apiBaseUrl = sanitizeBukPeBaseUrl(
      (baseUrlRef.current?.value ?? bukPe.apiBaseUrl ?? DEFAULT_BUK_PE_BASE_URL).trim()
    );
    if (!apiToken || isBukPeTokenRedacted(apiToken)) {
      toast.error('Indica el auth_token de Buk.pe (solo el valor, sin "auth_token:").');
      return;
    }
    setTesting(true);
    try {
      const result = await validateBukPeConnection({ baseUrl: apiBaseUrl, apiToken });
      const at = new Date().toISOString();
      setLiveTest({
        ok: result.ok,
        message: result.message,
        status: result.status,
        triedUrl: result.triedUrl,
        at,
      });
      patchBukPe(
        {
          apiToken,
          apiBaseUrl,
          enabled: result.ok ? true : bukPe.enabled,
          lastValidatedAt: at,
          lastValidationOk: result.ok,
          lastValidationMessage: result.message,
        },
        { persist: true, message: result.ok ? 'Buk.pe guardado y activado.' : undefined }
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al probar Buk.pe.';
      setLiveTest({ ok: false, message: msg, at: new Date().toISOString() });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleStaffSync = async () => {
    if (readOnly || syncing) return;
    setSyncing(true);
    toast.info('Sincronizando usuarios desde Buk.pe…');
    try {
      const result = await syncBukPeUsuariosToGestion({
        baseUrl: sanitizeBukPeBaseUrl(
          (baseUrlRef.current?.value ?? bukPe.apiBaseUrl ?? DEFAULT_BUK_PE_BASE_URL).trim()
        ),
        apiToken: normalizeBukPeToken(tokenRef.current?.value ?? bukPe.apiToken ?? '') || '********',
      });
      const at = new Date().toISOString();
      if (!result.ok) {
        const msg = result.error || 'No se pudo sincronizar usuarios desde Buk.pe.';
        patchBukPe(
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
      patchBukPe(
        {
          lastStaffSyncAt: at,
          lastStaffSyncOk: true,
          lastStaffSyncMessage: msg,
          staffSyncEnabled: bukPe.staffSyncEnabled !== false,
        },
        { persist: true, message: 'Sync Buk.pe → Gestión guardado.' }
      );
      toast.success(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar usuarios desde Buk.pe.';
      patchBukPe({
        lastStaffSyncAt: new Date().toISOString(),
        lastStaffSyncOk: false,
        lastStaffSyncMessage: msg,
      });
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const displayTest =
    liveTest ??
    (bukPe.lastValidatedAt
      ? {
          ok: bukPe.lastValidationOk === true,
          message: bukPe.lastValidationMessage || '—',
          status: undefined,
          at: bukPe.lastValidatedAt,
        }
      : null);

  const endpoints = bukPe.catalogEndpoints ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Buk.pe — RRHH / Nómina
          </CardTitle>
          <CardDescription>
            API de empleados y recursos humanos. Token en header <code className="text-[11px]">auth_token</code>{' '}
            (Configuración → Accesos API en Buk.pe).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Integración activa</p>
              <p className="text-xs text-muted-foreground">Habilita el explorador y módulos RRHH.</p>
            </div>
            <Switch
              checked={bukPe.enabled === true}
              disabled={readOnly}
              onCheckedChange={(v) =>
                patchBukPe({ enabled: v }, { persist: true, message: v ? 'Buk.pe activado.' : 'Buk.pe desactivado.' })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bukpe-base-url">URL base API</Label>
            <Input
              id="bukpe-base-url"
              ref={baseUrlRef}
              placeholder={DEFAULT_BUK_PE_BASE_URL}
              defaultValue={sanitizeBukPeBaseUrl(bukPe.apiBaseUrl ?? DEFAULT_BUK_PE_BASE_URL)}
              disabled={readOnly}
              onBlur={(e) =>
                patchBukPe({ apiBaseUrl: sanitizeBukPeBaseUrl(e.target.value.trim()) }, { persist: true })
              }
            />
            <p className="text-xs text-muted-foreground">
              Para Perú: <code className="text-[11px]">https://TU-TENANT.buk.pe/api/v1/peru</code> — sin{' '}
              <code className="text-[11px]">/employees</code> al final. La consulta usa{' '}
              <code className="text-[11px]">…/peru/employees?page=1&amp;page_size=25</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bukpe-token">auth_token (API Key)</Label>
            <div className="flex gap-2">
              <Input
                id="bukpe-token"
                ref={tokenRef}
                type={showToken ? 'text' : 'password'}
                defaultValue={bukPe.apiToken ?? ''}
                disabled={readOnly}
                onBlur={(e) =>
                  patchBukPe({ apiToken: normalizeBukPeToken(e.target.value) }, { persist: true })
                }
                autoComplete="off"
                placeholder="Ej. FcEqyPq1FENrmxTzxZfhUNjd (desde Accesos API en Buk.pe)"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowToken((s) => !s)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {!readOnly ? (
            <Button type="button" variant="secondary" onClick={() => void handleTest()} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Probando…{testingSec > 0 ? ` (${testingSec}s)` : ''}
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-1" />
                  Probar conexión (employees)
                </>
              )}
            </Button>
          ) : null}

          {displayTest ? (
            <Alert
              variant={displayTest.ok ? 'default' : 'destructive'}
              className={
                displayTest.ok ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : undefined
              }
            >
              {displayTest.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle className="text-sm">
                {format(new Date(displayTest.at), "d MMM yyyy, HH:mm", { locale: es })}
                {displayTest.status != null ? ` · HTTP ${displayTest.status}` : ''}
              </AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>{displayTest.message}</p>
                {liveTest && typeof liveTest === 'object' && 'triedUrl' in liveTest && liveTest.triedUrl ? (
                  <p className="text-xs text-muted-foreground break-all">URL: {String(liveTest.triedUrl)}</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Sync usuarios (Buk.pe → Gestión)</p>
                <p className="text-xs text-muted-foreground">
                  Actualiza DNI, puesto/cargo y contrato en <code className="text-[11px]">app_usuarios</code> desde
                  el maestro de colaboradores (match por documento o email). El turno operativo se rellena si ya
                  está enriquecido desde Asistencia. El cron corre cada 15 min y respeta el intervalo (por defecto
                  60 min).
                </p>
              </div>
              <Switch
                checked={bukPe.staffSyncEnabled !== false}
                disabled={readOnly}
                onCheckedChange={(v) =>
                  patchBukPe(
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
                <Label htmlFor="bukpe-staff-sync-interval">Intervalo sync usuarios (min)</Label>
                <Input
                  id="bukpe-staff-sync-interval"
                  type="number"
                  min={15}
                  max={1440}
                  defaultValue={bukPe.staffSyncIntervalMinutes ?? 60}
                  disabled={readOnly}
                  onBlur={(e) => {
                    const n = Math.max(15, Math.min(1440, Number(e.target.value) || 60));
                    patchBukPe({ staffSyncIntervalMinutes: n }, { persist: true });
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
                  {syncing ? 'Sincronizando…' : 'Sync con Buk.pe ahora'}
                </Button>
              </div>
            </div>
            {bukPe.lastStaffSyncAt ? (
              <Alert
                variant={bukPe.lastStaffSyncOk === false ? 'destructive' : 'default'}
                className={
                  bukPe.lastStaffSyncOk === false
                    ? undefined
                    : 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                }
              >
                {bukPe.lastStaffSyncOk === false ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                <AlertTitle className="text-sm">
                  Último sync —{' '}
                  {format(new Date(bukPe.lastStaffSyncAt), "d MMM yyyy, HH:mm", { locale: es })}
                </AlertTitle>
                <AlertDescription className="text-sm">
                  {bukPe.lastStaffSyncMessage || '—'}
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

      <BukEndpointsExplorer
        provider="bukpe"
        baseUrl={bukPe.apiBaseUrl ?? DEFAULT_BUK_PE_BASE_URL}
        apiToken={bukPe.apiToken ?? ''}
        getApiToken={() => normalizeBukPeToken(tokenRef.current?.value ?? bukPe.apiToken ?? '')}
        endpoints={endpoints}
        readOnly={readOnly}
        onChangeEndpoints={(next: BukCatalogEndpointConfig[], message) =>
          patchBukPe({ catalogEndpoints: next }, { persist: true, message })
        }
      />
    </div>
  );
}
