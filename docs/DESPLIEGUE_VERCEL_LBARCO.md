# Despliegue Vercel — rama `Lbarco` (frontend) + backend PHP

Guía para trabajar en el **frontend** (rama `Lbarco`) con previews en Vercel, conectado al **backend PHP** en Hostinger.

## Arquitectura

| Capa | Dónde | URL |
|------|-------|-----|
| Frontend (React/Vite) | Vercel (preview por rama) | `https://grooflow-*.vercel.app/grooflow/` |
| Backend (PHP + MySQL) | Hostinger | `https://gestionveterinariagroomers.com/grooflow/api/` |
| Producción real | Hostinger (mismo servidor) | `https://gestionveterinariagroomers.com/grooflow` |

El frontend en Vercel y el API en Hostinger son **orígenes distintos**. Por eso en Vercel hay que usar la **URL absoluta** del API.

## 1. Rama de trabajo

```bash
git checkout Lbarco
# cambios...
git add .
git commit -m "descripción del cambio"
git push origin Lbarco
```

Cada push a `Lbarco` genera un **Preview Deployment** en Vercel (si el proyecto está conectado al repo).

URL de acceso: `https://<preview-url>/grooflow/` (con barra final).

## 2. Variables de entorno en Vercel

En [vercel.com](https://vercel.com) → proyecto **GrooFlow** → **Settings** → **Environment Variables**.

Configurar para el entorno **Preview** (y opcionalmente **Production** si usas Vercel solo para pruebas):

| Variable | Valor |
|----------|--------|
| `VITE_BACKEND` | `rest` |
| `VITE_GROOFLOW_API_URL` | `https://gestionveterinariagroomers.com/grooflow/api` |
| `VITE_PRODUCTION_SQL` | `false` |
| `VITE_TRANSACTIONS_SQL` | `false` |
| `VITE_FLEET_SQL` | `false` |
| `VITE_INVENTORY_SQL` | `false` |

Opcional (super-admins en preview):

| Variable | Valor |
|----------|--------|
| `VITE_SUPER_ADMIN_EMAILS` | correos separados por coma |

**Importante:** las variables `VITE_*` se inyectan en **build time**. Tras cambiarlas, haz **Redeploy** del preview.

### Preview solo para la rama `Lbarco`

En cada variable, en **Git Branch**, puedes limitar a `Lbarco` para no afectar otros previews.

## 3. CORS en el backend PHP (coordinar con backend)

El navegador bloqueará login y guardado si el API PHP no permite el origen de Vercel.

Pedir al desarrollador backend (`grooflow-backend`) que permita en CORS:

```text
http://localhost:5173
https://grooflow.vercel.app
https://*.vercel.app
```

O listar URLs concretas de preview, por ejemplo:

```text
https://grooflow-git-lbarco-luis-barco-projects.vercel.app
```

Sin CORS correcto verás en la consola del navegador errores tipo `blocked by CORS policy`.

## 4. Desarrollo local (frontend)

Copia `example/.env.example` a `.env` en la raíz del proyecto.

### Opción A — API remoto (Hostinger)

Útil si el backend PHP aún no corre en tu máquina:

```env
VITE_BACKEND=rest
VITE_GROOFLOW_API_URL=https://gestionveterinariagroomers.com/grooflow/api
VITE_PRODUCTION_SQL=false
VITE_TRANSACTIONS_SQL=false
VITE_FLEET_SQL=false
VITE_INVENTORY_SQL=false
```

Requiere CORS en PHP permitiendo `http://localhost:5173`.

### Opción B — PHP local (puerto 8091)

Si el backend corre en `http://127.0.0.1:8091`, Vite hace proxy automático:

```env
VITE_BACKEND=rest
VITE_GROOFLOW_API_URL=/grooflow/api
```

```bash
npm run dev
```

Abrir: `http://localhost:5173/grooflow/`

## 5. Verificar build antes de subir

```bash
$env:VITE_BACKEND="rest"
$env:VITE_GROOFLOW_API_URL="https://gestionveterinariagroomers.com/grooflow/api"
npm run build
npm run preview
```

Abrir: `http://localhost:4173/grooflow/`

## 6. Flujo con el desarrollador backend

| Quién | Repo / rama | Despliegue |
|-------|-------------|------------|
| Frontend (tú) | `LFBarco/GrooFlow` → `Lbarco` | Push → preview Vercel |
| Backend (PHP) | `grooflow-backend` | Hostinger (no automático con push) |

- Los cambios de frontend **no** despliegan Hostinger.
- Los cambios de backend **no** actualizan Vercel.
- Producción en Hostinger solo cambia con el script de deploy del panel Gestión.

## 7. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| 404 en `/grooflow/login` | Falta `vercel.json` o rewrites | Usar el `vercel.json` del repo |
| Página en blanco | URL sin `/grooflow/` | Entrar a `.../grooflow/` |
| Login falla / red bloqueada | CORS en PHP | Backend debe permitir origen Vercel |
| Datos no guardan | `VITE_BACKEND` incorrecto | Debe ser `rest`, no `supabase` |
| Cambios de env no aplican | Build cache | Redeploy sin cache en Vercel |

## 8. Producción (recordatorio)

La app real de usuarios está en Hostinger, no en Vercel. Vercel es para **previews de desarrollo**. Ver `PRODUCTION.md` y `docs/DEPLOY_RAMAS.md`.
