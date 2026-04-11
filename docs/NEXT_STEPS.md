# GrooFlow — Próximos pasos sugeridos

> **¿No sabes programación?** → `docs/GUIA_PASO_A_PASO.md` (instalar, `npm run dev`, `npm run build`).

> **¿Qué falta para producción (Supabase)?** → **`docs/CHECKLIST_PRODUCCION.md`** (por módulos e infraestructura).

> **¿Sin saber programación?** → **`docs/INSTRUCCIONES_USUARIO_FINAL.md`** (solo Vercel + un ajuste en Supabase).

---

## Base técnica (desarrollo)
- [x] Proyecto corre localmente (`npm run dev`).
- [x] Build OK (`npm run build` → `dist/`).

## Opcional: probar sin depender de Supabase
- [ ] `VITE_BACKEND=local` en `.env` — **no hace falta** para producción.

---

## Hacia producción (resumen; detalle en CHECKLIST_PRODUCCION)

0. **Usuarios** — Auth (`auth.users`) + lista en nube (`data:users` KV): `docs/DATOS_USUARIOS_Y_AUTH.md`.
0b. **Vercel ahora, dominio después** — `docs/DESPLIEGUE_VERCEL_Y_DOMINIO.md` (`ALLOWED_ORIGINS` con ambas URLs cuando toque).
0c. **Seguridad** — Matriz + Go/No-Go: `docs/VALIDACION_SEGURIDAD_COMPLETA.md`.
0d. **SQL normalizado (mismo Supabase)** — Migraciones `20260412010000` + `20260412010100`; guía `docs/MIGRACION_KV_A_TABLAS_SQL.md`.

1. **Hosting** — Variables `VITE_*` en Vercel/Netlify/etc.; SPA configurada.
2. **Supabase** — Auth, migración de seguridad aplicada (`20260410000100_security_profiles_and_audit.sql`), Edge Functions desplegadas, `SUPABASE_SERVICE_ROLE_KEY` en secrets, `ALLOWED_ORIGINS` con tu dominio.
3. **Datos** — KV actual o migración a tablas (`BACKEND_MIGRATION.md`).
4. **Seguridad** — Ejecutar matriz y decisión de salida de ventana:
   - `docs/MATRIZ_VALIDACION_SEGURIDAD.md`
   - `docs/GO_NO_GO_VENTANA1.md`
5. **Equipo** — Probar cada módulo que usen; roles y usuario admin definidos.

---

## Referencia técnica
- `BACKEND_MIGRATION.md` — Repositorio, SQL, activar tablas.
- `supabase/migrations/` — Ej. columna `concept` en `transactions`.

---

*Última actualización: checklist de producción por módulos en `CHECKLIST_PRODUCCION.md`.*
