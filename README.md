# Flujo de Caja Veterinaria (GrooFlow)

Sistema de flujo de caja y gestión financiera para clínica veterinaria. Incluye dashboard, transacciones, tesorería, caja chica, honorarios, proveedores, solicitudes, reportes y auditoría.

## Desarrollo

```bash
npm install
npm run dev
```

**Primera vez o sin experiencia técnica:** sigue **`docs/GUIA_PASO_A_PASO.md`** (explica cada comando en español).

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

## Backend (`VITE_BACKEND`)

| Valor       | Uso |
|------------|-----|
| `supabase` | KV vía repositorio Supabase (por defecto). |
| `local`    | Solo `localStorage`, útil sin red o para pruebas aisladas. |

La fábrica del repositorio está en `src/app/services/repository/index.ts`. Guía de nuevos backends: **`BACKEND_MIGRATION.md`**.

## Funciones útiles recientes

- **Transacciones desde almacenamiento:** `src/app/utils/hydrateTransactions.ts` normaliza fechas y campos al cargar desde KV/JSON (incluye `concept` opcional).
- **SQL `concept` en Postgres:** `supabase/migrations/20260210120000_transaction_concept.sql` (si usas tablas reales).
- **Roadmap detallado:** `docs/NEXT_STEPS.md`.

## Roles y configuración global

- **Administrador** (`admin` / `super_admin`): puede editar **Negocio**, **Contabilidad (caja chica)** y estructura de **categorías con subcategorías** en Configuración.
- El **flujo de caja** muestra filas como *Subcategoría + Concepto* cuando la categoría tiene varias subcategorías.

## Edge Function: contraseñas

- Despliega `supabase/functions/admin-update-password` y configura `SUPABASE_SERVICE_ROLE_KEY` en el dashboard de Supabase (Functions → Secrets).

## Documentación adicional

- `BACKEND_MIGRATION.md` — Arquitectura del repositorio, SQL de tablas, migración.
- `docs/NEXT_STEPS.md` — Índice de próximos pasos.
- **`docs/CHECKLIST_PRODUCCION.md`** — **Qué falta para cerrar módulos y subir a producción** (Supabase, despliegue, pruebas por área).
