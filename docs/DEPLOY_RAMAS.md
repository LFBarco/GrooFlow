# Flujo recomendado: Pruebas y Produccion

Este proyecto queda configurado con el siguiente esquema:

- `main` -> Produccion (`https://grooflow.vercel.app`)
- `dev` -> Preview de pruebas (branch preview en Vercel)

## Como trabajar en pruebas

1. Cambiar a rama de pruebas:

```bash
git checkout dev
```

2. Guardar cambios y subirlos:

```bash
git add .
git commit -m "cambios en pruebas"
git push
```

3. Desplegar preview manual (opcional):

```bash
npm run deploy:preview
```

Tambien puedes usar:

```bash
npm run release:preview
```

Eso compila primero (`build`) y luego despliega a preview.

## Pasar a produccion

1. Asegura que `dev` esta OK.
2. Fusiona `dev` a `main`:

```bash
git checkout main
git pull
git merge dev
git push
```

3. Despliega produccion (si deseas forzar despliegue inmediato por CLI):

```bash
npm run deploy:prod
```

Tambien puedes usar:

```bash
npm run release:prod
```

## Variables de entorno ya preparadas

- Produccion: configurado
- Development: configurado
- Preview para branch `dev`: configurado

Variables usadas:

- `VITE_BACKEND=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## Indicaciones que puedes darme

- "Trabajemos en pruebas": hago cambios en `dev` y despliego preview.
- "Pasa esto a produccion": fusiono `dev` -> `main` y despliego prod.
- "Solo subir preview": despliego con `npm run deploy:preview`.
- "Despliega directo a produccion": ejecuto `npm run deploy:prod`.
