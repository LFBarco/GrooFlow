import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchServerListPage } from '../utils/listsApi';

export function useServerPagedList<T>(
  name: string,
  opts?: {
    initialPageSize?: number;
    extra?: Record<string, string>;
    enabled?: boolean;
  }
) {
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts?.initialPageSize ?? 25);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);
  const extraKey = JSON.stringify(opts?.extra ?? {});
  const enabled = opts?.enabled !== false;

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, pageSize, extraKey]);

  const load = useCallback(async () => {
    if (!enabled) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const data = await fetchServerListPage<T>(name, {
        page,
        pageSize,
        search: searchDebounced,
        extra: opts?.extra,
      });
      if (reqId !== reqIdRef.current) return;
      setItems(data.items);
      setTotal(data.total);
      setFiltered(data.filtered);
      if (data.page !== page) setPage(data.page);
    } catch {
      if (reqId !== reqIdRef.current) return;
      setItems([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [enabled, extraKey, name, page, pageSize, searchDebounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(Math.max(filtered, 1) / pageSize));

  return {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    items,
    total,
    filtered,
    totalPages,
    loading,
    reload: load,
  };
}
