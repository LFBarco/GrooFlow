# Si la página queda en blanco después de editar `.env`

## 1. Revisa la terminal donde corre `npm run dev`

Si hay **texto rojo** o “Failed to parse”, el `.env` tiene un error de sintaxis.

## 2. Errores típicos en `.env`

| Problema | Solución |
|----------|----------|
| Clave anon partida en **dos líneas** | Debe ser **una sola** línea larga. |
| Comillas mal cerradas `"eyJ...` | Quita comillas o ciérralas al final de la línea. |
| **#** dentro del valor sin comillas | El `#` corta el valor; pon la clave entre comillas dobles `"eyJ..."` |
| Espacio antes del `=` | Usa `VITE_SUPABASE_ANON_KEY=eyJ` sin espacio alrededor del `=`. |
| Archivo guardado en **UTF-16** | Guardar como **UTF-8** en el Bloc de notas. |
| Nombre del archivo | Debe ser exactamente **`.env`** (no `env.txt` ni `.env.txt`). |

## 3. Prueba mínima

Deja solo esto (con **tu** clave anon real en una línea):

```env
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://ywizhgnmgnaksqperxai.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

(No hace falta `VITE_SUPABASE_PROJECT_ID` si ya pusiste `VITE_SUPABASE_URL`.)

## 4. Reiniciar siempre

Tras guardar `.env`:

1. **Ctrl + C** en la terminal  
2. `npm run dev`  
3. **Ctrl + Shift + R** en el navegador (recarga forzada)

## 5. Ver error en el navegador

Pulsa **F12** → pestaña **Consola**. Si aparece un error en rojo, cópialo o haz captura.
