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
    // Handle specific error codes gracefully without logging full stack traces
    if (error.code === 'email_exists' || error.status === 422) {
      console.log(`User ${email} exists. Attempting to update password...`);

      // Find the user to update their password (Recovery/Reset mechanism)
      const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error("List users error:", listError);
        return c.json({ error: "Error verifying user" }, 500);
      }

      const existingUser = userList.users.find(u => u.email === email);

      if (existingUser) {
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id, 
          { 
            password: password,
            email_confirm: true,
            user_metadata: { ...existingUser.user_metadata, name: name || existingUser.user_metadata.name }
          }
        );

        if (updateError) {
           console.error("Update password error:", updateError);
           return c.json({ error: "No se pudo actualizar la contraseña" }, 400);
        }

        return c.json({ data: updateData.user, message: "Password updated successfully" });
      }
      
      return c.json({ 
        error: "A user with this email address has already been registered", 
        code: "email_exists" 
      }, 400);
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

for (const base of KV_PATH_BASES) {
  app.get(`${base}/kv/*`, async (c) => {
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