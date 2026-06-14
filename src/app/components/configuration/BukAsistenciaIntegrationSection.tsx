import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Eye, EyeOff, Loader2, Plug, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings } from '../../types';
import type { BukAsistenciaIntegrationSettings } from '../../types/asistencia';
import { DEFAULT_BUK_ASISTENCIA_BASE_URL, validateBukAsistenciaConnection } from '../../utils/bukAsistenciaApi';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type Props = {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (settings: SystemSettings) => void;
  readOnly?: boolean;
};

export function BukAsistenciaIntegrationSection({
  systemSettings,
  onUpdateSystemSettings,
  readOnly = false,
}: Props) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const buk = asistencia.buk ?? {};
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSec, setTestingSec] = useState(0);

  useEffect(() => {
    if (!testing) {
      setTestingSec(0);
      return;
    }
    const id = window.setInterval(() => setTestingSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [testing]);

  const patchBuk = (partial: Partial<BukAsistenciaIntegrationSettings>) => {
    onUpdateSystemSettings({
      ...systemSettings,
      asistencia: mergeAsistenciaSettings({
        ...asistencia,
        buk: { ...buk, ...partial },
      }),
    });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await validateBukAsistenciaConnection({
        baseUrl: buk.apiBaseUrl || DEFAULT_BUK_ASISTENCIA_BASE_URL,
        apiToken: buk.apiToken || '',
      });
      patchBuk({
        lastValidatedAt: new Date().toISOString(),
        lastValidationOk: result.ok,
        lastValidationMessage: result.message,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Buk Asistencia (Ctrlit)
        </CardTitle>
        <CardDescription>
          Conexión a marcaciones de personal. El token se usa vía servidor GrooFlow (evita CORS).
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
            onCheckedChange={(v) => patchBuk({ enabled: v })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buk-base-url">URL base API</Label>
          <Input
            id="buk-base-url"
            placeholder={DEFAULT_BUK_ASISTENCIA_BASE_URL}
            value={buk.apiBaseUrl ?? ''}
            disabled={readOnly}
            onChange={(e) => patchBuk({ apiBaseUrl: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buk-token">Token</Label>
          <div className="flex gap-2">
            <Input
              id="buk-token"
              type={showToken ? 'text' : 'password'}
              value={buk.apiToken ?? ''}
              disabled={readOnly}
              onChange={(e) => patchBuk({ apiToken: e.target.value })}
              autoComplete="off"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowToken((s) => !s)}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {!readOnly ? (
          <Button type="button" variant="secondary" onClick={() => void handleTest()} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plug className="h-4 w-4 mr-1" />}
            Probar conexión {testingSec > 0 ? `(${testingSec}s)` : ''}
          </Button>
        ) : null}

        {buk.lastValidatedAt ? (
          <Alert variant={buk.lastValidationOk ? 'default' : 'destructive'}>
            {buk.lastValidationOk ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              Última prueba —{' '}
              {format(new Date(buk.lastValidatedAt), "d MMM yyyy HH:mm", { locale: es })}
            </AlertTitle>
            <AlertDescription>{buk.lastValidationMessage || '—'}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
