import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { RECONCILIATION_CONNECTORS } from '../connectors';
import { downloadSalesImportTemplate } from '../connectors/salesExcelConnector';
import { downloadMercadoPagoColumnReference } from '../connectors/mercadoPagoConnector';
import { downloadBcpImportTemplate } from '../connectors/bcpBankConnector';
import { getActiveSession } from '../domain/dataset';
import type { ReconciliationDataset, ReconciliationSourceType } from '../domain/types';
import { importReconciliationFile, deleteReconciliationBatch } from '../engines/reconciliationRunner';
import { ReconciliationImportStatus } from './ReconciliationImportStatus';

type Props = {
  dataset: ReconciliationDataset;
  onDatasetChange: (next: ReconciliationDataset) => void;
  disabled?: boolean;
};

export function ReconciliationImportPanel({ dataset, onDatasetChange, disabled }: Props) {
  const inputRefs = useRef<Partial<Record<ReconciliationSourceType, HTMLInputElement | null>>>({});
  const [loading, setLoading] = useState<ReconciliationSourceType | null>(null);
  const [importOnly, setImportOnly] = useState(false);
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);

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
      if (result.imported === 0) {
        toast.warning(`Sin registros importados (${result.skipped} omitidos).`);
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
        sessionId={getActiveSession(dataset).id}
        onDeleteBatch={(batchId) => {
          const batch = dataset.batches.find((b) => b.id === batchId);
          if (!batch) return;
          const count = dataset.movements.filter((m) => m.batchId === batchId).length;
          const ok = window.confirm(
            `¿Eliminar «${batch.fileName}» y sus ${count.toLocaleString('es-PE')} registro(s)?\n\nSe recalculará el cruce automáticamente.`
          );
          if (!ok) return;
          onDatasetChange(deleteReconciliationBatch(dataset, batchId));
          toast.success(`Archivo «${batch.fileName}» eliminado.`);
        }}
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
        {RECONCILIATION_CONNECTORS.map((connector) => (
          <Card key={connector.sourceType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{connector.label}</CardTitle>
              <CardDescription>
                {connector.sourceType === 'mercado_pago'
                  ? 'Exportación oficial MP: columnas A (fecha), G (N° operación), H (approved), K (importe).'
                  : connector.sourceType === 'sales_erp'
                    ? 'ERP: K solo para Cod. Op. Pago 1; códigos 2–4 se cruzan por N° operación contra banco/pasarela.'
                    : connector.sourceType === 'bcp_bank'
                      ? 'Extracto BCP: FECHA, DESCRIPCION, MONTO, OPERACION (8 díg.), TIPO — solo abonos.'
                      : `${connector.acceptedExtensions.join(', ')} — se agrega al lote del día sin reemplazar importaciones anteriores.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
