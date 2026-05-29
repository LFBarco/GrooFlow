/** Canal entre pestañas del mismo origen (mismo navegador / sesión GrooFlow). */
export const KV_CROSS_TAB_CHANNEL = 'grooflow-kv-sync-v1';

export type KvCrossTabMessage = {
  type: 'kv-updated';
  key: string;
  value: unknown;
  tabInstanceId: string;
  savedAt: number;
};

let tabInstanceId: string | null = null;

/** ID único por pestaña (sessionStorage). */
export function getTabInstanceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  if (tabInstanceId) return tabInstanceId;
  const stored = sessionStorage.getItem('grooflow_tab_id');
  if (stored) {
    tabInstanceId = stored;
    return stored;
  }
  tabInstanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem('grooflow_tab_id', tabInstanceId);
  return tabInstanceId;
}

/** Tras aplicar un update de otra pestaña, evitar re-broadcast del autosave eco. */
const suppressBroadcastUntil = new Map<string, number>();

export function markCrossTabEchoWindow(key: string, ms = 4000): void {
  suppressBroadcastUntil.set(key, Date.now() + ms);
}

export function shouldBroadcastKvUpdate(key: string): boolean {
  return Date.now() >= (suppressBroadcastUntil.get(key) ?? 0);
}

export function kvPayloadsEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function broadcastKvUpdate(key: string, value: unknown): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(KV_CROSS_TAB_CHANNEL);
    const msg: KvCrossTabMessage = {
      type: 'kv-updated',
      key,
      value,
      tabInstanceId: getTabInstanceId(),
      savedAt: Date.now(),
    };
    ch.postMessage(msg);
    ch.close();
  } catch {
    /* entornos sin BroadcastChannel */
  }
}

export function subscribeKvCrossTab(handler: (msg: KvCrossTabMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const ch = new BroadcastChannel(KV_CROSS_TAB_CHANNEL);
  ch.onmessage = (ev: MessageEvent<KvCrossTabMessage>) => {
    const data = ev.data;
    if (!data || data.type !== 'kv-updated') return;
    if (data.tabInstanceId === getTabInstanceId()) return;
    handler(data);
  };
  return () => ch.close();
}

/** Etiqueta legible para toasts de sync entre pestañas. */
export function kvKeyDisplayLabel(key: string): string {
  const labels: Record<string, string> = {
    'settings:config': 'Configuración operativa',
    'settings:system': 'Configuración del sistema',
    'settings:theme': 'Tema',
    'settings:alertThresholds': 'Umbrales de alertas',
    'data:transactions': 'Transacciones',
    'data:providers': 'Proveedores',
    'data:pettyCash': 'Caja chica',
    'data:fleet': 'Flota clínica',
    'data:chartOfAccounts': 'Plan de cuentas',
    'data:products': 'Productos',
    'data:roles': 'Roles',
    'data:invoices': 'Facturas',
    'data:requests': 'Solicitudes',
    'data:feeReceipts': 'Honorarios',
    'data:treasuryInvoices': 'Tesorería (facturas)',
    'data:treasuryBankBalance': 'Tesorería (saldo)',
    'data:treasuryPaidHistory': 'Tesorería (pagos)',
    'data:users': 'Usuarios',
  };
  return labels[key] ?? key;
}
