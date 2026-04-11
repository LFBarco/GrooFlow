# Vercel (ahora) y dominio propio (después)

## Ahora: solo URL `*.vercel.app`

1. **Variables de entorno en Vercel** (Project → Settings → Environment Variables), por entorno (Production / Preview):
   - `VITE_BACKEND` = `supabase`
   - `VITE_SUPABASE_URL` = `https://TU-REF.supabase.co`
   - `VITE_SUPABASE_PROJECT_ID` = ref del proyecto
   - `VITE_SUPABASE_ANON_KEY` = clave anon (pública)

2. Cada cambio en variables requiere **nuevo deploy** (o “Redeploy”).

3. **Supabase → Edge Functions → `server` → Secrets**  
   **`ALLOWED_ORIGINS`**: incluye tu app de Vercel, por ejemplo:
   ```text
   https://tu-app.vercel.app
   ```
   Sin barra final. Si usas preview branches, puedes listar varias separadas por coma:
   ```text
   https://tu-app.vercel.app,https://tu-app-git-main-xxx.vercel.app
   ```

## Cuando pases a dominio real

1. **Dominio en Vercel** — Project → Settings → Domains: añade `www.tudominio.com` o `app.tudominio.com` y sigue el asistente DNS.

2. **Actualiza `ALLOWED_ORIGINS`** en Supabase (secret de la función `server`):
   ```text
   https://tu-app.vercel.app,https://www.tudominio.com,https://tudominio.com
   ```
   (Quita la URL de Vercel cuando ya no la uses, o déjala un tiempo por si acaso.)

3. **Auth (opcional)** — En Supabase → Authentication → URL Configuration, añade **Site URL** y **Redirect URLs** con el dominio definitivo.

4. **Vuelve a probar** login, KV (guardado) y crear usuario desde la URL nueva.

---

*Relacionado: `docs/CHECKLIST_PRODUCCION.md`, `docs/DEPURAR_CONEXION_SUPABASE.md`.*
