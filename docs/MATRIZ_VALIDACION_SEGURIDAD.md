# Matriz de validacion - Seguridad backend (Ventana 1)

**Índice general:** `docs/VALIDACION_SEGURIDAD_COMPLETA.md` (qué está en código vs qué debes probar tú).

Usa esta matriz despues de desplegar migraciones y funciones.

## Precondiciones

- Migracion aplicada: `supabase/migrations/20260410000100_security_profiles_and_audit.sql`.
- Funciones desplegadas:
  - `admin-create-user`
  - `admin-update-password`
  - `server`
- Secrets definidos:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- (Temporal) `ADMIN_CREATE_USER_EMAILS` si aun no cerraste roles en perfiles.

## Casos de prueba

| Caso | Actor | Accion | Resultado esperado |
|---|---|---|---|
| 1 | Super admin | Crear usuario desde UI | 200 OK, usuario creado |
| 2 | Admin | Crear usuario desde UI | 200 OK, usuario creado |
| 3 | Manager/Analyst | Crear usuario desde UI | 403 |
| 4 | Super admin | Restablecer contraseña | 200 OK |
| 5 | Admin | Restablecer contraseña | 200 OK |
| 6 | Manager/Analyst | Restablecer contraseña | 403 |
| 7 | Admin | Llamar `/signup` de `server` | 200 OK |
| 8 | No admin | Llamar `/signup` de `server` | 403 |

## Verificacion de auditoria

Consulta sugerida:

```sql
select id, action, actor_user_id, target_user_id, metadata, created_at
from public.security_audit_logs
order by created_at desc
limit 50;
```

Debes ver eventos `*_success` y `*_failed` para:
- `admin_create_user_*`
- `admin_update_password_*`
- `server_signup_*`

## Verificacion de perfiles de seguridad

Consulta sugerida:

```sql
select
  p.user_id,
  au.email,
  p.role,
  p.status,
  p.all_sedes,
  p.sedes,
  p.updated_at
from public.app_user_profiles p
left join auth.users au on au.id = p.user_id
order by p.updated_at desc
limit 100;
```

Debe cumplirse:
- Tus cuentas de administración figuran como `admin` o `super_admin`.
- Cuentas bloqueadas figuran con `status = 'inactive'`.

## Criterio de salida

Ventana 1 se considera cerrada cuando:
1. Todos los casos de la matriz pasan.
2. No hay errores 5xx en funciones durante la ventana.
3. Auditoria registra acciones administrativas.
