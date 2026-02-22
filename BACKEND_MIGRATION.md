# GrooFlow — Guía de Migración Backend

Este documento explica cómo migrar GrooFlow a cualquier backend nuevo sin reescribir la aplicación.

---

## Arquitectura actual

```
┌─────────────────────────────────────────────┐
│                React App                    │
│  (componentes, App.tsx, hooks)              │
│                                             │
│  importa solo de:                           │
│  src/app/services/api.ts                    │
│  src/app/services/repository/index.ts       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│         IDataRepository (interface)         │
│  src/app/services/types.ts                  │
│                                             │
│  Contiene: auth, kv, transactions,          │
│  providers, requests, invoices, pettyCash,  │
│  users, roles, requisitions                 │
└──────┬───────────────────┬──────────────────┘
       │                   │
       ▼                   ▼
┌────────────┐    ┌─────────────────┐
│  Supabase  │    │  localStorage   │  ← más backends aquí
│  Adapter   │    │  Adapter        │
└────────────┘    └─────────────────┘
```

---

## Cómo migrar a un nuevo backend (paso a paso)

### 1. Crear el adaptador

Crea el archivo `src/app/services/repository/miBackend.ts`:

```typescript
import type { IDataRepository } from '../types';

// Implementar todos los sub-repositorios aquí...

export const miBackendRepository: IDataRepository = {
  auth:         new MiAuthRepository(),
  kv:           new MiKVRepository(),
  transactions: new MiCollectionRepository('transactions'),
  providers:    new MiCollectionRepository('providers'),
  requests:     new MiCollectionRepository('requests'),
  invoices:     new MiCollectionRepository('invoices'),
  pettyCash:    new MiCollectionRepository('pettyCash'),
  users:        new MiCollectionRepository('users'),
  roles:        new MiCollectionRepository('roles'),
  requisitions: new MiCollectionRepository('requisitions'),
};
```

### 2. Registrar el adaptador

En `src/app/services/repository/index.ts`, añadir el nuevo caso:

```typescript
import { miBackendRepository } from './miBackend';

function createRepository(): IDataRepository {
  switch (env.VITE_BACKEND) {
    case 'supabase': return supabaseRepository;
    case 'local':    return localStorageRepository;
    case 'mi_backend': return miBackendRepository;  // ← nuevo
    default: return localStorageRepository;
  }
}
```

### 3. Configurar la variable de entorno

En `.env` (o en el panel de Vercel):
```
VITE_BACKEND=mi_backend
VITE_MI_API_URL=https://api.miempresa.com
```

**Listo.** Toda la aplicación ahora usa el nuevo backend sin ningún cambio en componentes.

---

## Migración a Supabase con tablas reales

Actualmente los datos se guardan como JSON en un Key-Value store (Edge Function + localStorage). Para usar tablas reales de Supabase:

### SQL — Crear las tablas

```sql
-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE transactions (
  id           TEXT PRIMARY KEY,
  amount       DECIMAL NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL,
  subcategory  TEXT,
  description  TEXT NOT NULL,
  date         TIMESTAMPTZ NOT NULL,
  provider_id  TEXT,
  location     TEXT,
  user_id      UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE providers (
  id                     TEXT PRIMARY KEY,
  ruc                    TEXT NOT NULL,
  name                   TEXT NOT NULL,
  category               TEXT NOT NULL,
  default_credit_days    INTEGER DEFAULT 0,
  email                  TEXT,
  phone                  TEXT,
  area                   TEXT,
  contact_name           TEXT,
  bank_name              TEXT,
  bank_account           TEXT,
  type                   TEXT,
  specialty              TEXT,
  total_purchased        DECIMAL DEFAULT 0,
  user_id                UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_requests (
  id                   TEXT PRIMARY KEY,
  provider_id          TEXT REFERENCES providers(id),
  provider_name        TEXT NOT NULL,
  request_date         TIMESTAMPTZ NOT NULL,
  description          TEXT NOT NULL,
  amount               DECIMAL NOT NULL,
  location             TEXT NOT NULL,
  priority             TEXT NOT NULL,
  payment_condition    TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  requester_name       TEXT NOT NULL,
  requester_initials   TEXT NOT NULL,
  approver_name        TEXT,
  approver_initials    TEXT,
  rejection_reason     TEXT,
  approval_comment     TEXT,
  user_id              UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id             TEXT PRIMARY KEY,
  file_name      TEXT NOT NULL,
  provider       TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  description    TEXT NOT NULL,
  location       TEXT NOT NULL,
  subtotal       DECIMAL NOT NULL,
  igv            DECIMAL DEFAULT 0,
  total          DECIMAL NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',
  user_id        UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE petty_cash_transactions (
  id              TEXT PRIMARY KEY,
  date            TIMESTAMPTZ NOT NULL,
  description     TEXT NOT NULL,
  amount          DECIMAL NOT NULL,
  type            TEXT NOT NULL,
  location        TEXT,
  category        TEXT NOT NULL,
  requester       TEXT NOT NULL,
  custodian_id    TEXT,
  receipt_number  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending_audit',
  week_number     TEXT,
  receipt_type    TEXT,
  doc_type        TEXT,
  doc_number      TEXT,
  provider_name   TEXT,
  area            TEXT,
  is_extra        BOOLEAN DEFAULT FALSE,
  amount_bi       DECIMAL,
  igv             DECIMAL,
  user_id         UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  initials        TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'manager',
  email           TEXT UNIQUE,
  location        TEXT,
  sedes           TEXT[],
  all_sedes       BOOLEAN DEFAULT FALSE,
  petty_cash_limit DECIMAL,
  last_login      TIMESTAMPTZ,
  status          TEXT DEFAULT 'active',
  auth_id         UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  bg_color    TEXT,
  border_color TEXT,
  is_system   BOOLEAN DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE requisitions (
  id               TEXT PRIMARY KEY,
  location         TEXT NOT NULL,
  requester_id     TEXT NOT NULL,
  requester_name   TEXT NOT NULL,
  date             TIMESTAMPTZ NOT NULL,
  due_date         TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'draft',
  priority         TEXT NOT NULL DEFAULT 'medium',
  items            JSONB NOT NULL DEFAULT '[]',
  approver_id      TEXT,
  approval_date    TIMESTAMPTZ,
  rejection_reason TEXT,
  received_date    TIMESTAMPTZ,
  received_by      TEXT,
  user_id          UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- KV table for settings, treasury state, etc.
CREATE TABLE app_kv (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) básico
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_kv                 ENABLE ROW LEVEL SECURITY;

-- Política básica: usuarios autenticados pueden leer/escribir sus datos
-- Ajustar según los roles del negocio
CREATE POLICY "authenticated_read" ON transactions     FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON transactions    FOR ALL    TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON providers        FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON providers       FOR ALL    TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON purchase_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON purchase_requests FOR ALL  TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON invoices         FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON invoices        FOR ALL    TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON petty_cash_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON petty_cash_transactions FOR ALL  TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON app_users        FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON app_users       FOR ALL    TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON roles            FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON roles           FOR ALL    TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON requisitions     FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON requisitions    FOR ALL    TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON app_kv           FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON app_kv          FOR ALL    TO authenticated USING (true);
```

### Activar el adaptador de tabla

En `src/app/services/repository/supabase.ts`, busca el bloque comentado:
```typescript
// FUTURE (Supabase tables): Replace with direct supabase.from() calls.
// class SupabaseCollectionRepository<T> ...
```

1. Descomenta esa clase.
2. Reemplaza `KVCollectionRepository` por `SupabaseCollectionRepository` en la función `buildSupabaseRepository()`:

```typescript
function buildSupabaseRepository(): IDataRepository {
  const kv = new SupabaseKVRepository();

  return {
    auth:         new SupabaseAuthRepository(),
    kv,
    transactions: new SupabaseCollectionRepository('transactions'),   // ← cambiar
    providers:    new SupabaseCollectionRepository('providers'),      // ← cambiar
    requests:     new SupabaseCollectionRepository('purchase_requests'),
    invoices:     new SupabaseCollectionRepository('invoices'),
    pettyCash:    new SupabaseCollectionRepository('petty_cash_transactions'),
    users:        new SupabaseCollectionRepository('app_users'),
    roles:        new SupabaseCollectionRepository('roles'),
    requisitions: new SupabaseCollectionRepository('requisitions'),
  };
}
```

---

## Restablecimiento de contraseñas (Admin)

Actualmente `updateUserPassword` lanza un error porque requiere una clave `service_role` de Supabase (que NUNCA debe estar en el frontend).

Para implementarlo correctamente:

### Edge Function (servidor)

```typescript
// supabase/functions/admin-update-password/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { userId, newPassword } = await req.json();
  
  // Verificar que quien llama tiene rol super_admin
  // (validar JWT del usuario autenticado)
  
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Solo en servidor
  );
  
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

### Frontend call

En `UserManager.tsx`, reemplazar el manejo actual de contraseñas:

```typescript
await repository.auth.updateUserPassword(userId, newPassword);
// Cuando esté listo el Edge Function, descomentar updateUserPassword en SupabaseAuthRepository
```

---

## Checklist de migración

- [ ] Variables de entorno configuradas en Vercel
- [ ] Tablas creadas en Supabase (SQL de arriba)
- [ ] Row Level Security policies ajustadas al negocio
- [ ] `SupabaseCollectionRepository` descomentada y activada
- [ ] Edge Function `admin-update-password` deployada
- [ ] Migración de datos: exportar localStorage actual e importar a tablas
- [ ] Pruebas de carga inicial y guardado
- [ ] Pruebas de acceso multi-usuario simultáneo

---

## Migración de datos existentes (localStorage → Supabase tables)

Script para ejecutar una sola vez desde la consola del browser:

```javascript
// Copiar y pegar en DevTools Console cuando estés logueado
const PREFIX = 'grooflow_';
const keys = ['data:transactions', 'data:providers', 'data:requests',
               'data:invoices', 'data:pettyCash', 'data:users',
               'data:roles', 'data:requisitions'];

const exportData = {};
keys.forEach(key => {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw) exportData[key] = JSON.parse(raw);
});

console.log('Export:', JSON.stringify(exportData));
// Copiar el JSON → importar con un script SQL o Edge Function
```
