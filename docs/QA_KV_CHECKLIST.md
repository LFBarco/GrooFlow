# Checklist QA — Persistencia KV (GrooFlow)

Usar en **preview** y **producción** tras cada despliegue. Abrir dos pestañas con la misma sesión para probar sync entre pestañas.

## Pre-requisitos

- [ ] Sesión iniciada con usuario válido en la lista de usuarios
- [ ] Indicador de nube visible (sidebar): *Sincronizado* tras cargar
- [ ] Red estable; no cerrar pestaña mientras dice *Guardando…*

## Por módulo

| Módulo | Acción | Esperado |
|--------|--------|----------|
| **Transacciones** | Crear una transacción con fecha local | Fecha correcta al refrescar (F5) |
| **Config operativa** | Cambiar categoría flujo de caja | Persiste tras F5 y re-login |
| **Proveedores** | Alta / edición | Lista igual en otra pestaña sin F5 |
| **Caja chica** | Movimiento nuevo | Sync en 2ª pestaña + toast opcional |
| **Flotas — vehículo** | Alta con sede predeterminada | Sede del sistema preseleccionada |
| **Flotas — mantenimiento** | Registrar con sede | Vehículos filtrados por sede |
| **Flotas — combustible** | Registrar repostaje | Sede guardada en historial |
| **Usuarios** | Editar rol o sede de usuario | Guarda; indicador no queda en error |
| **Tema** | Cambiar claro/oscuro | Persiste tras F5 |
| **Tesorería** | Editar saldo o factura | No pierde datos al refrescar |
| **Honorarios / Solicitudes / Productos** | Un cambio mínimo | Autoguardado OK |

## Sync entre pestañas

- [ ] Pestaña A: editar proveedor o transacción
- [ ] Pestaña B: cambio visible sin F5 (toast *Actualizado desde otra pestaña*)
- [ ] Pestaña B: no sobrescribe con dato viejo al guardar algo propio

## Errores de red

- [ ] Simular offline → editar → indicador *Error al guardar · [módulo]*
- [ ] Botón **Reintentar** recarga desde nube
- [ ] No borrar datos locales con lista vacía tras fallo de GET

## Flota SQL + Realtime (Fase 5 / 4)

- [ ] Tras `supabase db push`, existen tablas `fleet_*`
- [ ] Alta vehículo persiste tras F5 (SQL, no solo KV)
- [ ] Dispositivo A edita flota → dispositivo B ve cambio sin F5 (Realtime)
- [ ] Indicador nube: *Error al guardar · Flota clínica* si falla POST SQL


- Entorno: ☐ Preview ☐ Producción
- Fecha: ___________
- Responsable: ___________
