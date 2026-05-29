import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import type { CloudSyncPhase } from '../../utils/kvDomainPersistence';
import { Button } from '../ui/button';

interface CloudSyncIndicatorProps {
  phase: CloudSyncPhase;
  visible: boolean;
  onRetry?: () => void;
  compact?: boolean;
  /** Clave KV del último error (ej. data:transactions) */
  errorKey?: string | null;
  errorKeyLabel?: (key: string) => string;
}

const LABELS: Record<CloudSyncPhase, string> = {
  idle: 'Nube',
  loading: 'Cargando…',
  saving: 'Guardando…',
  synced: 'Sincronizado',
  error: 'Error al guardar',
};

export function CloudSyncIndicator({
  phase,
  visible,
  onRetry,
  compact = false,
  errorKey,
  errorKeyLabel,
}: CloudSyncIndicatorProps) {
  if (!visible) return null;

  const isSaving = phase === 'saving' || phase === 'loading';
  const isError = phase === 'error';
  const isSynced = phase === 'synced';

  const Icon = isError ? CloudOff : isSaving ? Loader2 : Cloud;
  const color = isError
    ? '#fb7185'
    : isSaving
      ? '#fbbf24'
      : isSynced
        ? '#34d399'
        : 'rgba(255,255,255,0.35)';

  const errorModule =
    isError && errorKey && errorKeyLabel ? errorKeyLabel(errorKey) : null;
  const title = errorModule ? `${LABELS[phase]} · ${errorModule}` : LABELS[phase];
  const label = errorModule && !compact ? `${LABELS[phase]} · ${errorModule}` : LABELS[phase];

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${compact ? 'text-[10px]' : 'text-xs'}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${isError ? 'rgba(251,113,133,0.35)' : 'rgba(255,255,255,0.08)'}`,
        color,
      }}
      title={title}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${isSaving ? 'animate-spin' : ''}`} />
      {!compact && <span className="font-medium whitespace-nowrap max-w-[180px] truncate">{label}</span>}
      {isError && onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 ml-0.5 text-[10px] hover:bg-white/10"
          onClick={onRetry}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
