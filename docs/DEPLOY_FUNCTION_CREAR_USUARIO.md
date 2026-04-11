# Desplegar “crear usuario” (Edge Function `admin-create-user`)

La app intenta **primero** crear usuarios con esta función (API admin en el servidor). Así no dependes solo del registro público desde el navegador.

---

## 1. Requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado (`supabase --version`).
- Sesión iniciada: `supabase login`.
- Proyecto enlazado: `supabase link --project-ref TU_REF`  
  (tu ref es el de la URL: `https://TU_REF.supabase.co`).

---

## 2. Secretos (si aún no están)

En el **Dashboard** → **Edge Functions** → **Secrets**, o por CLI:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

(La *service role* está en Project Settings → API; **no** la pegues en el frontend.)

### Opcional: quién puede crear usuarios

Si quieres que **solo** algunos correos puedan crear usuarios vía función:

```bash
supabase secrets set ADMIN_CREATE_USER_EMAILS=admin@tuempresa.com,otro@tuempresa.com
```

Si **no** defines `ADMIN_CREATE_USER_EMAILS`, cualquier usuario **con sesión iniciada** podrá invocar la función (menos seguro en producción).

---

## 3. Desplegar la función

Desde la **raíz del repositorio** (carpeta donde está `supabase/`):

```bash
supabase functions deploy admin-create-user
```

La función valida la sesión con el `Authorization` que envía el cliente (igual que otras funciones protegidas).

Comprueba en Dashboard → **Edge Functions** que aparezca **admin-create-user**.

---

## 4. Probar de nuevo en la app

1. Reinicia `npm run dev` si hace falta.
2. **Usuarios** → Registrar nuevo usuario.

Si la función no está desplegada, la app **vuelve a intentar** el registro público (`signUp`). Si eso también falla, revisa `.env` y que la línea **Proyecto en uso** del diálogo coincida con tu Project URL.

---

## 5. Errores frecuentes

| Mensaje | Qué hacer |
|--------|-----------|
| `Missing SUPABASE_SERVICE_ROLE_KEY` | Configura el secreto (paso 2). |
| `No autorizado para crear usuarios` | Añade tu correo en `ADMIN_CREATE_USER_EMAILS` o quita el secreto para modo permisivo. |
| `Debes iniciar sesión` | Abre sesión antes de crear usuarios. |
