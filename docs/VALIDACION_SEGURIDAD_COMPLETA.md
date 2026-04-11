# Validación de seguridad — referencia única

Este documento agrupa **validación en repositorio** (lo que ya está preparado en código/config) y **pruebas manuales** que solo puedes cerrar tú en Supabase + la app.

---

## 1. Estado verificado en el repositorio (no sustituye pruebas manuales)

| Área | Evidencia / configuración |
|------|---------------------------|
| Edge `admin-create-user` | Validación de admin + auditoría (`security_audit_logs`). |
| Edge `admin-update-password` | Igual. |
| Edge `server` | `/signup` endurecido; KV GET/POST; CORS con `ALLOWED_ORIGINS`; cabeceras `apikey` permitidas en CORS. |
| Gateway JWT ES256 | `supabase/config.toml`: `verify_jwt = false` en funciones que validan JWT en código. |
| App — carga KV | No guarda con sesión vacía; fusión Auth ↔ `data:users` (`App.tsx`). |
| Migraciones SQL | Perfiles, auditoría, RLS (`20260410000100`, `20260410000200`); tablas normalizadas (`20260412010000`, `20260412010100`). **Aplicar en remoto:** `npm run supabase:db:push` (ya ejecutado en el entorno de desarrollo del repo cuando fue posible). |
| Despliegue Edge | **Desplegar funciones:** `npm run supabase:deploy:all` (última vez desde el mismo entorno: OK). |

**Tú debes comprobar:** que el **secret `ALLOWED_ORIGINS`** en Supabase incluye la URL **exacta** de tu app (Vercel o dominio). Ver `docs/INSTRUCCIONES_USUARIO_FINAL.md`.

---

## 2. Pruebas manuales obligatorias (matriz)

Sigue la tabla y marca casos en:

**`docs/MATRIZ_VALIDACION_SEGURIDAD.md`**

Incluye: crear usuario / restablecer contraseña como admin y como no admin (403), auditoría en SQL.

---

## 3. Decisión Go / No-Go

Usa **`docs/GO_NO_GO_VENTANA1.md`**: marca cada casilla cuando lo hayas comprobado en **tu** proyecto (panel Supabase + app en Vercel).

---

## 4. SQL de verificación rápida

**Auditoría:**

```sql
select id, action, actor_user_id, target_user_id, created_at
from public.security_audit_logs
order by created_at desc
limit 30;
```

**Perfiles:**

```sql
select p.user_id, au.email, p.role, p.status
from public.app_user_profiles p
left join auth.users au on au.id = p.user_id
order by p.updated_at desc
limit 50;
```

---

## 5. Checklist producción

`docs/CHECKLIST_PRODUCCION.md` — infraestructura, Supabase, datos, módulos.

---

*Última revisión: alineado con migraciones y Edge Functions del repo.*
