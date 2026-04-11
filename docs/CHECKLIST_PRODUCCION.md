# GrooFlow — Checklist hacia producción (por módulos)

Esta lista sirve para **ir cerrando** lo que falta hasta dejar el sistema listo para uso real **con Supabase / nube** (no incluye modo local).

Marca cada ítem cuando lo hayas verificado en tu entorno.

---

## Cómo usar este documento

1. Recorre los bloques **de arriba hacia abajo** (infraestructura primero, luego módulos).
2. En cada módulo: prueba en la web lo que dice **“Probar en la app”**.
3. Lo marcado como **Pendiente típico** es lo que suele faltar hasta que alguien lo cierra con tu proyecto concreto.

---

## A. Infraestructura y entorno

| Estado | Ítem |
|:------:|------|
| ☐ | **Dominio y HTTPS** — La app se publicará en una URL `https://tu-dominio.com` (Vercel, Netlify, hosting propio, etc.). |
| ☐ | **Variables de entorno en el hosting** — Mismas que en desarrollo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_BACKEND=supabase`. Sin subir el archivo `.env` a internet público; se configuran en el panel del proveedor. |
| ☐ | **Build** — `npm run build` genera la carpeta `dist/` (ya lo comprobaste ✓). |
| ☐ | **SPA** — El servidor debe devolver `index.html` para rutas como `/transacciones` (evitar error 404 al recargar). Ver README. |

**Pendiente típico:** subir `dist/` o conectar el repositorio Git al proveedor para despliegue automático.

**Vercel hoy, dominio mañana:** `docs/DESPLIEGUE_VERCEL_Y_DOMINIO.md`.

---

## B. Supabase (proyecto en la nube)

| Estado | Ítem |
|:------:|------|
| ☐ | **Proyecto Supabase** creado y activo. |
| ☐ | **Authentication** — Email/contraseña (u otro método) activado como quieras para tus usuarios. |
| ☐ | **Claves** — En la app solo usa la **anon key** en el frontend; la **service role** solo en el servidor/Edge Functions. |
| ☐ | **Auth vs lista app** — Entender que **Authentication** (login) y **`data:users`** en KV (roles/sedes/módulos) se sincronizan al cargar; ver `docs/DATOS_USUARIOS_Y_AUTH.md`. |
| ☐ | **Migración de seguridad aplicada** — `supabase/migrations/20260410000100_security_profiles_and_audit.sql` (perfiles + auditoría + RLS base). |
| ☐ | **(Opcional / siguiente fase)** Tablas normalizadas + RLS re-aplicada — `20260412010000` + `20260412010100`; guía `docs/MIGRACION_KV_A_TABLAS_SQL.md`. |
| ☐ | **Edge Function `server`** (o la que use tu KV) — Desplegada y accesible si guardáis datos vía Functions + KV. |
| ☐ | **Edge Function `admin-create-user`** — Desplegada y validando rol admin/super_admin (o allowlist temporal). |
| ☐ | **Edge Function `admin-update-password`** — Desplegada; secreto `SUPABASE_SERVICE_ROLE_KEY` configurado en Supabase → Edge Functions → Secrets. |
| ☐ | **CORS / orígenes** — Variable `ALLOWED_ORIGINS` (o equivalente en tu función) con la URL **real** de producción, no solo `localhost`. |
| ☐ | **Matriz de seguridad** ejecutada — Ver `docs/MATRIZ_VALIDACION_SEGURIDAD.md`. |
| ☐ | **Decisión Go/No-Go** cerrada — Ver `docs/GO_NO_GO_VENTANA1.md`. |

**Pendiente típico:** probar “restablecer contraseña de usuario” desde **Usuarios** con un correo real.

---

## C. Datos: KV actual vs tablas SQL (decisión)

Hoy el código puede guardar casi todo en **KV** (JSON vía Edge Function). En **`BACKEND_MIGRATION.md`** está el camino para pasar a **tablas SQL** (`transactions`, `app_kv`, etc.) y políticas RLS.

| Estado | Ítem |
|:------:|------|
| ☐ | **Decisión tomada** — ¿Seguís con KV un tiempo más o migráis a tablas antes del go-live? |
| ☐ | Si **tablas** — Ejecutar SQL del doc + migración `concept` + activar adaptador en `supabase.ts` según el doc. |
| ☐ | **Respaldo** — Plan simple: export periódico o backup del proyecto Supabase según su documentación. |

---

## D. Por módulo de la aplicación

### D1. Login y sesión

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Entrar con usuario real de Supabase. | Usuarios de la app (`app_users` / lista en KV) alineados con correos de Auth. |
| Cerrar sesión y volver a entrar. | Definir quién es **super_admin** en datos reales. |

---

### D2. Dashboard y alertas

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Dashboard carga sin pantalla en blanco. | — |
| Alertas (si las usan) con umbrales razonables. | Ajustar umbrales en configuración. |

---

### D3. Transacciones

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Crear ingreso y egreso; categoría → subcategoría → concepto. | Revisar permisos de rol (**Finanzas**) para cada perfil. |
| Editar y listar en historial. | — |
| Importar Excel (si lo usan) con un archivo de prueba. | Validar formato esperado. |

---

### D4. Flujo de caja

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Vista mensual/anual; filas con subcategoría + concepto. | — |
| Proyección automática (si la usan). | Revisar días por concepto en configuración. |

---

### D5. Estado de resultados (PnL) y reportes

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Navegar y generar vista coherente con transacciones. | Mapeo PnL vs categorías del negocio. |

---

### D6. Caja chica

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Registro de movimientos y límites. | Límites en **Configuración → Contabilidad** y por usuario. |

---

### D7. Proveedores, solicitudes, requerimientos, tesorería, honorarios

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Flujo completo del módulo que usen en el día a día. | Permisos por rol (Compras, Proveedores, Finanzas…). |

---

### D8. Configuración (admin)

| Probar en la app | Pendiente típico |
|------------------|------------------|
| **Negocio** — nombre, moneda, logo (solo admin). | Logo en `public/` o subido desde la app. |
| **Categorías** — subcategorías y conceptos. | Copiar estructura final acordada con contabilidad. |
| **Contabilidad** — caja chica y fondos por usuario. | Valores revisados con administración. |

---

### D9. Usuarios y roles

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Crear/editar usuario de prueba; asignar rol. | Lista de roles final y permisos por módulo. |
| Restablecer contraseña (Edge Function). | Secreto service role y CORS (apartado B). |

---

### D10. Auditoría

| Probar en la app | Pendiente típico |
|------------------|------------------|
| Listados y filtros básicos. | Quién puede ver auditoría (rol). |

---

## E. Cierre final antes de “ya está en producción”

| Estado | Ítem |
|:------:|------|
| ☐ | **Prueba en equipo** — 1–2 usuarios reales usan el flujo completo un día. |
| ☐ | **Documento interno** — Quién contacta si falla login o Supabase. |
| ☐ | **Nombre del proyecto** en emails y pantallas revisado (GrooFlow / nombre comercial). |

---

## Resumen: qué suele quedar “abierto” hasta el final

1. **Despliegue** — URL de producción + variables en el hosting.  
2. **Supabase** — Functions + secretos + orígenes permitidos.  
3. **Roles y datos reales** — Usuarios y permisos acordes al negocio.  
4. **(Opcional)** — Pasar de KV a tablas SQL si necesitáis reportes/integraciones más fuertes.

---

*Actualizado para alinearse con `VITE_BACKEND=supabase` y checklist por módulos.*
