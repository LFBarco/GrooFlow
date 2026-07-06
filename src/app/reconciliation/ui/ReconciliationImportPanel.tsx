import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { RECONCILIATION_CONNECTORS } from '../connectors';
import { SOURCE_LABELS } from '../domain/auditLabels';
import { downloadSalesImportTemplate } from '../connectors/salesExcelConnector';
import { downloadMercadoPagoColumnReference } from '../connectors/mercadoPagoConnector';
import { downloadBcpImportTemplate } from '../connectors/bcpBankConnector';
import { getActiveSession } from '../domain/dataset';
import type { ReconciliationDataset, ReconciliationSourceType } from '../domain/types';
import { importReconciliationFile } from '../engines/reconciliationRunner';
import {
  confirmDeleteAllSourceBatches,
  confirmDeleteReconciliationBatch,
} from './reconciliationImportActions';
import { ReconciliationImportStatus } from './ReconciliationImportStatus';

type Props = {
  dataset: ReconciliationDataset;
  onDatasetChange: (
    updater: ReconciliationDataset | ((prev: ReconciliationDataset) => ReconciliationDataset)
  ) => void;
  disabled?: boolean;
};

export function ReconciliationImportPanel({ dataset, onDatasetChange, disabled }: Props) {
  const inputRefs = useRef<Partial<Record<ReconciliationSourceType, HTMLInputElement | null>>>({});
  const [loading, setLoading] = useState<ReconciliationSourceType | null>(null);
  const [importOnly, setImportOnly] = useState(false);
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  const sessionId = getActiveSession(dataset).id;

  const handleDeleteBatch = (batchId: string) => {
    confirmDeleteReconciliationBatch(dataset, batchId, onDatasetChange);
  };

  const handleDeleteAllForSource = (sourceType: ReconciliationSourceType) => {
    confirmDeleteAllSourceBatches(
      dataset,
      sessionId,
      sourceType,
      SOURCE_LABELS[sourceType],
      onDatasetChange
    );
  };

  const handleFile = async (sourceType: ReconciliationSourceType, file: File | undefined) => {
    if (!file || disabled) return;
    setLoading(sourceType);
    setProgress({ label: 'Iniciando…', percent: 0 });
    try {
      const result = await importReconciliationFile(dataset, sourceType, file, undefined, {
        runEngine: !importOnly,
        onProgress: (label, percent) => setProgress({ label, percent }),
      });
      onDatasetChange(result.dataset);
      if (result.imported === 0 && !result.mergeStats) {
        toast.warning(`Sin registros importados (${result.skipped} omitidos).`);
      } else if (result.mergeStats) {
        const { added, updated, unchanged, needsReview } = result.mergeStats;
        const parts = [
          added > 0 ? `${added.toLocaleString('es-PE')} nuevos` : null,
          updated > 0 ? `${updated.toLocaleString('es-PE')} actualizados` : null,
          unchanged > 0 ? `${unchanged.toLocaleString('es-PE')} sin cambio` : null,
          needsReview > 0 ? `${needsReview.toLocaleString('es-PE')} en revisión` : null,
        ].filter(Boolean);
        toast.success(
          parts.length > 0 ? `ERP: ${parts.join(' · ')}` : 'ERP: sin cambios respecto a la importación anterior.',
          needsReview > 0
            ? { description: 'Ventas conciliadas modificadas en el ERP — revise Excepciones.' }
            : importOnly
              ? { description: 'Ejecute «Re-ejecutar motor» para conciliar pendientes.' }
              : undefined
        );
      } else if (importOnly) {
        toast.success(
          `${result.imported.toLocaleString('es-PE')} registro(s) importados. Ejecute «Re-ejecutar motor» para conciliar.`
        );
      } else {
        toast.success(
          `${result.imported.toLocaleString('es-PE')} registro(s) importados — conciliación actualizada.`,
          result.errors.length
            ? { description: `${result.errors.length} advertencia(s) en el archivo.` }
            : undefined
        );
      }
      if (result.errors.length > 0) {
        console.warn('[reconciliation] import warnings', result.errors.slice(0, 20));
      }
    } catch (e) {
      console.warn('[reconciliation] import', e);
      toast.error('No se pudo procesar el archivo.');
    } finally {
      setLoading(null);
      setProgress(null);
      const input = inputRefs.current[sourceType];
      if (input) input.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <ReconciliationImportStatus
        dataset={dataset}
        sessionId={sessionId}
        onDeleteBatch={handleDeleteBatch}
        onDeleteAllForSource={handleDeleteAllForSource}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="import-only" className="text-sm font-medium">
              Importar sin conciliar
            </Label>
            <p className="text-xs text-muted-foreground">
              Recomendado para archivos grandes (+5.000 filas). Sube todas las fuentes y luego pulse «Re-ejecutar motor».
              El cruce usa los <strong>últimos 7 dígitos</strong> del N° operación en todos los reportes.
            </p>
          </div>
          <Switch id="import-only" checked={importOnly} onCheckedChange={setImportOnly} />
        </CardContent>
      </Card>

      {progress && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-1 flex justify-between text-xs">
            <span>{progress.label}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {RECONCILIATION_CONNECTORS.map((connector) => {
          const sourceBatches = dataset.batches.filter(
            (b) => b.sessionId === sessionId && b.sourceType === connector.sourceType
          );

          return (
          <Card key={connector.sourceType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{connector.label}</CardTitle>
              <CardDescription>
                {connector.sourceType === 'mercado_pago'
                  ? 'Exportación oficial MP: columnas A (fecha), G (N° operación), H (approved), K (importe).'
                  : connector.sourceType === 'sales_erp'
                    ? 'ERP: re-importación inteligente por comprobante. Conciliados sin cambios se omiten; correcciones de código op. o medio de pago pasan a revisión.'
                    : connector.sourceType === 'bcp_bank'
                      ? 'Extracto BCP: FECHA, DESCRIPCION, MONTO, OPERACION (8 díg.), TIPO — solo abonos.'
                      : `${connector.acceptedExtensions.join(', ')} — se agrega al lote del día sin reemplazar importaciones anteriores.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
              <input
                ref={(el) => {
                  inputRefs.current[connector.sourceType] = el;
                }}
                type="file"
                accept={connector.acceptedExtensions.join(',')}
                className="hidden"
                disabled={disabled || loading !== null}
                onChange={(e) => void handleFile(connector.sourceType, e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || loading !== null}
                onClick={() => inputRefs.current[connector.sourceType]?.click()}
              >
                {loading === connector.sourceType ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Subir archivo
              </Button>
              {connector.sourceType === 'sales_erp' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => downloadSalesImportTemplate()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Plantilla ventas ERP
                </Button>
              )}
              {connector.sourceType === 'bcp_bank' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => downloadBcpImportTemplate()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Guía columnas BCP
                </Button>
              )}
              {connector.sourceType === 'mercado_pago' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => downloadMercadoPagoColumnReference()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Guía columnas MP
                </Button>
              )}
              </div>

              {sourceBatches.length > 0 && (
                <div className="rounded-md border bg-muted/20 p-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Archivos en esta sesión</p>
                  <ul className="space-y-1">
                    {sourceBatches.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate" title={b.fileName}>
                          {b.fileName}{' '}
                          <span className="text-muted-foreground">
                            ({b.recordCount.toLocaleString('es-PE')})
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={disabled || loading !== null}
                          onClick={() => handleDeleteBatch(b.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {sourceBatches.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 w-full border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                      disabled={disabled || loading !== null}
                      onClick={() => handleDeleteAllForSource(connector.sourceType)}
                    >
                      Eliminar todos los archivos de {connector.label}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
