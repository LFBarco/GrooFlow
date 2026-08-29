import { Cloud, CloudOff, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { CloudSyncPhase } from '../../utils/kvDomainPersistence';
import { Button } from '../ui/button';

interface CloudSyncIndicatorProps {
  phase: CloudSyncPhase;
  visible: boolean;
  onRetry?: () => void;
  compact?: boolean;
  /** false cuando el navegador reporta sin conexión */
  isOnline?: boolean;
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

const COMPACT_LABELS: Record<CloudSyncPhase, string> = {
  idle: 'Nube',
  loading: 'Cargando',
  saving: 'Guardando',
  synced: 'Sincronizado',
  error: 'Error',
};

export function CloudSyncIndicator({
  phase,
  visible,
  onRetry,
  compact = false,
  isOnline = true,
  errorKey,
  errorKeyLabel,
}: CloudSyncIndicatorProps) {
  const { theme } = useApp();
  const isLight = theme === 'light';

  if (!visible) return null;

  const offline = !isOnline;
  const isSaving = !offline && (phase === 'saving' || phase === 'loading');
  const isError = !offline && phase === 'error';
  const isSynced = !offline && phase === 'synced';

  const Icon = offline ? WifiOff : isError ? CloudOff : isSaving ? Loader2 : Cloud;
  const color = offline
    ? isLight
      ? '#ea580c'
      : '#fb923c'
    : isError
      ? isLight
        ? '#e11d48'
        : '#fb7185'
      : isSaving
        ? isLight
          ? '#d97706'
          : '#fbbf24'
        : isSynced
          ? isLight
            ? '#059669'
            : '#34d399'
          : isLight
            ? '#64748b'
            : 'rgba(255,255,255,0.35)';

  const phaseLabel = offline ? 'Sin conexión' : LABELS[phase];
  const compactPhaseLabel = offline ? 'Sin red' : COMPACT_LABELS[phase];
  const errorModule =
    isError && errorKey && errorKeyLabel ? errorKeyLabel(errorKey) : null;
  const title = errorModule ? `${phaseLabel} · ${errorModule}` : phaseLabel;
  const label = errorModule && !compact ? `${phaseLabel} · ${errorModule}` : phaseLabel;
  const displayLabel = compact ? compactPhaseLabel : label;

  const border = offline
    ? isLight
      ? 'rgba(234,88,12,0.35)'
      : 'rgba(251,146,60,0.35)'
    : isError
      ? isLight
        ? 'rgba(225,29,72,0.35)'
        : 'rgba(251,113,133,0.35)'
      : isLight
        ? 'rgba(15,23,42,0.12)'
        : 'rgba(255,255,255,0.08)';

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${compact ? 'text-[10px]' : 'text-xs'}`}
      data-testid="cloud-sync-indicator"
      style={{
        background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${border}`,
        color,
      }}
      title={title}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${isSaving ? 'animate-spin' : ''}`} />
      <span
        className={`font-medium whitespace-nowrap truncate ${compact ? 'text-[10px] max-w-[96px]' : 'max-w-[180px]'}`}
      >
        {displayLabel}
      </span>
      {isError && onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-6 px-1.5 ml-0.5 text-[10px] ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
          onClick={onRetry}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reintentar
        </Button>
      )}
      {offline && onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-6 px-1.5 ml-0.5 text-[10px] ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
          onClick={onRetry}
          title="Reintentar sincronización al volver la conexión"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Sync
        </Button>
      )}
    </div>
  );
}
