import { CheckCircle2, CircleDashed, FileSpreadsheet, PlayCircle, Trash2, XCircle } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { sourceLabel } from '../domain/auditLabels';
import { sessionMovements } from '../domain/dataset';
import type { ReconciliationDataset, ReconciliationSourceType } from '../domain/types';

const ALL_SOURCES: ReconciliationSourceType[] = [
  'sales_erp',
  'bcp_bank',
  'mercado_pago',
  'niubiz',
];

type Props = {
  dataset: ReconciliationDataset;
  sessionId: string;
  compact?: boolean;
  onDeleteBatch?: (batchId: string) => void;
  onDeleteAllForSource?: (sourceType: ReconciliationSourceType) => void;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ReconciliationImportStatus({
  dataset,
  sessionId,
  compact,
  onDeleteBatch,
  onDeleteAllForSource,
}: Props) {
  const movements = sessionMovements(dataset, sessionId);
  const batches = dataset.batches.filter((b) => b.sessionId === sessionId);
  const matches = dataset.matches.filter((m) => m.sessionId === sessionId);
  const canDelete = Boolean(onDeleteBatch);

  const hasBank = movements.some((m) => m.sourceType !== 'sales_erp');
  const hasSales = movements.some((m) => m.sourceType === 'sales_erp');
  const reconciled = movements.filter((m) => m.workflowStatus === 'reconciled').length;

  let crossStatus: 'empty' | 'needs_upload' | 'needs_engine' | 'partial';
  if (movements.length === 0) {
    crossStatus = 'empty';
  } else if (!hasSales || !hasBank) {
    crossStatus = 'needs_upload';
  } else if (matches.length === 0 && reconciled === 0) {
    crossStatus = 'needs_engine';
  } else {
    crossStatus = 'partial';
  }

  const crossLabels = {
    empty: { text: 'Sin datos en esta sesión', variant: 'outline' as const, icon: CircleDashed },
    needs_upload: { text: 'Faltan fuentes — aún no se puede cruzar', variant: 'secondary' as const, icon: XCircle },
    needs_engine: { text: 'Archivos listos — pulse «Re-ejecutar motor»', variant: 'secondary' as const, icon: PlayCircle },
    partial: {
      text: `Cruce ejecutado · ${reconciled.toLocaleString('es-PE')} conciliados · ${matches.length.toLocaleString('es-PE')} pares`,
      variant: 'default' as const,
      icon: CheckCircle2,
    },
  };
  const cross = crossLabels[crossStatus];

  return (
    <Card className={compact ? 'border-dashed' : undefined}>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" />
          Archivos y estado del cruce
          <Badge variant={cross.variant} className="font-normal">
            <cross.icon className="mr-1 h-3 w-3" />
            {cross.text}
          </Badge>
        </CardTitle>
        {!compact && (
          <CardDescription>
            Lista de importaciones en la sesión seleccionada. Puede eliminar un archivo o todos los de una fuente y
            volver a subirlos si hubo error.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Fuente</th>
                <th className="p-2">Archivo(s)</th>
                <th className="p-2 text-right">Registros</th>
                <th className="p-2 text-right">Conciliados</th>
                {canDelete && <th className="p-2 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {ALL_SOURCES.map((source) => {
                const sourceBatches = batches.filter((b) => b.sourceType === source);
                const sourceMovements = movements.filter((m) => m.sourceType === source);
                const sourceReconciled = sourceMovements.filter((m) => m.workflowStatus === 'reconciled').length;
                const uploaded = sourceMovements.length > 0;

                return (
                  <tr key={source} className="border-t">
                    <td className="p-2 font-medium">{sourceLabel(source)}</td>
                    <td className="p-2 text-xs">
                      {sourceBatches.length === 0 ? (
                        <span className="text-muted-foreground">No subido</span>
                      ) : (
                        <ul className="space-y-1">
                          {sourceBatches.map((b) => (
                            <li key={b.id} title={formatWhen(b.importedAt)}>
                              {b.fileName}{' '}
                              <span className="text-muted-foreground">
                                ({b.recordCount.toLocaleString('es-PE')})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {uploaded ? (
                        sourceMovements.length.toLocaleString('es-PE')
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {uploaded ? (
                        <span className={sourceReconciled > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                          {sourceReconciled.toLocaleString('es-PE')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {canDelete && (
                      <td className="p-2 text-right">
                        {sourceBatches.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {sourceBatches.map((b) => (
                              <Button
                                key={b.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => onDeleteBatch?.(b.id)}
                                title={`Eliminar ${b.fileName}`}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Eliminar
                              </Button>
                            ))}
                            {sourceBatches.length > 1 && onDeleteAllForSource && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => onDeleteAllForSource(source)}
                              >
                                Eliminar todos ({sourceBatches.length})
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {crossStatus === 'needs_upload' && (
          <p className="text-xs text-amber-600">
            {hasBank && !hasSales && 'Hay extracto bancario/pasarela pero no ventas ERP. Suba el Excel de ventas en Importar.'}
            {!hasBank && hasSales && 'Hay ventas ERP pero no extracto BCP/MP/Niubiz. Suba al menos un extracto.'}
            {!hasBank && !hasSales && 'Suba archivos en la pestaña Importar.'}
          </p>
        )}
        {crossStatus === 'needs_engine' && (
          <p className="text-xs text-amber-600">
            Los archivos están cargados pero el motor de cruce no se ha ejecutado (o usó «Importar sin conciliar»).
            Pulse <strong>Re-ejecutar motor</strong> arriba a la derecha.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
