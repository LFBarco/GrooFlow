import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Braces,
  Loader2,
  Plus,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import type { BukCatalogEndpointConfig } from '../../types';
import { buildBukEndpointUrl, probeBukEndpoint, type BukApiProvider } from '../../utils/bukEndpointProbe';
import { DEFAULT_BUK_ASISTENCIA_BASE_URL, sanitizeBukBaseUrl } from '../../utils/bukAsistenciaApi';
import { DEFAULT_BUK_PE_BASE_URL, sanitizeBukPeBaseUrl } from '../../utils/bukPeApi';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type Props = {
  provider?: BukApiProvider;
  baseUrl: string;
  apiToken: string;
  /** Lee el token del input aunque aún no se haya guardado en settings. */
  getApiToken?: () => string;
  endpoints: BukCatalogEndpointConfig[];
  readOnly?: boolean;
  onChangeEndpoints: (next: BukCatalogEndpointConfig[], message?: string) => void;
};

type ProbeView = {
  endpointId: string;
  result: Awaited<ReturnType<typeof probeBukEndpoint>>;
};

function newEndpointId() {
  return `buk-ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function BukEndpointsExplorer({
  provider = 'ctrlit',
  baseUrl,
  apiToken,
  getApiToken,
  endpoints,
  readOnly = false,
  onChangeEndpoints,
}: Props) {
  const [probeView, setProbeView] = useState<ProbeView | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<BukCatalogEndpointConfig | null>(null);

  const resolvedBase =
    provider === 'bukpe'
      ? sanitizeBukPeBaseUrl(baseUrl || DEFAULT_BUK_PE_BASE_URL)
      : sanitizeBukBaseUrl(baseUrl || DEFAULT_BUK_ASISTENCIA_BASE_URL);

  const filteredFields = useMemo(() => {
    const fields = probeView?.result.fields ?? [];
    const q = fieldFilter.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) => f.path.toLowerCase().includes(q) || f.sample.toLowerCase().includes(q)
    );
  }, [probeView, fieldFilter]);

  const openNew = () => {
    setDraft({
      id: newEndpointId(),
      name: '',
      pathOrUrl: '',
      description: '',
      notes: '',
      enabled: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (ep: BukCatalogEndpointConfig) => {
    setDraft({ ...ep });
    setEditorOpen(true);
  };

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const pathOrUrl = draft.pathOrUrl.trim();
    if (!name || !pathOrUrl) {
      toast.error('Nombre y ruta/URL son obligatorios.');
      return;
    }
    const nextItem = { ...draft, name, pathOrUrl };
    const exists = endpoints.some((e) => e.id === nextItem.id);
    const next = exists
      ? endpoints.map((e) => (e.id === nextItem.id ? nextItem : e))
      : [...endpoints, nextItem];
    onChangeEndpoints(next, 'Endpoint Buk guardado.');
    setEditorOpen(false);
    setDraft(null);
  };

  const removeEndpoint = (id: string) => {
    onChangeEndpoints(
      endpoints.filter((e) => e.id !== id),
      'Endpoint eliminado.'
    );
    if (probeView?.endpointId === id) setProbeView(null);
  };

  const runProbe = async (ep: BukCatalogEndpointConfig) => {
    const resolvedToken = (getApiToken?.() ?? apiToken).trim();
    if (!resolvedToken) {
      toast.error(
        provider === 'bukpe'
          ? 'Configura el auth_token de Buk.pe antes de consultar.'
          : 'Configura el token Buk antes de consultar endpoints.'
      );
      return;
    }
    setProbingId(ep.id);
    toast.info(`Consultando ${ep.name}…`);
    try {
      const result = await probeBukEndpoint({
        provider,
        baseUrl: resolvedBase,
        apiToken: resolvedToken,
        pathOrUrl: ep.pathOrUrl,
      });
      setProbeView({ endpointId: ep.id, result });
      setShowJson(false);
      const at = new Date().toISOString();
      onChangeEndpoints(
        endpoints.map((e) =>
          e.id === ep.id
            ? {
                ...e,
                lastProbedAt: at,
                lastProbeOk: result.ok,
                lastProbeStatus: result.status,
                lastProbeMessage: result.message,
                lastProbeRecordCount: result.recordCount,
                lastProbeFieldPaths: result.fieldPaths,
              }
            : e
        )
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setProbingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Braces className="h-5 w-5" />
          Catálogo de endpoints Buk
        </CardTitle>
        <CardDescription>
          Agrega las rutas que te compartieron (mismo token). Consulta cada una y revisa los campos
          disponibles para decidir cuáles usar en GrooFlow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <Button type="button" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar endpoint
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground self-center">
            Base: <code className="text-[11px]">{resolvedBase}</code>
          </p>
        </div>

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ruta / URL</TableHead>
                <TableHead className="w-[120px]">Última consulta</TableHead>
                <TableHead className="w-[90px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Sin endpoints. Agrega rutas como <code>empleados</code>,{' '}
                    <code>contratos?page=1</code>, etc.
                  </TableCell>
                </TableRow>
              ) : (
                endpoints.map((ep) => {
                  const fullUrl = buildBukEndpointUrl(resolvedBase, ep.pathOrUrl, provider);
                  const isActive = probeView?.endpointId === ep.id;
                  return (
                    <TableRow key={ep.id} className={isActive ? 'bg-muted/40' : undefined}>
                      <TableCell>
                        <div className="font-medium text-sm">{ep.name}</div>
                        {ep.description ? (
                          <div className="text-xs text-muted-foreground">{ep.description}</div>
                        ) : null}
                        {ep.lastProbeOk != null ? (
                          <Badge
                            variant={ep.lastProbeOk ? 'secondary' : 'destructive'}
                            className="mt-1 text-[10px]"
                          >
                            {ep.lastProbeOk ? 'OK' : 'Error'}
                            {ep.lastProbeRecordCount != null ? ` · ${ep.lastProbeRecordCount}` : ''}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs break-all" title={fullUrl}>
                        {ep.pathOrUrl}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ep.lastProbedAt
                          ? format(new Date(ep.lastProbedAt), 'd MMM HH:mm', { locale: es })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={probingId === ep.id}
                          onClick={() => void runProbe(ep)}
                        >
                          {probingId === ep.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Zap className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {!readOnly ? (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => openEdit(ep)}>
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeEndpoint(ep.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {probeView ? (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Campos detectados</p>
                <p className="text-xs text-muted-foreground">
                  {probeView.result.message}
                  {probeView.result.status != null ? ` · HTTP ${probeView.result.status}` : ''}
                  {probeView.result.triedUrl ? (
                    <>
                      {' '}
                      · <span className="font-mono">{probeView.result.triedUrl}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Filtrar campos…"
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                />
              </div>
            </div>

            {filteredFields.length > 0 ? (
              <div className="rounded-md border max-h-[280px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead className="w-[80px]">Tipo</TableHead>
                      <TableHead>Ejemplo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFields.map((f) => (
                      <TableRow key={f.path}>
                        <TableCell className="font-mono text-xs">{f.path}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {f.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{f.sample}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No se detectaron campos en registros. Revisa la respuesta JSON abajo.
              </p>
            )}

            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => setShowJson((v) => !v)}
            >
              {showJson ? 'Ocultar muestra JSON' : 'Ver muestra JSON'}
            </Button>
            {showJson ? (
              <pre className="max-h-[240px] overflow-auto rounded-md bg-background border p-3 text-[11px] font-mono">
                {JSON.stringify(
                  probeView.result.sample.length
                    ? probeView.result.sample
                    : probeView.result.rawPreview ?? probeView.result,
                  null,
                  2
                )}
              </pre>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pulsa el botón ⚡ en un endpoint para consultarlo y ver sus campos.
          </p>
        )}
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft && endpoints.some((e) => e.id === draft.id) ? 'Editar' : 'Nuevo'} endpoint</DialogTitle>
            <DialogDescription>
              Ruta relativa a la base o URL completa de Ctrlit. Puedes incluir parámetros (
              <code>?page=1&page_size=5</code>).
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ej. Empleados activos"
                />
              </div>
              <div className="space-y-1">
                <Label>Ruta o URL</Label>
                <Input
                  value={draft.pathOrUrl}
                  onChange={(e) => setDraft({ ...draft, pathOrUrl: e.target.value })}
                  placeholder="empleados?page=1&page_size=10"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  URL final: {buildBukEndpointUrl(resolvedBase, draft.pathOrUrl || '…', provider)}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>Notas internas (opcional)</Label>
                <Textarea
                  value={draft.notes ?? ''}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={2}
                  placeholder="Qué campos nos interesan, pendientes, etc."
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveDraft}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
