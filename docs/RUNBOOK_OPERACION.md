# GrooFlow — Runbook operativo (producción)

Guía rápida para operar **https://grooflow.vercel.app** con Supabase. Complementa `docs/CHECKLIST_PRODUCCION.md`.

---

## 1. Arquitectura resumida

| Capa | Responsabilidad |
|------|-----------------|
| **Vercel** | SPA React (`dist/`), variables `VITE_*` |
| **Supabase Auth** | Login email/contraseña |
| **Edge Function `server`** | KV (`data:*`, `settings:*`) + CORS |
| **Edge Functions admin** | Crear usuario, reset password |
| **Tablas SQL** | Dominios migrados (transacciones, flota, inventario, asistencia, etc.) |
| **Cliente** | `App.tsx` orquesta estado; hooks por dominio (`useFleetPersistence`, `useInventoryPersistence`, `useAsistenciaPersistence`, `useAppDataHydration`) |

**Patrón de guardado crítico:** KV → SQL (si aplica) → actualizar UI. En logout: `flush` de cadenas KV + `flushAllSqlSaveQueues()`.

**Módulos fuera de go-live** (ocultos salvo super-admin): ver `src/app/config/goLive.ts` — Tesorería, Honorarios, Productos, Compras.

**Deuda conocida:** tabla `requisitions` existe en SQL/KV pero no hay UI dedicada; usar Solicitudes de compra (`data:requests`) o retirar en fase posterior.

---

## 2. Variables y secretos

### Vercel (frontend)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_BACKEND=supabase`

### Supabase Edge (secrets)

- `SUPABASE_SERVICE_ROLE_KEY` — solo en funciones admin
- `ALLOWED_ORIGINS` — ej. `http://localhost:5173,https://grooflow.vercel.app`

Actualizar orígenes:

```bash
npm run supabase:secrets:allowed-origins
npm run supabase:deploy:all
```

---

## 3. Despliegue

```bash
npm run build          # verificar build local
npm run test           # unitarios
npm run test:e2e       # smoke (sin credenciales: rutas/login)
git push origin main   # Vercel despliega automáticamente
```

Release manual con validaciones:

```bash
npm run release:prod
```

---

## 4. Incidentes frecuentes

### 4.1 Indicador de nube en error (rojo)

1. Revisar red del usuario y sesión (cerrar/abrir sesión).
2. Clic en **Reintentar** del indicador (`handleCloudSyncRetry`).
3. Supabase → Edge Functions → Logs de `server`.
4. Verificar `ALLOWED_ORIGINS` incluye el dominio actual.

### 4.2 Datos que «no guardan»

1. Confirmar que el indicador de sincronización llegó a **guardado** (no quedó en error).
2. Recargar la página — si persiste, revisar logs Edge y cola SQL (`sqlSaveQueue`).
3. Dominios con `persist*Now`: flota, inventario, asistencia, productos — deben mostrar toast de error si falla KV/SQL.

### 4.3 Logout con cambios pendientes

El logout hace flush de KV y SQL. Si falla, el usuario ve advertencia; **no cerrar pestaña** hasta resolver o reintentar logout.

### 4.4 Segunda pestaña / realtime

`useProductionRealtimeSync` puede aplicar datos remotos. Si hay edición simultánea, la última escritura exitosa en KV/SQL gana. Evitar editar el mismo registro en dos pestañas.

### 4.5 CORS / 403 en OPTIONS

Origen no listado en `ALLOWED_ORIGINS`. Añadir preview de Vercel si se prueba en URL temporal (`grooflow-*.vercel.app` ya contemplado en código).

---

## 5. Backup y recuperación

| Acción | Cómo |
|--------|------|
| Backup Supabase | Panel → Database → Backups (plan Pro) o export manual |
| Export KV puntual | Edge `server` GET por clave o script interno |
| Rollback deploy | Vercel → Deployments → Promote anterior |
| Rollback Edge | `supabase functions deploy` versión anterior desde git |

Tras rollback de funciones, repetir smoke: login, guardar proveedor, transacción, flota.

---

## 6. Retry SQL

Cola en cliente: `sqlSaveQueue.ts`. En error persistente:

1. Usuario recarga — hidratación reintenta desde KV.
2. Admin revisa tabla SQL vs KV en dominios duales (flota, inventario).
3. Migraciones: `docs/MIGRACION_KV_A_TABLAS_SQL.md`.

---

## 7. Usuarios y roles

- Auth Supabase ≠ lista `data:users` (roles/sedes/módulos).
- Crear usuario: módulo **Usuarios** → Edge `admin-create-user`.
- Reset password: `admin-update-password`.
- Ver `docs/DATOS_USUARIOS_Y_AUTH.md`.

---

## 8. Monitoreo mínimo

- Vercel: errores 5xx, tiempo de build
- Supabase: logs Edge, uso DB, Auth
- E2E CI: `.github/workflows/e2e.yml` (requiere secrets `E2E_EMAIL`, `E2E_PASSWORD`)

---

## 9. Contactos y escalamiento

Documentar internamente: responsable técnico, acceso Supabase/Vercel, ventana de mantenimiento.

---

## 10. Referencias

- `docs/QA_CERTIFICACION_FASE6.md` — matriz QA manual
- `docs/MATRIZ_VALIDACION_SEGURIDAD.md`
- `docs/GO_NO_GO_VENTANA1.md`
- `src/app/config/goLive.ts` — módulos en producción
