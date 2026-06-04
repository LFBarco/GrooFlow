# GooFlow — Producción

## URLs

- **App:** https://grooflow.vercel.app
- **Supabase:** project `ywizhgnmgnaksqperxai`

## Variables (Vercel / `.env`)

| Variable | Descripción |
|----------|-------------|
| `VITE_BACKEND` | `supabase` |
| `VITE_SUPABASE_URL` | URL del proyecto |
| `VITE_SUPABASE_ANON_KEY` | Clave anon |
| `VITE_PRODUCTION_SQL` | `true` (omitir o `false` para desactivar SQL dominios) |
| `VITE_TRANSACTIONS_SQL` | `true` |
| `VITE_FLEET_SQL` | `true` |
| `VITE_SUPER_ADMIN_EMAILS` | Emails extra super-admin (coma) |

## Deploy

```bash
npm run supabase:db:push
npm run supabase:deploy:server
npm run release:prod
```

## Seguridad

- **RLS por sede:** `can_access_sede(location)` en transacciones, facturas, caja chica, solicitudes.
- **Super-admin:** reset operativo y stress test solo emails en `getSuperAdminEmails()` o rol `super_admin`.
- **Auditoría:** tabla `security_audit_logs` (lectura admin; insert por actor autenticado).

## Flags de datos

- Dual-write: KV Edge + SQL.
- Borrado SQL en lotes (máx. 50 IDs por request).
- Cargas SQL paginadas (1000 filas/página).
- Cola SQL serializada por dominio (`getSqlSaveQueue`) en autosave y `persistNow`.
- Reintentos SQL en `localStorage` tras fallo de respaldo; se procesan al hidratar y al volver `online`.
- Caja chica: movimientos en `petty_cash_transactions`; cierres/dotaciones en `petty_cash_week_meta` + KV `data:pettyCashMeta` (ya no duplicados en `settings:system`). Realtime y sync entre pestañas en meta.
