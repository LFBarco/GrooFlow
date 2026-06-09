import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// CORS: en producción defina ALLOWED_ORIGINS (ej. "https://midominio.com,https://app.midominio.com")
const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS");
const corsOrigin = allowedOrigins ? allowedOrigins.split(",").map((o) => o.trim()) : "*";

app.use(
  "/*",
  cors({
    origin: corsOrigin,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "apikey",
      "x-client-info",
      "x-supabase-api-version",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const BASE_PATH = "/make-server-674cc941";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

function getRoleFromUser(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  const appRole = user.app_metadata?.role;
  if (typeof appRole === "string" && appRole.trim()) return appRole.trim().toLowerCase();
  const userRole = user.user_metadata?.role;
  if (typeof userRole === "string" && userRole.trim()) return userRole.trim().toLowerCase();
  return "";
}

async function callerRoleFromProfile(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data } = await adminClient
    .from("app_user_profiles")
    .select("role,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { role: "", status: "", source: "none" as const };
  return {
    role: typeof data.role === "string" ? data.role.toLowerCase() : "",
    status: typeof data.status === "string" ? data.status.toLowerCase() : "",
    source: "profile" as const,
  };
}

// Health check endpoint
app.get(`${BASE_PATH}/health`, (c) => {
  return c.json({ status: "ok" });
});

app.post(`${BASE_PATH}/signup`, async (c) => {
  const { email, password, name } = await c.req.json();
  
  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  );

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Debe iniciar sesión para crear usuarios." }, 401);
  }
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user?.id || !authData.user.email) {
    return c.json({ error: "Sesión inválida." }, 401);
  }
  const profile = await callerRoleFromProfile(supabase, authData.user.id);
  const metadataRole = getRoleFromUser(authData.user);
  const profileAdmin = ADMIN_ROLES.has(profile.role) && profile.status === "active";
  const metadataAdmin = ADMIN_ROLES.has(metadataRole);
  const isInactive = profile.source === "profile" && profile.status === "inactive";
  const callerRole = profileAdmin ? profile.role : metadataRole;
  const allowList = (Deno.env.get("ADMIN_CREATE_USER_EMAILS") || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const allowlisted = allowList.includes((authData.user.email || "").toLowerCase());
  const adminByRole = !isInactive && (profileAdmin || metadataAdmin);
  if (!adminByRole && !allowlisted) {
    return c.json({ error: "No autorizado para crear usuarios." }, 403);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    user_metadata: { name: name || email.split('@')[0] },
    // Automatically confirm the user's email since an email server hasn't been configured.
    email_confirm: true
  });

  if (error) {
    if (error.code === 'email_exists' || error.status === 422) {
      return c.json({
        error:
          'Ya existe un usuario con este email. Use la función admin-update-password para cambiar contraseñas.',
        code: 'email_exists',
      }, 409);
    }

    console.error("Signup error:", error);
    await supabase.from("security_audit_logs").insert({
      actor_user_id: authData.user.id,
      action: "server_signup_failed",
      target_user_id: null,
      metadata: {
        actorEmail: authData.user.email,
        actorRole: callerRole || null,
        reason: error.message,
        targetEmail: email,
      },
    });
    return c.json({ error: error.message }, 400);
  }

  await supabase.from("security_audit_logs").insert({
    actor_user_id: authData.user.id,
    action: "server_signup_success",
    target_user_id: data.user?.id ?? null,
    metadata: {
      actorEmail: authData.user.email,
      actorRole: callerRole || null,
      targetEmail: email,
    },
  });

  return c.json({ data });
});

// --- GENERIC KV ENDPOINTS ---
// Usar `*` en lugar de `:key`: claves como `data:users` llevan `:` y rompen el enrutado / proxy si no van codificadas.
function kvKeyFromUrl(c: { req: { url: string } }): string | null {
  const pathname = new URL(c.req.url).pathname;
  const m = pathname.match(/\/kv\/(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Supabase puede exponer el path como `/make-server-…/kv/…` o `/server/make-server-…/kv/…` según el gateway. */
const KV_PATH_BASES = [BASE_PATH, `/server${BASE_PATH}`];

async function requireAuthenticatedRequest(c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => Response }) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: c.json({ error: "Debe iniciar sesión." }, 401), user: null as null };
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) {
    return { response: c.json({ error: "Sesión inválida." }, 401), user: null as null };
  }
  return { response: null as null, user: data.user };
}

async function requireAdminRequest(c: {
  req: { header: (name: string) => string | undefined };
  json: (body: unknown, status?: number) => Response;
}) {
  const auth = await requireAuthenticatedRequest(c);
  if (auth.response) return auth;
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  const profile = await callerRoleFromProfile(adminClient, auth.user!.id);
  const metadataRole = getRoleFromUser(auth.user!);
  const profileAdmin = ADMIN_ROLES.has(profile.role) && profile.status === "active";
  const metadataAdmin = ADMIN_ROLES.has(metadataRole);
  const isInactive = profile.source === "profile" && profile.status === "inactive";
  const allowList = (Deno.env.get("ADMIN_CREATE_USER_EMAILS") || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const allowlisted = allowList.includes((auth.user!.email || "").toLowerCase());
  const adminByRole = !isInactive && (profileAdmin || metadataAdmin);
  if (!adminByRole && !allowlisted) {
    return { response: c.json({ error: "Solo administradores pueden probar la API Veterinari." }, 403), user: null as null };
  }
  return { response: null as null, user: auth.user! };
}

function countVeterinariRecords(json: unknown): string | undefined {
  if (json == null) return undefined;
  if (Array.isArray(json)) return `${json.length} registro(s) en esta página`;
  if (typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const key of ["data", "items", "results", "clientes", "records"]) {
      if (Array.isArray(o[key])) {
        return `${(o[key] as unknown[]).length} registro(s) en «${key}»`;
      }
    }
    const keys = Object.keys(o);
    if (keys.length > 0) {
      return `JSON: ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? "…" : ""}`;
    }
  }
  return undefined;
}

function isAllowedVeterinariUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host.includes("veterinari") || host.endsWith("azurewebsites.net");
  } catch {
    return false;
  }
}

for (const base of KV_PATH_BASES) {
  app.post(`${base}/veterinari/test`, async (c) => {
    const auth = await requireAdminRequest(c);
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
      let apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
      if (apiToken.toLowerCase().startsWith("bearer ")) {
        apiToken = apiToken.slice(7).trim();
      }
      if (!targetUrl || !apiToken) {
        return c.json({ error: "Faltan targetUrl o apiToken." }, 400);
      }
      if (!isAllowedVeterinariUrl(targetUrl)) {
        return c.json({ error: "URL de destino no permitida." }, 400);
      }
      const started = Date.now();
      const vetController = new AbortController();
      const vetTimeout = setTimeout(() => vetController.abort(), 28_000);
      let res: Response;
      try {
        res = await fetch(targetUrl, {
          method: "GET",
          signal: vetController.signal,
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: "application/json",
          },
        });
      } catch (fetchErr) {
        clearTimeout(vetTimeout);
        const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
        return c.json({
          ok: false,
          authMethod: "Authorization: Bearer",
          message: isAbort
            ? "Veterinari no respondió en 28 segundos (servicio longrunning). Intenta de nuevo o prueba GetClientes."
            : "No se pudo contactar Veterinari desde el servidor.",
          durationMs: Date.now() - started,
        });
      }
      clearTimeout(vetTimeout);
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const hint = countVeterinariRecords(json);
      const durationMs = Date.now() - started;
      if (res.ok) {
        return c.json({
          ok: true,
          status: res.status,
          authMethod: "Authorization: Bearer",
          message: hint
            ? `Conexión exitosa (servidor GrooFlow → Veterinari). ${hint}.`
            : `Conexión exitosa. HTTP ${res.status}.`,
          recordHint: hint,
          durationMs,
        });
      }
      const snippet = text.slice(0, 200).replace(/\s+/g, " ");
      let message = `HTTP ${res.status}: ${snippet || "sin detalle"}`;
      if (res.status === 403) {
        message +=
          " — Token rechazado o IP no autorizada. Confirma con Veterinari que el token está activo y permite tu servidor.";
      }
      return c.json({
        ok: false,
        status: res.status,
        authMethod: "Authorization: Bearer",
        message,
        durationMs,
      });
    } catch (error) {
      console.error("veterinari/test error:", error);
      return c.json({ error: "Error al contactar Veterinari desde el servidor." }, 500);
    }
  });
}

for (const base of KV_PATH_BASES) {
  app.get(`${base}/kv/*`, async (c) => {
    const auth = await requireAuthenticatedRequest(c);
    if (auth.response) return auth.response;
    const key = kvKeyFromUrl(c);
    if (key == null || key === "") {
      return c.json({ error: "Missing key" }, 400);
    }
    try {
      const value = await kv.get(key);
      return c.json({ data: value });
    } catch (error) {
      console.error(`Error fetching key ${key}:`, error);
      return c.json({ error: "Failed to fetch data" }, 500);
    }
  });

  app.post(`${base}/kv/*`, async (c) => {
    const auth = await requireAuthenticatedRequest(c);
    if (auth.response) return auth.response;
    const key = kvKeyFromUrl(c);
    if (key == null || key === "") {
      return c.json({ error: "Missing key" }, 400);
    }
    try {
      const body = await c.req.json();
      await kv.set(key, body);
      return c.json({ success: true });
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      return c.json({ error: "Failed to save data" }, 500);
    }
  });
}

// --- INITIALIZATION ENDPOINT ---
// Helps to batch load everything on startup
app.get(`${BASE_PATH}/init`, async (c) => {
  const auth = await requireAuthenticatedRequest(c);
  if (auth.response) return auth.response;
  try {
    // List of keys we care about
    const keys = [
      "data:transactions",
      "data:invoices",
      "data:providers",
      "data:requests",
      "data:users",
      "data:pettyCash",
      "data:roles",
      "settings:config",
      "settings:system"
    ];
    
    // kv_store doesn't support mget officially in the interface description 
    // but the instructions said "The kvStore provides get, set, del, mget..."
    // Let's use get for safety loop if unsure, but instruction said mget exists.
    // Let's try to map the gets.
    
    const results: Record<string, any> = {};
    
    for (const key of keys) {
      const val = await kv.get(key);
      if (val) results[key] = val;
    }
    
    return c.json({ data: results });
  } catch (error) {
     console.error("Init error:", error);
     return c.json({ error: "Failed to initialize" }, 500);
  }
});

Deno.serve(app.fetch);