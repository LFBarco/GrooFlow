# Flujo de Caja Veterinaria (GrooFlow)

Sistema de flujo de caja y gestión financiera para clínica veterinaria. Incluye dashboard, transacciones, tesorería, caja chica, honorarios, proveedores, solicitudes, reportes y auditoría.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

1. **Variables de entorno**  
   Copie `.env.example` a `.env` y configure:
   - `VITE_SUPABASE_PROJECT_ID` – ID del proyecto Supabase  
   - `VITE_SUPABASE_ANON_KEY` – Clave anónima pública de Supabase  
   - Opcional: `VITE_SUPABASE_FUNCTIONS_URL` – URL base de las Edge Functions si usa dominio propio  

2. **Assets**  
   Coloque en la carpeta `public/`:
   - `logo.png` – Logo de la clínica (sidebar e inicio)
   - `warm-bg.png` – Imagen de fondo de la pantalla de login  
   Ver `public/ASSETS-README.txt`.

3. **Build**
   ```bash
   npm run build
   ```
   La salida estará en `dist/`. Sirva esa carpeta con cualquier servidor estático (Nginx, Vercel, Netlify, etc.).  
   **SPA:** Configure el servidor para devolver `index.html` en todas las rutas (ej. `/transacciones`, `/reportes`) para que React Router funcione al recargar o compartir enlaces.

4. **Edge Functions (Supabase)**  
   En producción, configure la variable `ALLOWED_ORIGINS` en Supabase con los dominios permitidos (ej. `https://tu-dominio.com`). Si no se define, se permite cualquier origen (`*`).

## Stack

React 18, Vite 6, TypeScript, Tailwind CSS, Supabase (Auth + Edge Functions), persistencia local + KV en backend.
