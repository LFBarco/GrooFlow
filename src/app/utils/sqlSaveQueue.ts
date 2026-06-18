/**
 * Cola serializada por clave de dominio (evita carreras entre autosave y persist explícito).
 */
export type SqlSaveQueue = {
  enqueue<T>(label: string, run: () => Promise<T>): Promise<T>;
  flush(): Promise<boolean>;
};

export type SqlFlushReport = {
  ok: boolean;
  failedLabels: string[];
};

export function createSqlSaveQueue(): SqlSaveQueue {
  let chain: Promise<unknown> = Promise.resolve();
  let lastFailedLabel: string | null = null;

  return {
    enqueue<T>(label: string, run: () => Promise<T>): Promise<T> {
      const next = chain.then(async () => {
        try {
          const result = await run();
          lastFailedLabel = null;
          return result;
        } catch (err) {
          lastFailedLabel = label;
          console.warn(`[sqlSaveQueue] ${label}`, err);
          throw err;
        }
      });
      chain = next.catch(() => undefined);
      return next;
    },
    flush(): Promise<boolean> {
      return chain.then(() => lastFailedLabel === null);
    },
  };
}

const queuesByKey = new Map<string, SqlSaveQueue>();

/** Una cola por storageKey (p. ej. `data:transactions`, `settings:system`). */
export function getSqlSaveQueue(storageKey: string): SqlSaveQueue {
  let queue = queuesByKey.get(storageKey);
  if (!queue) {
    queue = createSqlSaveQueue();
    queuesByKey.set(storageKey, queue);
  }
  return queue;
}

/** Espera a que terminen todos los guardados SQL encolados (p. ej. antes de logout). */
export function flushAllSqlSaveQueues(): Promise<SqlFlushReport> {
  const entries = [...queuesByKey.entries()];
  if (entries.length === 0) {
    return Promise.resolve({ ok: true, failedLabels: [] });
  }
  return Promise.all(
    entries.map(async ([key, queue]) => ({
      key,
      ok: await queue.flush(),
    }))
  ).then((results) => {
    const failedLabels = results.filter((r) => !r.ok).map((r) => r.key);
    return { ok: failedLabels.length === 0, failedLabels };
  });
}

/** Solo para tests — reinicia colas globales. */
export function resetSqlSaveQueuesForTests(): void {
  queuesByKey.clear();
}
