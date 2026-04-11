# Instrucciones para ti (sin programación)

Ya se ejecutó desde el proyecto (cuando fue posible):

- **Base de datos:** migraciones nuevas aplicadas en tu Supabase (`db push` OK).
- **Funciones en la nube:** `admin-create-user`, `admin-update-password` y `server` **desplegadas de nuevo** (incluye mejoras de CORS en `server`).

---

## Lo único que debes hacer (2 minutos)

### 1) Guardar tu URL de Vercel en el proyecto

Abre el archivo **`docs/VERCEL_APP_URL.txt`** y sustituye la línea de ejemplo por tu dirección real, por ejemplo:

`https://tu-proyecto.vercel.app`  
(sin barra `/` al final)

### 2) Aplicar el secret en Supabase (automático)

En la carpeta del proyecto, en terminal:

```bash
npm run supabase:secrets:allowed-origins
```

Eso escribe **`ALLOWED_ORIGINS`** en Supabase con la misma URL del archivo.

### 3) (Opcional) Volver a desplegar la función `server`

```bash
npm run supabase:deploy:server
```

### Alternativa manual (si no quieres usar el comando)

1. [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **Edge Functions** → **Secrets**.
2. **`ALLOWED_ORIGINS`** = misma URL que en `docs/VERCEL_APP_URL.txt`.

### 3) Probar

Abre la app en Vercel, inicia sesión y comprueba que **guarda datos** (por ejemplo un cambio en configuración o un movimiento).

---

## Si un día cambias código de servidor o SQL

En la carpeta del proyecto, terminal en **`1.- GooFlow`**:

| Qué quieres | Comando |
|-------------|---------|
| Subir cambios de **base de datos** | `npm run supabase:db:push` |
| Subir solo la función **server** | `npm run supabase:deploy:server` |
| Subir las tres funciones | `npm run supabase:deploy:all` |

(Necesitas internet y que tu sesión de Supabase CLI siga válida; si pide login: `npx supabase login`.)

---

## Más detalle (opcional)

- Vercel + dominio propio: `docs/DESPLIEGUE_VERCEL_Y_DOMINIO.md`
- Seguridad (qué comprobar a mano): `docs/VALIDACION_SEGURIDAD_COMPLETA.md`
- Datos SQL vs KV: `docs/MIGRACION_KV_A_TABLAS_SQL.md`
