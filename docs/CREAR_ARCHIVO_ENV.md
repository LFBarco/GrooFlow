# Crear el archivo `.env` con **tu** proyecto Supabase

## Qué pasó si veías `sklseqxhhanuzsancbgn`

Era un **proyecto de ejemplo** guardado en el código por si no existía `.env`.  
**No es tu GrooFlow.** Por eso no coincidía con `ywizhgnmgnaksqperxai`.

Ahora el código **ya no** usa ese proyecto por defecto: si falta `.env`, verás el mensaje *(no configurado…)* y en consola instrucciones.

---

## Qué hacer (tu cuenta correcta)

### 1. Ubicación del archivo

En la **misma carpeta** que `package.json` (raíz del proyecto GooFlow), crea un archivo llamado exactamente:

`.env`

(Con el **punto** al inicio. En Windows, en el Bloc de notas: Guardar como → tipo “Todos los archivos” → nombre `.env`.)

---

### ⚠️ Windows: “tengo `.env` pero dice no configurado”

Si en el Explorador ves un archivo **`.env`** pero la columna **Tipo** dice algo como **“EXAMPLE”** o **“EXAMPLE file”**, casi seguro el nombre **real** del archivo es **`.env.example`**, no **`.env`**. Windows suele **ocultar las extensiones** y te engaña.

**Solución rápida**

1. En el Explorador: pestaña **Vista** → activa **Extensiones de nombre de archivo** (o **Mostrar** → **Extensiones** en Windows 11).
2. Debes ver algo como:
   - `.env.example` ← Vite **no** usa este como `.env`
   - Necesitas un archivo que se llame solo **`.env`** (sin `.example` al final).
3. **Renombra** el que tiene tus variables:
   - Si se llama `.env.example` → cámbialo a **`.env`** (si ya existe otro `.env`, elimina el vacío o fusiona el contenido en uno solo).

**Crear `.env` desde la terminal** (en la carpeta del proyecto, donde está `package.json`):

```powershell
copy .env.example .env
```

Si ya editaste “el de example”, renómbralo bien o copia el contenido a un archivo nuevo:

```powershell
notepad .env
```

(Pega el contenido, guarda; si Notepad intenta guardar como `.env.txt`, usa **Guardar como** → **Todos los archivos** → nombre exacto `.env`.)

**Comprobar el nombre real** (PowerShell en la raíz del proyecto):

```powershell
Get-ChildItem -Force .env*
```

Debe aparecer una línea con **Name** = `.env` (no solo `.env.example`).

### 2. Contenido (sustituye solo la clave anon)

Copia y pega esto; **la clave larga** la sacas del panel de Supabase (paso 3):

```env
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://ywizhgnmgnaksqperxai.supabase.co
VITE_SUPABASE_PROJECT_ID=ywizhgnmgnaksqperxai
VITE_SUPABASE_ANON_KEY=PEGA_AQUI_LA_CLAVE_ANON_PUBLICA_COMPLETA

# Opcional: correos con rol super_admin (separados por coma). Si no pones nada, se usan los del código.
# VITE_SUPER_ADMIN_EMAILS=admin@tuempresa.com,otro@correo.com
```

### 3. Dónde copiar la clave

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto **GrooFlow**.
2. **Project Settings** (engranaje) → **API**.
3. Copia **Project URL** (debe ser `https://ywizhgnmgnaksqperxai.supabase.co`).
4. En **Project API keys**, copia la **`anon` `public`** (empieza por `eyJ`).

Pégala en `VITE_SUPABASE_ANON_KEY=` **en una sola línea**, sin espacios antes ni después.

### 4. Reiniciar la app

1. En la terminal: **Ctrl + C** (parar `npm run dev`).
2. Ejecuta otra vez: `npm run dev`.
3. Recarga el navegador (F5).

### 5. Comprobar

En **Usuarios → Registrar nuevo usuario**, la línea **“Proyecto en uso”** debe mostrar:

`https://ywizhgnmgnaksqperxai.supabase.co`

Si sigue diciendo “no configurado”, el archivo `.env` no está en la carpeta correcta o el nombre no es exacto.

---

## No subas `.env` a internet

`.env` suele estar en `.gitignore`. No lo compartas ni lo subas a GitHub con las claves reales.
