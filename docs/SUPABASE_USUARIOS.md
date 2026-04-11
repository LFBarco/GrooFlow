# Crear usuarios con correo (@gmail.com u otros)

Los correos **@gmail.com** son válidos. Supabase no bloquea Gmail.

---

## Error: "Failed to fetch"

Significa que el **navegador no pudo hablar con los servidores de Supabase** (red o configuración), no que el correo sea incorrecto.

### Revisa en este orden

1. **Internet** — Prueba abrir otra página web.
2. **Archivo `.env` en la raíz del proyecto** (junto a `package.json`):
   - `VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co`  
     **o**  
   - `VITE_SUPABASE_PROJECT_ID=tu-proyecto`  
   - `VITE_SUPABASE_ANON_KEY=eyJ...` (clave **anon** del panel de Supabase, pestaña API)
3. **Mismo proyecto** — El ID y la URL deben ser del **mismo** proyecto en [supabase.com](https://supabase.com/dashboard).
4. **Proyecto activo** — En el panel, que el proyecto no esté pausado (plan gratuito puede pausarse por inactividad).
5. **Firewall / antivirus** — Que no bloqueen `*.supabase.co`.
6. **Reiniciar** — Tras cambiar `.env`, para el servidor (`Ctrl+C`) y vuelve a ejecutar `npm run dev`.

---

## Ajustes en Supabase (panel web)

**Authentication → Providers → Email**

- **Enable Email provider** — Activado.
- **Confirm email** — Si está activo, el usuario recibe un correo y debe hacer clic antes de poder entrar. Para pruebas rápidas puedes desactivarlo (solo en desarrollo; en producción valorar seguridad).

**Authentication → URL configuration**

- **Site URL** — Para pruebas locales suele ser `http://localhost:5173` (o el puerto que use Vite).
- **Redirect URLs** — Puedes incluir `http://localhost:5173/**` y luego la URL real de tu web.

---

## Crear usuarios sin depender del registro público

Si sigues con errores de red en `signUp`, despliega la Edge Function **`admin-create-user`** (instrucciones en **`docs/DEPLOY_FUNCTION_CREAR_USUARIO.md`**). La app la usa automáticamente antes de intentar el registro público.

---

## Tras actualizar el código (cliente unificado)

La app usa **un solo cliente** Supabase (misma URL y clave que el repositorio). Si seguías viendo el error:

1. Guarda todos los archivos.
2. `npm run dev` de nuevo.
3. Prueba crear un usuario otra vez.

Si el mensaje cambia a otro texto, léelo: suele indicar si falta confirmar email o si el correo ya existe.
