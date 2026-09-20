import { useEffect, useState } from 'react';

import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type { HrCollaboratorRow } from '../utils/accidentesData';

/** Carga activos del módulo Colaboradores (Buk) vía GET /hr/colaboradores. */
export function useHrCollaborators() {
  const [employees, setEmployees] = useState<HrCollaboratorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getGrooflowToken();
        if (!token) throw new Error('Sin sesión');
        const res = await fetch(`${getGrooflowApiBase()}/hr/colaboradores`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'X-Groomers-Client': 'grooflow',
          },
        });
        const text = await res.text();
        let json: Record<string, unknown> = {};
        if (text.trim()) {
          try {
            json = JSON.parse(text) as Record<string, unknown>;
          } catch {
            json = {};
          }
        }
        if (!res.ok || json.ok === false) {
          throw new Error(String(json.error ?? `HTTP ${res.status}`));
        }
        const items = Array.isArray(json.items) ? (json.items as HrCollaboratorRow[]) : [];
        if (!cancelled) setEmployees(items);
      } catch (e) {
        if (!cancelled) {
          setEmployees([]);
          setError(e instanceof Error ? e.message : 'No se pudo cargar colaboradores');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { employees, loading, error };
}
