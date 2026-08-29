# Flujo recomendado: GitHub vs Hostinger

Producción es Hostinger, no Vercel. **Un `git push` no despliega el sitio.**

| Acción | ¿Llega a producción? |
|--------|----------------------|
| Push / PR a GitHub (`LFBarco/GrooFlow` o `oscarcalle/grooflow-backend`) | No. Sirve para revisar el código. |
| `./deploy/hostinger/deploy-ssh.sh` en el repo del panel Gestión | Sí. Solo quien tenga `deploy/hostinger/ssh.env`. |

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
