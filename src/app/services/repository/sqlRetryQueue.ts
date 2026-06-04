/**
 * Cola de reintento SQL cuando KV guardó OK pero SQL falló (localStorage).
 */
const STORAGE_KEY = 'gooflow:sql-retry-queue:v1';
const MAX_ITEMS = 40;

export type SqlRetryItem = {
  id: string;
  storageKey: string;
  createdAt: number;
  attempts: number;
};

function readQueue(): SqlRetryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SqlRetryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: SqlRetryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota */
  }
}

export function enqueueSqlRetry(storageKey: string): void {
  const queue = readQueue();
  if (queue.some((q) => q.storageKey === storageKey)) return;
  queue.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storageKey,
    createdAt: Date.now(),
    attempts: 0,
  });
  writeQueue(queue);
}

export function dequeueSqlRetry(storageKey: string): void {
  writeQueue(readQueue().filter((q) => q.storageKey !== storageKey));
}

export function listSqlRetries(): SqlRetryItem[] {
  return readQueue();
}

export function bumpSqlRetryAttempt(id: string): void {
  const queue = readQueue().map((q) =>
    q.id === id ? { ...q, attempts: q.attempts + 1 } : q
  );
  writeQueue(queue.filter((q) => q.attempts < 5));
}
