# Módulo de usuarios (GrooFlow)

## Comportamiento unificado

- **`data:users`** vive en el KV (Edge `server`) o en `localStorage` si `VITE_BACKEND=local`.
- La lista **solo** se construye en **`hydrateFromKv`** (`App.tsx`): lectura KV → deduplicado por email → roles super_admin según config → fusión con **Supabase Auth** (UUID vs `usr-…`).
- **`handleLogin`** (tras el formulario) **no** modifica `users`; solo dispara otra hidratación.
- **Alta / edición / baja** en UI: `UserManager` → `setUsers` en `App` con deduplicado por email en alta.

## Super administradores

- Por defecto: `admin@grooflow.com`, `admin@vetflow.com`, `luisfrancisco.barco@gmail.com`.
- Ampliable en **`.env`** sin tocar código:

  `VITE_SUPER_ADMIN_EMAILS=correo1@x.com,correo2@y.com`

- Ver `src/app/config/superAdmins.ts`.

## Deduplicación

- **`dedupeUsersByEmail`** (`src/app/utils/userListMerge.ts`): un correo → una fila; se prefiere id tipo UUID frente a `usr-…`.

## Producción

- Variables en **Vercel** deben incluir las mismas claves `VITE_*` que en local.
- Tras cambiar usuarios, el guardado es **`api.saveKey('data:users', users)`** cuando `canSaveUsers` es true (lectura KV de usuarios correcta).
