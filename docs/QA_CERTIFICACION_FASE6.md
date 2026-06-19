# GrooFlow — Certificación QA manual (Fase 6)

Matriz para validar **módulo × acción × sede × rol** en **https://grooflow.vercel.app**.

**Meta:** 100 % de casillas obligatorias marcadas antes de declarar go-live estable.

**Automatizado complementario:** `npm run test:e2e` (Playwright) — no sustituye esta matriz, pero cubre casos críticos (ver tabla **E2E** abajo).

**CI:** cada push a `main` ejecuta smoke E2E (login + rutas protegidas). Con secrets `E2E_EMAIL` / `E2E_PASSWORD` en GitHub, corre la suite completa.

---

## Cobertura E2E automatizada (2026-06)

| Spec | Qué valida | Matriz relacionada |
|------|------------|-------------------|
| `e2e/auth.spec.ts` | Formulario login | Login R |
| `e2e/routes.spec.ts` | Rutas protegidas sin sesión | T7 |
| `e2e/go-live-transversal.spec.ts` | T6 login/logout, T8 sync, T7 extra, T4 offline básico | Transversales |
| `e2e/transactions.spec.ts` | C/R/D + F5 | Transacciones C/R/D, T1 |
| `e2e/logout-sync.spec.ts` | Logout, persistencia tras re-login | T3 parcial, T6 |
| `e2e/petty-cash.spec.ts` | Caja chica CRUD + reset custodio | Caja chica |
| `e2e/providers.spec.ts` | Alta proveedor + F5 + búsqueda | Proveedores C/R, T1 |
| `e2e/fleet.spec.ts` | Flota | Flota |
| `e2e/inventory.spec.ts` | Inventario | Inventario |
| `e2e/asistencia.spec.ts` | Asistencia | Asistencia |
| `e2e/users.spec.ts` | Usuarios (admin) | Usuarios |

**Pendiente manual obligatorio:** T2 (dos pestañas), T5 (sesión 4 h), operador con sedes restringidas, Dashboard/Alertas/Analítica/P&L.

---

## Cómo usar

1. Preparar dos usuarios de prueba:
   - **Admin:** `allSedes` o super-admin, todos los módulos go-live.
   - **Operador:** una o dos sedes, permisos limitados (sin Usuarios/Configuración).
2. Por cada módulo go-live, ejecutar **C/R/U/D** donde aplique.
3. Tras cada guardado: **F5** y verificar persistencia.
4. Marcar ☐ → ☑ con fecha y tester.

**Módulos excluidos de go-live** (solo super-admin): Tesorería, Honorarios, Productos, Compras — probar aparte si se activan en `goLive.ts`.

---

## Escenarios transversales (obligatorios)

Ejecutar una vez por release candidato:

| ID | Escenario | E2E | Admin | Operador | Fecha | OK |
|----|-----------|:---:|:-----:|:--------:|-------|:--:|
| T1 | Recarga tras guardado (cualquier módulo editado) | Parcial (tx, prov, petty) | ☐ | ☐ | | |
| T2 | Segunda pestaña: editar en A, ver en B tras sync | — | ☐ | ☐ | | |
| T3 | Logout con cambios sin guardar → advertencia / flush | Parcial (`logout-sync`) | ☐ | ☐ | | |
| T4 | Offline ~30 s → reconexión → reintento sync | Parcial (offline básico) | ☐ | ☐ | | |
| T5 | Sesión abierta 4+ h → sin cierre inesperado | — | ☐ | ☐ | | |
| T6 | Login / logout / login | Sí (`go-live-transversal`) | ☐ | ☐ | | |
| T7 | URL directa a módulo sin permiso → redirección | Sí (`routes`, `go-live-transversal`) | ☐ | N/A | | |
| T8 | Indicador nube: guardando → guardado / error+retry | Sí (`logout-sync`, `go-live-transversal`) | ☐ | ☐ | | |

---

## Matriz por módulo (go-live)

Leyenda acciones: **C** crear · **R** leer/listar · **U** actualizar · **D** eliminar · **—** no aplica

Sedes: probar al menos **Principal** + una sede secundaria si el operador tiene acceso restringido.

### Login y sesión

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | — | Pantalla login carga |
| C | ☐ | ☐ | — | Login correcto |
| D | ☐ | ☐ | — | Logout limpia sesión |

### Dashboard

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | Todas visibles | KPIs sin error |
| R | ☐ | ☐ | Una sede | Filtrado por sede operador |

### Alertas

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | — | Lista alertas |
| U | ☐ | ☐ | — | Marcar leída / todas |

### Analítica

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | — | Gráficos cargan |

### Transacciones

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C | ☐ | ☐ | Principal | Alta manual |
| R | ☐ | ☐ | Principal | Lista y filtros |
| U | ☐ | ☐ | Principal | Editar monto/concepto |
| D | ☐ | ☐ | Principal | Eliminar / bulk |
| C | ☐ | ☐ | Otra sede | Solo si operador tiene sede |

### Flujo de caja

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | — | Grilla mensual |
| U | ☐ | ☐ | — | Celda proyección |

### Estado de resultados (P&L)

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | — | Vista período |

### Reportes

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | — | Export / vista |

### Caja chica

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C | ☐ | ☐ | Por sede | Movimiento |
| R | ☐ | ☐ | Por sede | Saldo coherente |
| U | ☐ | ☐ | Por sede | Editar movimiento |
| U | ☐ | ☐ | Por sede | Cierre semana (si aplica) |

### Proveedores

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C | ☐ | ☐ | — | Alta proveedor |
| R | ☐ | ☐ | — | Lista persiste tras F5 |
| U | ☐ | ☐ | — | Editar RUC/contacto |
| D | ☐ | — | — | Eliminar (si rol permite) |

### Contabilidad (plan de cuentas)

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C/R/U | ☐ | ☐ | — | CRUD cuenta |

### Flota clínica

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C | ☐ | ☐ | Por sede | Vehículo / inspección |
| R | ☐ | ☐ | Por sede | Lista tras F5 |
| U | ☐ | ☐ | Por sede | Editar registro |
| D | ☐ | — | Por sede | Baja lógica si existe |

### Inventario equipos

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C | ☐ | ☐ | Por sede | Equipo |
| R | ☐ | ☐ | Por sede | Persistencia KV+SQL |
| U | ☐ | ☐ | Por sede | Estado / ubicación |
| D | ☐ | — | Por sede | Eliminar |

### Asistencia

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | ☐ | Por sede | Dashboard / organigrama |
| U | ☐ | ☐ | Por sede | Config sede / staff |
| C | ☐ | — | — | Integración Buk (si configurada) |

### Auditoría

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| R | ☐ | — | — | Solo admin ve logs |

### Usuarios y roles

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| C | ☐ | — | — | Crear usuario |
| U | ☐ | — | — | Roles / sedes |
| U | ☐ | — | — | Reset password |

### Configuración

| Acción | Admin | Operador | Sede | Notas |
|--------|:-----:|:--------:|------|-------|
| U | ☐ | — | — | Sedes, logo, umbrales |
| R | ☐ | — | — | Cambios persisten tras F5 |

---

## Módulos fuera de go-live (opcional)

Solo si se quitan de `GO_LIVE_EXCLUDED_MODULES`:

| Módulo | C | R | U | D | Admin | Operador |
|--------|:-:|:-:|:-:|:-:||:-----:|:--------:|
| Tesorería | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Honorarios | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Productos | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Compras / Solicitudes | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Registro de ejecución

| Release / commit | Fecha | Tester | Transversales | Módulos | Resultado |
|----------------|-------|--------|:-------------:|:-------:|-----------|
| `22fc9e8`+ (A/B/C QA) | | | /8 | /N | GO / NO-GO |

**Criterio GO:** todos los transversales T1–T8 OK + 100 % acciones obligatorias de módulos go-live.

**Criterio NO-GO:** pérdida de datos tras F5, error sync sin recuperación, o fallo de permisos (operador accede a módulo prohibido).

---

## Enlaces

- E2E local: `e2e/*.spec.ts`
- Runbook: `docs/RUNBOOK_OPERACION.md`
- Checklist infra: `docs/CHECKLIST_PRODUCCION.md`
