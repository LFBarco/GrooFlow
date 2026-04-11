# Go / No-Go - Ventana 1 (Seguridad backend)

**Contexto y validaciones en repo:** `docs/VALIDACION_SEGURIDAD_COMPLETA.md`

Checklist de decision para pasar a operacion normal despues del despliegue.

## Go (continuar)

Marca todos:

- [ ] Migracion `20260410000100_security_profiles_and_audit.sql` aplicada sin errores.
- [ ] `admin-create-user` desplegada y respondiendo.
- [ ] `admin-update-password` desplegada y respondiendo.
- [ ] `server` desplegada y respondiendo.
- [ ] Matriz de pruebas ejecutada: ver `docs/MATRIZ_VALIDACION_SEGURIDAD.md`.
- [ ] Casos no admin devuelven 403 (sin bypass).
- [ ] Se registran eventos en `public.security_audit_logs`.
- [ ] No hay error 5xx recurrente en logs durante la ventana.

Si todo esta marcado: **GO**.

## No-Go (detener y corregir)

Detener avance si ocurre alguno:

- Fallan operaciones de admin legitimo (crear usuario o reset password).
- Usuario no admin puede ejecutar acciones admin.
- Errores 5xx recurrentes en funciones.
- No se registra auditoria de acciones.

## Rollback corto

1. Re-deploy de version anterior de:
   - `admin-create-user`
   - `admin-update-password`
   - `server`
2. Mantener migracion aplicada (es aditiva y no destructiva).
3. Activar `ADMIN_CREATE_USER_EMAILS` temporal para continuidad operativa.
4. Repetir pruebas minimas antes de reabrir uso.
