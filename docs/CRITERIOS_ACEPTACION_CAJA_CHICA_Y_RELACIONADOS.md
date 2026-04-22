# Criterios de aceptación — Caja chica, sedes, consolidado, rendición, proveedores

Documento para **pruebas de aceptación (UAT)** y cierre de alcance. Cada ítem debe poder marcarse **Cumple / No cumple** con evidencia (captura, pasos, fecha).

---

## 1. Consulta RUC → razón social (gasto caja chica)

### CA-1.1 — Disparo de consulta
- **Dado** un formulario de registro de gasto en caja chica con campo RUC  
- **Cuando** el usuario ingresa un RUC de **11 dígitos** y sale del campo (blur) o confirma (botón “Consultar”, si existe)  
- **Entonces** el sistema solicita la razón social al servicio configurado y muestra **estado de carga** visible (spinner o texto “Consultando…”).

### CA-1.2 — Éxito
- **Cuando** el servicio responde con datos válidos  
- **Entonces** el campo **Razón social / nombre de empresa** se rellena automáticamente y el usuario puede **editarlo** antes de guardar.

### CA-1.3 — Fallo o sin datos
- **Cuando** el servicio falla, devuelve error o no encuentra el RUC  
- **Entonces** se muestra un **mensaje claro** (no técnico) y el usuario puede **completar la razón social a mano** y guardar el gasto.

### CA-1.4 — Seguridad y límites
- La consulta **no expone** API keys en el navegador (p. ej. vía Edge Function o backend).  
- Reintentos o mensajes ante **rate limit** no bloquean el guardado manual (CA-1.3).

### CA-1.5 — Validación de formato
- RUC con longitud o formato inválido → **no** se llama al servicio (o se rechaza con mensaje) hasta corregir.

---

## 2. Usuario y sedes (solo sedes asignadas en configuración)

### CA-2.1 — Fuente de sedes
- **Dado** un usuario con sedes explícitas en su ficha (no “todas las sedes”)  
- **Entonces** en **caja chica** (registro, listados, filtros, totales visibles) solo aparecen sedes que estén **asignadas a ese usuario** y que existan en el **catálogo de sedes** habilitado (si aplica regla de catálogo).

### CA-2.2 — Todas las sedes
- **Dado** un usuario marcado con acceso a **todas las sedes**  
- **Entonces** puede ver y operar en **todas** las sedes del catálogo habilitado (o la regla de negocio acordada).

### CA-2.3 — Coherencia
- La sede por defecto al abrir caja chica es **una de las permitidas**; no se puede forzar por URL una sede no autorizada (si hay rutas o query, deben validarse).

### CA-2.4 — Sin sedes asignadas
- Usuario sin sedes válidas → mensaje claro y **sin** permitir registrar gastos hasta que un administrador corrija la configuración (o flujo acordado).

---

## 3. Consolidado — filtro y acceso

### CA-3.1 — Filtro de sedes en consolidado
- **Dado** un usuario con acceso a un subconjunto de sedes  
- **Entonces** el filtro de sedes del consolidado **solo** lista esas sedes (no todas las del sistema).

### CA-3.2 — Visibilidad del módulo/vista consolidado
- **Dado** un usuario **sin** acceso a todas las sedes  
- **Entonces** **no** tiene entrada de menú a “Consolidado” **o** al entrar ve un mensaje de no autorizado y **no** se cargan datos agregados multi-sede sensibles.

### CA-3.3 — Usuario con todas las sedes
- **Dado** un usuario con acceso a **todas** las sedes  
- **Entonces** puede acceder al consolidado, cargar información y usar el filtro conforme a CA-3.1 (en su caso, todas las sedes disponibles).

### CA-3.4 — Datos no filtrados por error
- Ninguna petición ni cálculo del consolidado devuelve montos de sedes **fuera** del alcance del usuario (revisión con usuario de prueba limitado a 1–2 sedes).

---

## 4. Impresión de rendición — configuración super administrador

### CA-4.1 — Quién configura
- Solo rol **super administrador** (o el definido en el proyecto) puede **abrir y guardar** la configuración del formato de rendición.

### CA-4.2 — Qué se configura (mínimo acordado)
- Al menos: **textos** (encabezado/pie), **mostrar u ocultar** bloques acordados (ej. totales, firmas, columnas), **logo o nombre de clínica** si aplica.  
- (Opcional avanzado: márgenes, tamaño de fuente — solo si está en alcance.)

### CA-4.3 — Previsualización o impresión
- **Cuando** un usuario autorizado imprime/genera la rendición  
- **Entonces** el documento refleja la **plantilla activa** guardada por el super admin.

### CA-4.4 — Valores por defecto
- Sin configuración previa, existe una **plantilla por defecto** razonable y la impresión no falla.

### CA-4.5 — Auditoría
- Cambios en plantilla quedan **registrados** (log, fecha, usuario) **si** el producto ya usa auditoría para configuración; si no, dejar explícito “fuera de alcance v1”.

---

## 5. Proveedores — registro simplificado para caja chica (sin romper el formulario actual)

### CA-5.1 — Formulario completo intacto
- El flujo y campos del **alta/edición de proveedor estándar** siguen **iguales** (misma pantalla, misma validación) salvo la **adición explícita** del nuevo botón o acción.

### CA-5.2 — Entrada al formulario simple
- Existe una acción visible del tipo **“Proveedor para caja chica”** / **“Registro simplificado”** que abre un **formulario o modal** aparte.

### CA-5.3 — Campos del simplificado
El formulario simplificado incluye como mínimo: **RUC**, **Razón social**, **Tipo de proveedor**, **Categoría**, **Área**, **Cuenta contable** (etiquetas alineadas al negocio actual).

### CA-5.4 — Integración con lista de proveedores
- Al guardar, el proveedor **aparece en el módulo Proveedores** con el mismo modelo de datos (misma tabla/colección) y puede usarse **desde caja chica** al elegir proveedor.

### CA-5.5 — RUC en simplificado
- Misma regla de consulta RUC que CA-1 (autocompletar razón social) **si** está implementada en caja chica; coherente en proveedor simplificado.

### CA-5.6 — Unicidad y duplicados
- Si el RUC ya existe, el sistema **avisa** y ofrece **enlazar** al existente o impedir duplicado según regla acordada (documentar la regla elegida).

### CA-5.7 — Post-creación
- Tras crear desde el simplificado, el usuario puede **volver a caja chica** con el proveedor **ya seleccionable** (o redirección opcional según alcance).

---

## 6. Regresión transversal (obligatorio antes de cerrar)

| ID | Criterio |
|----|----------|
| CA-6.1 | Build y despliegue sin errores de consola críticos en flujos tocados. |
| CA-6.2 | Usuario admin y usuario limitado a sedes: ambos pasan checklist CA-2 y CA-3. |
| CA-6.3 | Guardado KV/API de datos de caja chica y proveedores sin errores 4xx/5xx en red (entorno de prueba). |

---

## Firma UAT (opcional)

| Rol | Nombre | Fecha | CA revisados |
|-----|--------|-------|----------------|
| Producto / negocio | | | |
| QA / técnico | | | |

---

*Relacionado: `docs/NEXT_STEPS.md`, `docs/MODULO_USUARIOS.md`, `docs/DATOS_USUARIOS_Y_AUTH.md`.*
