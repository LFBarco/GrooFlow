# Migración gradual: KV → tablas SQL (mismo Supabase)

## Situación actual

- La app guarda blobs JSON bajo claves `data:*` y `settings:*` usando la **Edge Function `server`**, que persiste en la tabla Postgres **`kv_store_674cc941`** (ver `supabase/functions/server/kv_store.tsx`).
- Eso **ya es SQL en tu proyecto**, pero **no normalizado** (un JSON por clave).

## Objetivo

- Tener **tablas por entidad** (`transactions`, `providers`, `app_users`, etc.) para consultas, índices, backups y RLS más finos.
- El código puede seguir usando KV un tiempo y migrar **módulo a módulo** hacia `supabase.from('tabla')`.

## Qué se añadió en el repo

| Migración | Descripción |
|-----------|-------------|
| `20260412010000_grooflow_normalized_tables_bootstrap.sql` | Crea `app_kv`, `transactions`, `providers`, `purchase_requests`, `invoices`, `petty_cash_transactions`, `app_users`, `roles`, `requisitions` si no existen. |
| `20260412010100_reapply_rls_after_normalized_bootstrap.sql` | Vuelve a aplicar las **mismas políticas RLS** que `20260410000200` sobre esas tablas (idempotente). |

**Aplicar en el proyecto:**

```bash
npx supabase db push
# o desde el dashboard: SQL Editor pegando las migraciones en orden
```

## Pasos siguientes (cuando toque desarrollo)

1. **Migración de datos** — Script one-shot: leer JSON desde KV (`data:transactions`, etc.) e `INSERT` en tablas. Se puede hacer desde Edge con service role o SQL Editor importando JSON.
2. **Adaptador en frontend** — En `src/app/services/repository/supabase.ts`, sustituir `KVCollectionRepository` por colecciones que usen tablas (plantilla en `BACKEND_MIGRATION.md` sección “Activar el adaptador de tabla”).
3. **Convivencia** — Opcional: dual-write (KV + SQL) una versión para validar.

## Referencias

- `BACKEND_MIGRATION.md` — DDL completo y checklist.
- `docs/DATOS_USUARIOS_Y_AUTH.md` — Usuarios Auth vs lista app.
