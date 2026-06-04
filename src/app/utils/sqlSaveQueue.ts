/**
 * Cola serializada por clave de dominio (evita carreras entre autosave y persist explícito).
 */
export type SqlSaveQueue = {
  enqueue<T>(label: string, run: () => Promise<T>): Promise<T>;
  flush(): Promise<void>;
};

export function createSqlSaveQueue(): SqlSaveQueue {
  let chain: Promise<unknown> = Promise.resolve();

  return {
    enqueue<T>(label: string, run: () => Promise<T>): Promise<T> {
      const next = chain.then(() => run());
      chain = next.catch((err) => {
        console.warn(`[sqlSaveQueue] ${label}`, err);
      });
      return next;
    },
    flush(): Promise<void> {
      return chain.then(() => undefined);
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

/** Solo para tests — reinicia colas globales. */
export function resetSqlSaveQueuesForTests(): void {
  queuesByKey.clear();
}
