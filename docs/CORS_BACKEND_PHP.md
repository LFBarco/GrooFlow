# CORS — backend PHP para Vercel y desarrollo local

Documento para el **desarrollador backend** (`grooflow-backend` en Hostinger).

## Por qué hace falta

El frontend en Vercel se sirve desde `https://*.vercel.app`. El API PHP está en `https://gestionveterinariagroomers.com`. Son orígenes distintos: el navegador exige cabeceras CORS en las respuestas del API.

Sin CORS, el frontend muestra errores en consola y no puede hacer login ni guardar datos.

## Orígenes a permitir

Mínimo recomendado:

```text
http://localhost:5173
http://127.0.0.1:5173
https://gestionveterinariagroomers.com
https://grooflow.vercel.app
```

Para previews de cualquier rama en Vercel (recomendado en desarrollo):

```text
https://*.vercel.app
```

Si el servidor no admite wildcard, listar URLs concretas cuando se creen previews, por ejemplo:

```text
https://grooflow-git-lbarco-luis-barco-projects.vercel.app
```

## Cabeceras esperadas

En respuestas del API (incluido `OPTIONS` preflight):

```http
Access-Control-Allow-Origin: <origen-del-request>
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept
Access-Control-Allow-Credentials: true
```

Si se usa lista fija de orígenes, reflejar solo el origen de la petición cuando esté en la lista (no usar `*` con credenciales).

## Endpoints afectados

Todos los que consume el adaptador REST del frontend:

- `/auth/login`, `/auth/me`, `/auth/logout`, etc.
- `/bootstrap`, `/kv/*`, `/collections/*`, `/audit`
- `/proxy` (integraciones Buk / Veterinari)

## Cómo probar

1. Desde `http://localhost:5173/grooflow/` con `VITE_GROOFLOW_API_URL` apuntando al API.
2. Desde una URL de preview Vercel (`/grooflow/`).
3. En DevTools → Network: la petición `OPTIONS` y la siguiente `POST`/`GET` deben devolver 200 con cabeceras CORS correctas.
