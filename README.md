# Flujo de Caja Veterinaria (GrooFlow)

Sistema de flujo de caja y gestión financiera para clínica veterinaria. Incluye dashboard, transacciones, tesorería, caja chica, honorarios, proveedores, solicitudes, reportes y auditoría.

## Desarrollo

```bash
npm install
npm run dev
```

**Primera vez o sin experiencia técnica:** sigue **`docs/GUIA_PASO_A_PASO.md`** (explica cada comando en español).

## Producción

Producción es **Hostinger**, no Vercel:

- App: https://gestionveterinariagroomers.com/grooflow
- API: https://gestionveterinariagroomers.com/grooflow/api/
- Deploy: `./deploy/hostinger/deploy-ssh.sh` en el repo del panel Gestión (`VITE_BACKEND=rest`).

Para un build local de la SPA:

```
VITE_BACKEND=rest VITE_GROOFLOW_API_URL=/grooflow/api npm run build
```

La salida está en `dist/`. El hosting debe devolver `index.html` en rutas de la SPA (ya lo hace `/grooflow` en Hostinger).

El logo de marca va en `public/logo.png`. Un logo de clínica opcional se puede subir en Configuración (`businessLogo`).

## Stack

React 18, Vite 6, TypeScript, Tailwind CSS. Persistencia en Hostinger: PHP (`grooflow-backend`) + MySQL. El adaptador Supabase permanece en el código para builds `VITE_BACKEND=supabase`.

## Backend (`VITE_BACKEND`)

| Valor       | Uso |
|------------|-----|
| `rest`     | PHP/MySQL en Hostinger (default / producción). |
| `local`    | Solo `localStorage`, útil sin red o para pruebas aisladas. |
| `supabase` | KV vía repositorio Supabase (legacy / Vercel). |

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
