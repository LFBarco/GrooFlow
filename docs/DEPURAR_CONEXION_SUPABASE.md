# Datos de usuarios (Auth vs app)

La lista de **Usuarios y Roles** vive en **`data:users`** (KV), distinta de **Authentication → Users**. Resumen: **`docs/DATOS_USUARIOS_Y_AUTH.md`**.

---

# Si sale “Sin conexión a Supabase” al crear usuarios

El texto **“S/-6k”** u otros caracteres raros suelen ser el final del mensaje cortado en pantalla. Lo importante es el fallo de **conexión**.

---

## Panel “Healthy” pero la app sigue fallando

Si en Supabase tu proyecto está **activo y Healthy**, el problema casi siempre es:

**El archivo `.env` no coincide con *ese* proyecto.**

1. En Supabase: **Project Settings** (engranaje) → **API**.
2. Copia **Project URL** (debe verse como `https://XXXX.supabase.co` — el `XXXX` es el ref de *tu* proyecto).
3. En `.env` debe ir **exactamente** esa URL y la clave **anon public** de **la misma** pantalla API.

Si no tienes `.env` o dejaste valores de ejemplo, la app puede usar un proyecto por defecto del código **distinto al tuyo** → error de conexión o 503.

**Ejemplo de formato** (sustituye por lo que ves en *tu* API):

```env
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://TU-REF-AQUI.supabase.co
VITE_SUPABASE_PROJECT_ID=TU-REF-AQUI
VITE_SUPABASE_ANON_KEY=eyJhbGci... (pega la anon completa)
```

Luego **guarda**, **Ctrl+C** en la terminal y **`npm run dev`** otra vez.

---

## 1. ¿Existe el archivo `.env`?

Debe estar en la **misma carpeta** que `package.json` (raíz del proyecto), con nombre exacto **`.env`** (con el punto al inicio).

Si no existe: copia **`.env.example`** y renómbralo a **`.env`**.

---

## 2. Rellena bien las variables (sin líneas vacías)

Abre `.env` con el Bloc de notas y revisa:

**Opción A — URL completa**

```env
VITE_SUPABASE_URL=https://TU-PROYECTO-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI... (pega la clave anon completa)
```

**Opción B — Solo ID del proyecto**

```env
VITE_SUPABASE_PROJECT_ID=tu-proyecto-ref
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI... (completa)
```

- **No dejes** `VITE_SUPABASE_URL=` solo, sin valor después del `=`.
- **No cortes** la clave `anon`: debe ser una línea larga que empiece por `eyJ`.

Dónde copiarlo: Supabase → **Project Settings** (engranaje) → **API** →  
`Project URL` y `anon` `public`.

---

## 3. Reinicia el servidor de desarrollo

Después de guardar `.env`:

1. En la terminal donde corre la app: **Ctrl + C**
2. Vuelve a ejecutar: `npm run dev`
3. Recarga la página (F5) e intenta crear el usuario otra vez.

Vite solo lee `.env` al **arrancar**.

---

## 4. Prueba rápida en el navegador

Abre una pestaña nueva y en la barra de direcciones pon (cambia por tu ref):

`https://TU-PROYECTO-REF.supabase.co`

- Si **no carga nada** o dice que no se encuentra el sitio → problema de red, DNS o proyecto borrado/pausado.
- Si carga una respuesta (aunque sea un JSON de error) → la red llega a Supabase.

---

## 5. Proyecto pausado

En el plan gratuito, un proyecto **inactivo** puede pausarse. Entra a [supabase.com/dashboard](https://supabase.com/dashboard), abre tu proyecto y, si pide **Restore**, reactívalo.

---

## 6. “Invalid JWT” al crear usuario / Edge Functions (tokens ES256)

Si ya comprobaste URL y **anon key** del mismo proyecto y **sigue** fallando con mensaje tipo **Invalid JWT** en el **gateway** (antes de que ejecute tu función), suele ser esto:

- Supabase Auth puede emitir sesiones con JWT **ES256** (moderno).
- El API Gateway de Edge Functions con **`verify_jwt = true`** a veces **rechaza** ese algoritmo y responde 401 **antes** de entrar al código Deno.

**Qué hacer en el repo (ya configurado en `supabase/config.toml`):**

- `verify_jwt = false` en las funciones `admin-create-user`, `admin-update-password` y `server`.
- La seguridad sigue: dentro de cada función se valida el usuario con `createClient(...).auth.getUser()`.

**Importante:** después de cambiar `config.toml` hay que **volver a desplegar** esas Edge Functions al proyecto (Supabase CLI), por ejemplo:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-update-password
supabase functions deploy server
```

Referencias: [issue #44530](https://github.com/supabase/supabase/issues/44530), documentación de [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth).

---

## 7. Sigue igual

Indica (sin pegar la clave secreta completa):

- Si tienes archivo `.env` sí/no
- Si la URL en `.env` empieza por `https://` y termina en `.supabase.co`
- Si el proyecto aparece **activo** en el panel de Supabase
