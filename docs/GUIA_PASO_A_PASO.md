# GrooFlow — Guía paso a paso (sin ser programador)

Esta guía te lleva **de uno en uno**. No hace falta saber programar: solo seguir los pasos y mirar si lo que ves coincide con lo que dice aquí.

---

## Antes de empezar (solo leer)

| Palabra | Qué es (simple) |
|--------|------------------|
| **Carpeta del proyecto** | Donde está todo GrooFlow en tu PC (por ejemplo `1.- GooFlow`). |
| **Terminal** | Ventana negra o integrada donde se escriben comandos (instrucciones al ordenador). |
| **Node.js** | Programa que debe estar instalado para que GrooFlow funcione en tu máquina. |
| **npm** | Viene con Node.js; sirve para instalar dependencias y arrancar el proyecto. |

---

# ✅ PASO 1 — Ver la aplicación en tu computadora (hoy)

**Objetivo:** Abrir GrooFlow en el navegador como cuando “entras a una página web”, pero desde tu PC.

### 1.1 ¿Tienes Node.js instalado?

1. Abre **Símbolo del sistema** o **PowerShell** en Windows (o Terminal en Mac).
2. Escribe esto y pulsa **Enter**:
   ```text
   node -v
   ```
3. **Si sale algo como** `v20.x.x` o `v18.x.x` → **bien**, salta al apartado 1.3.
4. **Si dice que no reconoce el comando** → instala Node.js:
   - Entra a: https://nodejs.org  
   - Descarga la versión **LTS** (recomendada).
   - Instálala con “Siguiente” en todo (opciones por defecto).
   - Cierra y vuelve a abrir la terminal y repite `node -v`.

### 1.2 Ir a la carpeta del proyecto

En la terminal, tienes que estar **dentro** de la carpeta donde está GrooFlow.

**Ejemplo en Windows** (ajusta la ruta si la tuya es distinta):

```text
cd "C:\Users\Usuario\Desktop\Proyecto Sistema LB\1.- GooFlow"
```

Si no estás seguro de la ruta: en el Explorador de archivos, entra a la carpeta del proyecto, haz clic en la barra de dirección, copia la ruta y úsala entre comillas después de `cd `.

### 1.3 Instalar dependencias (solo la primera vez o tras cambiar de PC)

Escribe y Enter:

```text
npm install
```

- Puede tardar **varios minutos**.
- Al final debería terminar **sin** mensajes rojos de error graves.
- Si al final ves muchas líneas pero **no** dice `ERR!` en rojo, suele estar bien.

### 1.4 Arrancar la aplicación en modo desarrollo

Escribe y Enter:

```text
npm run dev
```

**Qué deberías ver:**

- Texto parecido a: `Local: http://localhost:5173` (el número puede variar).
- La terminal **se queda “ocupada”** — **no la cierres** mientras uses la app.

### 1.5 Abrir en el navegador

1. Abre **Chrome**, **Edge** o **Firefox**.
2. En la barra de direcciones escribe: `http://localhost:5173`  
   (Si en la terminal sale otro puerto, usa ese; por ejemplo `http://localhost:5174`).

**Si ves la pantalla de GrooFlow (login o inicio)** → **Paso 1 completado.**

### 1.6 Probar tres cosas rápidas (2 minutos)

Cuando ya estés dentro:

1. **Inicio de sesión** — Si pide usuario/contraseña, usa los que tengas configurados en Supabase o los de prueba que uses.
2. **Flujo de caja** — Abre la vista de flujo de caja y mira que se vean categorías y filas.
3. **Nueva transacción** — Intenta registrar un movimiento (categoría → subcategoría → concepto si aplica).

Si **algo no carga** o sale pantalla en blanco, anota **exactamente** qué ves (o una captura) y en el siguiente mensaje te decimos qué revisar.

### 1.7 Parar el servidor

En la terminal donde corre `npm run dev`, pulsa **Ctrl + C** y confirma si pregunta.

---

# ⏳ PASO 2 — Comprobar que el proyecto “compila” (cuando termines el Paso 1)

**Objetivo:** Asegurarse de que no hay errores graves antes de subir cambios o desplegar.

*(Lo haremos juntos cuando me digas que el Paso 1 te salió bien.)*

Comando (con la terminal en la carpeta del proyecto):

```text
npm run build
```

- Si al final ves **`✓ built in …s`** → **correcto** (éxito).
- Si aparece un aviso amarillo de **chunks larger than 500 kB** → es solo una sugerencia de optimización, **no es un error**.

*(Puedes tener `npm run dev` parado o seguir en otra terminal; no hace falta desconectar internet.)*

---

# ⏳ PASO 3 — Trabajar sin internet (modo local)

*(Más adelante: copiar `.env.example` a `.env` y poner `VITE_BACKEND=local`.)*

---

# ⏳ PASO 4 en adelante — Supabase, contraseñas, base de datos

*(Los veremos **uno a uno** cuando llegue el momento; no hace falta adelantarse.)*

---

## ¿Necesitas ayuda?

Escribe en el chat:

- Qué **paso** estás haciendo (ej. “Paso 1.4”).
- Qué **comando** escribiste.
- Qué **sale en pantalla** (o copia el mensaje de error).

Con eso podemos seguir sin que tengas que entender código.
