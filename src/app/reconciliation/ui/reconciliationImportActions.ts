import { toast } from 'sonner';

import type { ReconciliationDataset, ReconciliationSourceType } from '../domain/types';
import { appConfirm } from '../../components/ui/app-dialog';
import {
  deleteAllBatchesForSourceInSession,
  deleteReconciliationBatch,
} from '../engines/reconciliationRunner';

export async function confirmDeleteReconciliationBatch(
  dataset: ReconciliationDataset,
  batchId: string,
  onDatasetChange: (updater: (prev: ReconciliationDataset) => ReconciliationDataset) => void
): Promise<void> {
  const batch = dataset.batches.find((b) => b.id === batchId);
  if (!batch) return;
  const count = dataset.movements.filter((m) => m.batchId === batchId).length;
  const ok = await appConfirm(
    `¿Eliminar «${batch.fileName}» y sus ${count.toLocaleString('es-PE')} registro(s)?\n\nSe recalculará el cruce automáticamente.`
  );
  if (!ok) return;
  onDatasetChange((prev) => deleteReconciliationBatch(prev, batchId));
  toast.success(`Archivo «${batch.fileName}» eliminado.`);
}

export async function confirmDeleteAllSourceBatches(
  dataset: ReconciliationDataset,
  sessionId: string,
  sourceType: ReconciliationSourceType,
  sourceLabel: string,
  onDatasetChange: (updater: (prev: ReconciliationDataset) => ReconciliationDataset) => void
): Promise<void> {
  const batches = dataset.batches.filter(
    (b) => b.sessionId === sessionId && b.sourceType === sourceType
  );
  if (batches.length === 0) return;
  const count = dataset.movements.filter(
    (m) => m.sessionId === sessionId && batches.some((b) => b.id === m.batchId)
  ).length;
  const ok = await appConfirm(
    `¿Eliminar ${batches.length} archivo(s) de ${sourceLabel} (${count.toLocaleString('es-PE')} registro(s))?\n\nSe recalculará el cruce automáticamente.`
  );
  if (!ok) return;
  onDatasetChange((prev) => deleteAllBatchesForSourceInSession(prev, sessionId, sourceType));
  toast.success(`Importaciones de ${sourceLabel} eliminadas.`);
}
