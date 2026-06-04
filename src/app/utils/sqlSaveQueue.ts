/**
 * Cola serializada para saves SQL (evita carreras entre autosave y persist explícito).
 */
export function createSqlSaveQueue() {
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
