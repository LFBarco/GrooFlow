# Flujo recomendado: GitHub, Hostinger y Vercel

Hostinger sirve la app de usuarios y el API PHP. Vercel sirve el mismo frontend contra ese API.

| Acción | ¿Qué actualiza? |
|--------|-----------------|
| Push a `LFBarco/GrooFlow` | Vercel (preview/prod). No Hostinger. |
| Push a `oscarcalle/grooflow-backend` | Solo GitHub. El API en Hostinger no cambia. |
| `./deploy/hostinger/deploy-ssh.sh` | Hostinger (SPA + PHP). |

Este repositorio **no** incluye credenciales SSH ni el script de deploy. Quien clone solo GrooFlow no puede subir a Hostinger desde el IDE, aunque pida “despliega”.

Flujo seguro:

1. Rama o `main` → push a GitHub.
2. Revisar el diff (PR o commit).
3. Si está bien, alguien con el panel Gestión y `ssh.env` corre el deploy a propósito.

- App: https://gestionveterinariagroomers.com/grooflow
- `Lbarco` → frontend (previews Vercel); ver `docs/DESPLIEGUE_VERCEL_LBARCO.md`
- `dev` → rama histórica de pruebas; Hostinger solo cuando se pida explícitamente

## Variables de producción

- `VITE_BACKEND=rest`
- `VITE_GROOFLOW_API_URL=/grooflow/api`
- Flags SQL (`VITE_PRODUCTION_SQL`, `VITE_TRANSACTIONS_SQL`, `VITE_FLEET_SQL`, `VITE_INVENTORY_SQL`) en `false`
