# Proveedores en la base (KV)

Los proveedores **no** están en una tabla relacional: se guardan como **un único JSON** en la tabla `public.app_kv`, clave:

```text
data:providers
```

## Consultar en Supabase (SQL Editor)

```sql
select key,
       jsonb_array_length(value) as cantidad,
       updated_at
from public.app_kv
where key = 'data:providers';
```

Ver el JSON completo (puede ser grande):

```sql
select key, value, updated_at
from public.app_kv
where key = 'data:providers';
```

## Si “no se guardan” en la app

1. Comprueba que exista la fila y que `cantidad` > 0 tras dar de alta en la UI.
2. Si `cantidad` es 0 pero en pantalla ves proveedores, puede haber **solo estado local**: revisa red (POST a la Edge Function) y sesión (JWT).
3. El cliente usa la Edge Function `server` → ruta KV; el proyecto debe tener desplegada la función y la tabla `app_kv` (migraciones del repo).
