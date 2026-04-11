# Seguridad backend - Ventana 1

Este documento deja el paso a paso para aplicar en produccion lo implementado.

## Cambios incluidos

- Tabla `public.app_user_profiles` (rol/sedes/estado por usuario).
- Tabla `public.security_audit_logs` (auditoria basica de acciones admin).
- Trigger para crear perfil por defecto cuando nace un usuario en `auth.users`.
- Funciones SQL helper:
  - `public.is_admin_user(uuid)`
  - `public.current_user_is_admin()`
- RLS en perfiles y auditoria.
- Hardening en funciones:
  - `supabase/functions/admin-create-user/index.ts`
  - `supabase/functions/admin-update-password/index.ts`
  - `supabase/functions/server/index.tsx` (`/signup`)

## Pre-checks obligatorios

1. Confirmar secrets en proyecto Supabase:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. Si aun no usan roles en metadata/perfil, definir allowlist temporal:
   - `ADMIN_CREATE_USER_EMAILS=correo1@dominio.com,correo2@dominio.com`
3. Backup previo (export de DB o snapshot segun su flujo).

## Despliegue

1. Aplicar migraciones:

```bash
supabase db push
```

Esto aplicará también el hardening RLS para tablas (si ya existen):
- `20260410000200_rls_hardening_operational_tables.sql`

2. Desplegar funciones:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-update-password
supabase functions deploy server
```

## Pruebas minimas post-deploy

1. Usuario admin/super_admin:
   - crear usuario -> 200
   - reset password -> 200
2. Usuario no admin:
   - crear usuario -> 403
   - reset password -> 403
3. Verificar auditoria:
   - revisar filas en `public.security_audit_logs`.

## Rollback rapido

Si hay bloqueo operativo:

1. Restaurar version anterior de funciones `admin-create-user`, `admin-update-password`, `server`.
2. Mantener migracion aplicada (no destructiva) y usar allowlist temporal mientras corrigen perfiles.
