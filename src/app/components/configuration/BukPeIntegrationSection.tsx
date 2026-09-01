import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Eye, EyeOff, Loader2, Plug, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { BukCatalogEndpointConfig, SystemSettings } from '../../types';
import {
  DEFAULT_BUK_PE_BASE_URL,
  mergeBukPeSettings,
  sanitizeBukPeBaseUrl,
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
  const bukPe = mergeBukPeSettings(systemSettings.bukPe);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSec, setTestingSec] = useState(0);
  const [liveTest, setLiveTest] = useState<{
    ok: boolean;
    message: string;
    status?: number;
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
      bukPe: mergeBukPeSettings({ ...mergeBukPeSettings(prev.bukPe), ...partial }),
    });
    if (options?.persist && onPersistSystemSettings) {
      void onPersistSystemSettings(apply, options.message);
      return;
    }
    onUpdateSystemSettings(apply);
  };

  const handleTest = async () => {
    const apiToken = (tokenRef.current?.value ?? bukPe.apiToken ?? '').trim();
    const apiBaseUrl = sanitizeBukPeBaseUrl(
      (baseUrlRef.current?.value ?? bukPe.apiBaseUrl ?? DEFAULT_BUK_PE_BASE_URL).trim()
    );
    if (!apiToken) {
      toast.error('Indica el auth_token de Buk.pe.');
      return;
    }
    setTesting(true);
    try {
      const result = await validateBukPeConnection({ baseUrl: apiBaseUrl, apiToken });
      const at = new Date().toISOString();
      setLiveTest({ ok: result.ok, message: result.message, status: result.status, at });
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
              <p className="text-xs text-muted-foreground">Habilita el explorador y futuros módulos RRHH.</p>
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
              <code className="text-[11px]">/employees</code> al final.
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
                onBlur={(e) => patchBukPe({ apiToken: e.target.value.trim() }, { persist: true })}
                autoComplete="off"
                placeholder="Token de Configuración → Accesos API"
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
              <AlertDescription className="text-sm">{displayTest.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <BukEndpointsExplorer
        provider="bukpe"
        baseUrl={bukPe.apiBaseUrl ?? DEFAULT_BUK_PE_BASE_URL}
        apiToken={bukPe.apiToken ?? ''}
        endpoints={endpoints}
        readOnly={readOnly}
        onChangeEndpoints={(next: BukCatalogEndpointConfig[], message) =>
          patchBukPe({ catalogEndpoints: next }, { persist: true, message })
        }
      />
    </div>
  );
}
