import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { repository } from '../services/repository';
import { kvAtomicUpdate } from '../utils/kvAtomicUpdate';
import { isKvPermissionDeniedError, markKvPermissionDenied } from '../utils/kvWriteAccess';

type Updater<T> = (prev: T) => T;

type Messages = {
  loadError: string;
  saveError: string;
  permissionDenied: string;
  noPermission: string;
};

/**
 * Settings KV multiusuario: la UI es optimista y cada guardado reaplica los cambios
 * pendientes sobre la versión más reciente del servidor (no sobrescribe a otros).
 */
export function useKvAtomicSettings<T>(input: {
  key: string;
  merge: (raw: T | null) => T;
  canEdit: boolean;
  messages: Messages;
}) {
  const { key, merge, canEdit, messages } = input;
  const [settings, setSettings] = useState<T>(() => merge(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef<{ updater: Updater<T>; message?: string }[]>([]);
  const flushingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const mergeRef = useRef(merge);
  mergeRef.current = merge;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const raw = await repository.kv.get<T>(key);
        if (!cancelled) setSettings(mergeRef.current(raw));
      } catch {
        if (!cancelled) toast.error(messagesRef.current.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [key]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (flushingRef.current) return false;
    const batch = pendingRef.current;
    if (batch.length === 0) return true;
    pendingRef.current = [];
    flushingRef.current = true;
    if (mountedRef.current) setSaving(true);
    try {
      const saved = await kvAtomicUpdate<T>({
        kv: repository.kv,
        key,
        merge: mergeRef.current,
        apply: (fresh) => batch.reduce((acc, p) => p.updater(acc), fresh),
      });
      if (mountedRef.current) {
        // Estado del servidor (incluye cambios de otros) + lo que se editó mientras guardaba.
        setSettings(pendingRef.current.reduce((acc, p) => p.updater(acc), saved));
        const lastMessage = [...batch].reverse().find((p) => p.message)?.message;
        if (lastMessage) toast.success(lastMessage);
      }
      return true;
    } catch (e) {
      pendingRef.current = [...batch, ...pendingRef.current];
      if (isKvPermissionDeniedError(e)) {
        markKvPermissionDenied(key);
        pendingRef.current = [];
        toast.error(messagesRef.current.permissionDenied);
      } else {
        toast.error(messagesRef.current.saveError);
      }
      return false;
    } finally {
      flushingRef.current = false;
      if (mountedRef.current) setSaving(false);
      if (pendingRef.current.length > 0 && mountedRef.current && !timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void flush();
        }, 400);
      }
    }
  }, [key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current.length > 0) void flush();
    };
  }, [flush]);

  const updateSettings = useCallback(
    (updater: Updater<T>, message?: string) => {
      if (!canEdit) {
        toast.error(messagesRef.current.noPermission);
        return;
      }
      setSettings((prev) => updater(prev));
      pendingRef.current.push({ updater, message });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, 400);
    },
    [canEdit, flush]
  );

  return { settings, loading, saving, updateSettings, flush };
}
