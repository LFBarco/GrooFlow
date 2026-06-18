import { useEffect, useState } from 'react';

/** Estado de conectividad del navegador (navigator.onLine + eventos online/offline). */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
