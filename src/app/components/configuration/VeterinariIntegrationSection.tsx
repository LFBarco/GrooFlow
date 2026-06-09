import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Plug,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings, VeterinariIntegrationSettings } from '../../types';
import {
  DEFAULT_VETERINARI_BASE_URL,
  mergeVeterinariSettings,
  VETERINARI_TEST_ENDPOINTS,
} from '../../data/initialData';
import { validateVeterinariConnection } from '../../utils/veterinariApi';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type VeterinariIntegrationSectionProps = {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (settings: SystemSettings) => void;
  readOnly?: boolean;
};

export function VeterinariIntegrationSection({
  systemSettings,
  onUpdateSystemSettings,
  readOnly = false,
}: VeterinariIntegrationSectionProps) {
  const vet = mergeVeterinariSettings(systemSettings.veterinari);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);

  const patchVet = (partial: Partial<VeterinariIntegrationSettings>) => {
    onUpdateSystemSettings({
      ...systemSettings,
      veterinari: mergeVeterinariSettings({ ...vet, ...partial }),
    });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await validateVeterinariConnection({
        baseUrl: vet.baseUrl || DEFAULT_VETERINARI_BASE_URL,
        apiToken: vet.apiToken || '',
        testEndpoint: vet.testEndpoint || 'GetClientes',
      });
      const at = new Date().toISOString();
      patchVet({
        lastValidatedAt: at,
        lastValidationOk: result.ok,
        lastValidationMessage: result.message,
        lastValidationAuthMethod: result.authMethod,
        lastValidationHttpStatus: result.status,
      });
      if (result.ok) {
        toast.success('Conexión con Veterinari verificada.');
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al probar la conexión.';
      patchVet({
        lastValidatedAt: new Date().toISOString(),
        lastValidationOk: false,
        lastValidationMessage: msg,
      });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const previewUrl = `${(vet.baseUrl || DEFAULT_VETERINARI_BASE_URL).replace(/\/$/, '')}/${vet.testEndpoint || 'GetClientes'}?page=1`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-emerald-500" />
          Integración Veterinari
        </CardTitle>
        <CardDescription>
          URL base y token para consultar la API (clientes, ventas, citas, etc.). Los reportes
          futuros usarán estos datos. El token se guarda en la configuración del sistema (solo
          administradores).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Integración activa</Label>
            <p className="text-xs text-muted-foreground">
              Cuando esté lista la sincronización, solo consultará si está activa.
            </p>
          </div>
          <Switch
            checked={vet.enabled ?? false}
            disabled={readOnly}
            onCheckedChange={(v) => patchVet({ enabled: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>URL base de la API</Label>
          <Input
            placeholder={DEFAULT_VETERINARI_BASE_URL}
            value={vet.baseUrl ?? ''}
            disabled={readOnly}
            onChange={(e) => patchVet({ baseUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Sin barra final. Ejemplo: …/api/oapi
          </p>
        </div>

        <div className="space-y-2">
          <Label>Token / API key</Label>
          <div className="flex gap-2">
            <Input
              type={showToken ? 'text' : 'password'}
              className="font-mono text-sm"
              placeholder="Pega el token proporcionado por Veterinari"
              value={vet.apiToken ?? ''}
              disabled={readOnly}
              onChange={(e) => patchVet({ apiToken: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowToken((s) => !s)}
              title={showToken ? 'Ocultar' : 'Mostrar'}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            No compartas el token por chat o correo. Si se filtró, solicita uno nuevo a Veterinari.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Endpoint de prueba</Label>
          <Select
            value={vet.testEndpoint || 'GetClientes'}
            disabled={readOnly}
            onValueChange={(v) => patchVet({ testEndpoint: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VETERINARI_TEST_ENDPOINTS.map((ep) => (
                <SelectItem key={ep} value={ep}>{ep}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground font-mono break-all">{previewUrl}</p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleTest()} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Probando…
                </>
              ) : (
                'Probar conexión'
              )}
            </Button>
          </div>
        )}

        {vet.lastValidatedAt && (
          <Alert
            variant={vet.lastValidationOk ? 'default' : 'destructive'}
            className={
              vet.lastValidationOk
                ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                : undefined
            }
          >
            {vet.lastValidationOk ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle className="text-sm">
              Última validación —{' '}
              {format(new Date(vet.lastValidatedAt), "d MMM yyyy, HH:mm", { locale: es })}
            </AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>{vet.lastValidationMessage}</p>
              {vet.lastValidationAuthMethod && (
                <p className="text-muted-foreground">
                  Método detectado: {vet.lastValidationAuthMethod}
                  {vet.lastValidationHttpStatus != null && ` · HTTP ${vet.lastValidationHttpStatus}`}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Próximos pasos (automáticos)</p>
          <p>Tras una conexión exitosa podremos sincronizar ventas y citas para reportes en GrooFlow.</p>
          <p>
            Si «Probar conexión» falla por CORS, la URL puede ser correcta; hará falta un proxy en
            servidor (Edge Function).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
