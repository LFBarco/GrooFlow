# GrooFlow — Producción

La app de usuarios vive en Hostinger (PHP + MySQL). El mismo frontend también se despliega en **Vercel** contra el mismo API.

## URLs

- **App (Hostinger):** https://gestionveterinariagroomers.com/grooflow
- **App (Vercel):** `https://<proyecto>.vercel.app/grooflow/`
- **API:** https://gestionveterinariagroomers.com/grooflow/api/

## Variables de build (Hostinger)

| Variable | Valor |
|----------|--------|
| `VITE_BACKEND` | `rest` |
| `VITE_GROOFLOW_API_URL` | `/grooflow/api` |
| `VITE_PRODUCTION_SQL` | `false` |
| `VITE_TRANSACTIONS_SQL` | `false` |
| `VITE_FLEET_SQL` | `false` |
| `VITE_INVENTORY_SQL` | `false` |

El script `deploy/hostinger/build-ftp-package.sh` (repo panel Gestión) ya inyecta esas variables al compilar GrooFlow.

## Deploy

Un **push a GitHub no despliega Hostinger**. Primero se revisa el código; el sitio solo cambia cuando alguien con el panel Gestión y `deploy/hostinger/ssh.env` (archivo local, no está en git) ejecuta:

```bash
./deploy/hostinger/deploy-ssh.sh
```

Clonar solo `GrooFlow` o `grooflow-backend` no da acceso SSH al hosting.

Sesión, KV y colecciones van a `grooflow-backend/` (PHP). El adaptador Supabase queda en el código por si un build futuro usa `VITE_BACKEND=supabase`; no se usa en Hostinger.

## Seguridad

- Auth unificada con `app_usuarios` de Gestión.
- Super-admin: reset operativo y stress test según rol `super_admin` / nivel administrador.
- Auditoría: persistida en el backend REST.

## Go-live por fases

Módulos ocultos para usuarios normales (super-admin sigue viéndolos): Tesorería, Honorarios, Productos, Compras.
Configuración en `src/app/config/goLive.ts`. Al activar un módulo, quítalo de `GO_LIVE_EXCLUDED_MODULES` y redespliega.
