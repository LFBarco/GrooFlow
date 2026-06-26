import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { RECONCILIATION_CONNECTORS } from '../connectors';
import { downloadSalesImportTemplate } from '../connectors/salesExcelConnector';
import type { ReconciliationDataset, ReconciliationSourceType } from '../domain/types';
import { importReconciliationFile } from '../engines/reconciliationRunner';

type Props = {
  dataset: ReconciliationDataset;
  onDatasetChange: (next: ReconciliationDataset) => void;
  disabled?: boolean;
};

export function ReconciliationImportPanel({ dataset, onDatasetChange, disabled }: Props) {
  const inputRefs = useRef<Partial<Record<ReconciliationSourceType, HTMLInputElement | null>>>({});
  const [loading, setLoading] = useState<ReconciliationSourceType | null>(null);

  const handleFile = async (sourceType: ReconciliationSourceType, file: File | undefined) => {
    if (!file || disabled) return;
    setLoading(sourceType);
    try {
      const result = await importReconciliationFile(dataset, sourceType, file);
      onDatasetChange(result.dataset);
      if (result.imported === 0) {
        toast.warning(`Sin registros importados (${result.skipped} omitidos).`);
      } else {
        toast.success(
          `${result.imported} registro(s) importados — conciliación actualizada.`,
          result.errors.length
            ? { description: `${result.errors.length} advertencia(s) en el archivo.` }
            : undefined
        );
      }
      if (result.errors.length > 0) {
        console.warn('[reconciliation] import warnings', result.errors);
      }
    } catch (e) {
      console.warn('[reconciliation] import', e);
      toast.error('No se pudo procesar el archivo.');
    } finally {
      setLoading(null);
      const input = inputRefs.current[sourceType];
      if (input) input.value = '';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {RECONCILIATION_CONNECTORS.map((connector) => (
        <Card key={connector.sourceType}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{connector.label}</CardTitle>
            <CardDescription>
              {connector.acceptedExtensions.join(', ')} — se agrega al lote del día sin reemplazar
              importaciones anteriores.
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
                Plantilla ventas
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
