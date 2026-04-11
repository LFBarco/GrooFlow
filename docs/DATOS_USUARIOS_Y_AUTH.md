# Usuarios en Supabase vs lista en la app

Hay **dos sitios** relacionados con “usuarios”; no son lo mismo:

## 1. Supabase Authentication (`auth.users`)

- Es quien **inicia sesión** (email/contraseña).
- Lo ves en el panel: **Authentication → Users**.
- Los crea el flujo **“Crear usuario”** del módulo (Edge Function `admin-create-user`) o el registro que tengas habilitado.

## 2. Lista de la aplicación (`data:users` en KV)

- Es un **JSON** guardado en la nube con la clave KV **`data:users`** (vía Edge Function `server`).
- Ahí están **rol de negocio**, **módulos**, **sedes**, **límites de caja chica**, etc., que usa la UI (Usuarios y Roles, permisos del menú).
- Al **crear usuario** desde el panel, la app suele **añadir la fila** en esta lista además de crear la cuenta en Auth.

### Por qué puede “no coincidir” con Auth

- Un usuario puede existir en **Auth** y aún no tener fila completa en **`data:users`** (o al revés en migraciones antiguas).
- Tras cargar el KV, la app **fusiona** la sesión actual con la lista (mismo **email** → alinear **id** con el UUID de Auth).

### Persistencia (importante)

- La lista **`data:users`** solo se guarda bien cuando hay **sesión JWT** válida y la carga inicial terminó (no se pisa la nube con listas vacías por carrera al arrancar).
- Si cambias `.env` en **Vercel**, hace falta **nuevo build** para que las variables `VITE_*` se apliquen.

---

*Ver también: `docs/DEPURAR_CONEXION_SUPABASE.md`, `docs/CHECKLIST_PRODUCCION.md`.*
