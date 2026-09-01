import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { isOriginAllowed, parseAllowedOrigins } from "../_shared/corsUtils.ts";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// CORS: en producción defina ALLOWED_ORIGINS (ej. "https://grooflow.vercel.app,http://localhost:5173")
const allowedOriginsList = parseAllowedOrigins();

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (allowedOriginsList.length === 0) return origin ?? "*";
      if (!origin) return allowedOriginsList[0];
      return isOriginAllowed(origin, allowedOriginsList) ? origin : "";
    },
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

async function requireAdminRequest(
  c: {
    req: { header: (name: string) => string | undefined };
    json: (body: unknown, status?: number) => Response;
  },
  forbiddenMessage = "Solo administradores pueden realizar esta acción.",
) {
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
    return { response: c.json({ error: forbiddenMessage }, 403), user: null as null };
  }
  return { response: null as null, user: auth.user! };
}

/** Claves KV cuya escritura puede escalar privilegios o borrar identidades. */
const KV_ADMIN_WRITE_KEYS = new Set(["data:users", "data:roles"]);

function kvRequiresAdminWrite(key: string): boolean {
  return KV_ADMIN_WRITE_KEYS.has(key);
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

async function detectOutboundIp(): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const r = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) return undefined;
    const j = await r.json() as { ip?: string };
    return typeof j?.ip === "string" ? j.ip : undefined;
  } catch {
    return undefined;
  }
}

function extractVeterinariTraceId(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const traceId = (json as Record<string, unknown>).traceId;
  return typeof traceId === "string" ? traceId : undefined;
}

/** Azure «longrunning» puede tardar >28s en frío; 2 intentos con ventana amplia. */
const VETERINARI_FETCH_TIMEOUT_MS = 45_000;
const VETERINARI_FETCH_MAX_ATTEMPTS = 2;

async function fetchVeterinariWithRetry(
  targetUrl: string,
  apiToken: string,
): Promise<{ res?: Response; errorMessage?: string; attempts: number; durationMs: number }> {
  const started = Date.now();
  for (let attempt = 1; attempt <= VETERINARI_FETCH_MAX_ATTEMPTS; attempt++) {
    const vetController = new AbortController();
    const vetTimeout = setTimeout(() => vetController.abort(), VETERINARI_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(targetUrl, {
        method: "GET",
        signal: vetController.signal,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
        },
      });
      clearTimeout(vetTimeout);
      return { res, attempts: attempt, durationMs: Date.now() - started };
    } catch (fetchErr) {
      clearTimeout(vetTimeout);
      const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
      if (isAbort && attempt < VETERINARI_FETCH_MAX_ATTEMPTS) {
        continue;
      }
      const sec = VETERINARI_FETCH_TIMEOUT_MS / 1000;
      return {
        errorMessage: isAbort
          ? `Veterinari no respondió en ${sec}s tras ${attempt} intento(s). Azure «longrunning» suele despertar en el segundo intento; vuelve a probar en unos segundos.`
          : "No se pudo contactar Veterinari desde el servidor GrooFlow.",
        attempts: attempt,
        durationMs: Date.now() - started,
      };
    }
  }
  return {
    errorMessage: "No se pudo contactar Veterinari desde el servidor.",
    attempts: VETERINARI_FETCH_MAX_ATTEMPTS,
    durationMs: Date.now() - started,
  };
}

for (const base of KV_PATH_BASES) {
  app.post(`${base}/veterinari/test`, async (c) => {
    const auth = await requireAdminRequest(
      c,
      "Solo administradores pueden probar la API Veterinari.",
    );
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
      const fetchResult = await fetchVeterinariWithRetry(targetUrl, apiToken);
      if (!fetchResult.res) {
        return c.json({
          ok: false,
          authMethod: "Authorization: Bearer",
          message: fetchResult.errorMessage ?? "No se pudo contactar Veterinari.",
          durationMs: fetchResult.durationMs,
          attempts: fetchResult.attempts,
        });
      }
      const res = fetchResult.res;
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const hint = countVeterinariRecords(json);
      const durationMs = Date.now() - started;
      const retryNote =
        fetchResult.attempts > 1
          ? ` (intento ${fetchResult.attempts} — arranque en frío Azure)`
          : "";
      if (res.ok) {
        return c.json({
          ok: true,
          status: res.status,
          authMethod: "Authorization: Bearer",
          message: hint
            ? `Conexión exitosa (servidor GrooFlow → Veterinari). ${hint}.${retryNote}`
            : `Conexión exitosa. HTTP ${res.status}.${retryNote}`,
          recordHint: hint,
          durationMs,
          attempts: fetchResult.attempts,
        });
      }
      const snippet = text.slice(0, 200).replace(/\s+/g, " ");
      let message = `HTTP ${res.status}: ${snippet || "sin detalle"}`;
      const traceId = extractVeterinariTraceId(json);
      let outboundIp: string | undefined;
      if (res.status === 403) {
        outboundIp = await detectOutboundIp();
        message =
          "HTTP 403 Forbidden — Veterinari rechazó la petición desde el servidor GrooFlow (Supabase).";
        if (traceId) {
          message += ` traceId para soporte Veterinari: ${traceId}.`;
        }
        message +=
          " Lo más habitual es lista blanca de IP: la API puede funcionar en su oficina pero bloquear llamadas desde la nube.";
        if (outboundIp) {
          message += ` IP de salida detectada ahora: ${outboundIp} (Supabase no garantiza IP fija; puede cambiar).`;
        }
        message +=
          " Pide a Veterinari: (1) desactivar filtro IP para tokens API, o (2) autorizar llamadas desde servidores en la nube. Rota el token si se filtró.";
      }
      return c.json({
        ok: false,
        status: res.status,
        authMethod: "Authorization: Bearer",
        message,
        traceId,
        outboundIp,
        durationMs,
      });
    } catch (error) {
      console.error("veterinari/test error:", error);
      return c.json({ error: "Error al contactar Veterinari desde el servidor." }, 500);
    }
  });
}

function isAllowedBukUrl(targetUrl: string): boolean {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname.toLowerCase();
    return host === "app.ctrlit.cl" || host.endsWith(".ctrlit.cl");
  } catch {
    return false;
  }
}

function isAllowedBukPeUrl(targetUrl: string): boolean {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith(".buk.pe") ||
      host.endsWith(".buk.cl") ||
      host.endsWith(".buk.co") ||
      host.endsWith(".buk.com.br")
    );
  } catch {
    return false;
  }
}

const DEFAULT_BUK_PE_BASE_URL = "https://veterinariagroomers.buk.pe/api/v1/peru";

function sanitizeBukPeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_BUK_PE_BASE_URL;
  s = s.split("#")[0].split("?")[0].trim();
  s = s.replace(/\/+$/, "");
  s = s.replace(/\/employees(\/.*)?$/i, "");
  s = s.replace(/\/+$/, "");
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const path = u.pathname.replace(/\/+$/, "");
    if (!path.includes("/api/v1/")) return DEFAULT_BUK_PE_BASE_URL;
    return `${u.origin}${path}`;
  } catch {
    return DEFAULT_BUK_PE_BASE_URL;
  }
}

function normalizeBukPeToken(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/^auth_token\s*:\s*/i, "");
  if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  return t.trim();
}

function bukPeFailureMessage(status: number, targetUrl: string, text: string): string {
  if (status === 401) {
    return (
      `HTTP 401 — auth_token inválido o no guardado. Pega solo el valor del token (sin "auth_token:"). ` +
      `URL: ${targetUrl}`
    );
  }
  if (status === 403) {
    return `HTTP 403 — sin permiso en Buk.pe. URL: ${targetUrl}`;
  }
  if (text.includes("<!DOCTYPE")) {
    return `HTTP ${status} — Buk.pe devolvió HTML (ruta incorrecta). URL: ${targetUrl}`;
  }
  return `HTTP ${status}: ${text.slice(0, 200).replace(/\s+/g, " ")}`;
}

async function fetchBukPeApi(targetUrl: string, apiToken: string): Promise<Response> {
  return fetch(targetUrl, {
    method: "GET",
    headers: {
      auth_token: normalizeBukPeToken(apiToken),
      accept: "application/json",
    },
  });
}

function extractBukPeRecords(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data;
  if (Array.isArray(json)) return json;
  return [];
}

const DEFAULT_BUK_BASE_URL = "https://app.ctrlit.cl/ctrl/api/v2";

function sanitizeBukBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_BUK_BASE_URL;
  s = s.split("#")[0].split("?")[0].trim();
  s = s.replace(/\/+$/, "");
  s = s.replace(/\/asistencia-empresa\/?$/i, "");
  s = s.replace(/\/+$/, "");
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.toLowerCase();
    if (host === "app.ctrlit.cl" || host.endsWith(".ctrlit.cl")) {
      const path = u.pathname.replace(/\/+$/, "");
      if (!path || path === "/" || path === "/ctrl" || path === "/ctrl/api") {
        return DEFAULT_BUK_BASE_URL;
      }
      if (!path.includes("/api/v2")) return DEFAULT_BUK_BASE_URL;
      return `${u.origin}${path}`;
    }
    return DEFAULT_BUK_BASE_URL;
  } catch {
    return DEFAULT_BUK_BASE_URL;
  }
}

function buildBukAsistenciaTargetUrl(baseUrl: string, page: number, pageSize: number): string {
  const base = sanitizeBukBaseUrl(baseUrl);
  return `${base}/asistencia-empresa?page=${page}&page_size=${pageSize}`;
}

function bukFailureMessage(status: number, targetUrl: string, text: string): string {
  if (status === 404) {
    return (
      `HTTP 404 — la URL no existe en Buk. ` +
      `Usa solo la base: ${DEFAULT_BUK_BASE_URL} ` +
      `(sin /asistencia-empresa al final). ` +
      `URL probada: ${targetUrl}`
    );
  }
  if (status === 403) {
    return "HTTP 403 — token inválido o no enviado. Revisa el token en Buk Asistencia.";
  }
  if (text.includes("<!DOCTYPE")) {
    return `HTTP ${status} — Buk devolvió HTML (ruta incorrecta). URL probada: ${targetUrl}`;
  }
  return `HTTP ${status}: ${text.slice(0, 200).replace(/\s+/g, " ")}`;
}

async function fetchBukAsistencia(targetUrl: string, apiToken: string): Promise<Response> {
  return fetch(targetUrl, {
    method: "GET",
    headers: {
      token: apiToken,
      accept: "application/json",
    },
  });
}

for (const base of KV_PATH_BASES) {
  app.post(`${base}/buk/test`, async (c) => {
    const auth = await requireAdminRequest(c, "Solo administradores pueden probar la API Buk.");
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const baseUrlInput = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
      let targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
      let apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
      if (apiToken.toLowerCase().startsWith("bearer ")) apiToken = apiToken.slice(7).trim();
      if (!targetUrl && baseUrlInput) {
        targetUrl = buildBukAsistenciaTargetUrl(baseUrlInput, 1, 5);
      }
      if (!targetUrl || !apiToken) {
        return c.json({ error: "Faltan targetUrl o apiToken." }, 400);
      }
      if (!isAllowedBukUrl(targetUrl)) {
        return c.json({ error: "URL de destino no permitida." }, 400);
      }
      const started = Date.now();
      const res = await fetchBukAsistencia(targetUrl, apiToken);
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const hint =
        json && typeof json === "object" && json !== null && "pagination" in json
          ? `${(json as { pagination?: { count?: number } }).pagination?.count ?? 0} registro(s) de asistencia`
          : undefined;
      const durationMs = Date.now() - started;
      if (res.ok) {
        return c.json({
          ok: true,
          status: res.status,
          message: hint
            ? `Conexión exitosa (servidor GrooFlow → Buk). ${hint}.`
            : `Conexión exitosa. HTTP ${res.status}.`,
          recordHint: hint,
          durationMs,
        });
      }
      return c.json({
        ok: false,
        status: res.status,
        message: bukFailureMessage(res.status, targetUrl, text),
        durationMs,
      });
    } catch (error) {
      console.error("buk/test error:", error);
      return c.json({ error: "Error al contactar Buk Asistencia desde el servidor." }, 500);
    }
  });

  app.post(`${base}/buk/fetch`, async (c) => {
    const auth = await requireAdminRequest(c, "Solo administradores pueden consultar Buk.");
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const baseUrl = sanitizeBukBaseUrl(
        typeof body?.baseUrl === "string" ? body.baseUrl : "",
      );
      let apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
      const page = Math.max(1, Number(body?.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(body?.pageSize) || 100));
      if (apiToken.toLowerCase().startsWith("bearer ")) apiToken = apiToken.slice(7).trim();
      if (!baseUrl || !apiToken) {
        return c.json({ error: "Faltan baseUrl o apiToken." }, 400);
      }
      const targetUrl = buildBukAsistenciaTargetUrl(baseUrl, page, pageSize);
      if (!isAllowedBukUrl(targetUrl)) {
        return c.json({ error: "URL de destino no permitida." }, 400);
      }
      const res = await fetchBukAsistencia(targetUrl, apiToken);
      const text = await res.text();
      if (!res.ok) {
        return c.json({ error: bukFailureMessage(res.status, targetUrl, text) }, res.status);
      }
      let json: { data?: unknown[]; pagination?: { totalPages?: number; count?: number } } = {};
      try {
        json = JSON.parse(text);
      } catch {
        return c.json({ error: "Respuesta Buk no es JSON válido." }, 502);
      }
      return c.json({
        data: Array.isArray(json.data) ? json.data : [],
        totalPages: json.pagination?.totalPages ?? page,
        count: json.pagination?.count ?? 0,
        page,
      });
    } catch (error) {
      console.error("buk/fetch error:", error);
      return c.json({ error: "Error al obtener asistencia desde Buk." }, 500);
    }
  });

  /** Descarga todas las páginas en el servidor (una sola petición desde el navegador). */
  app.post(`${base}/buk/fetch-all`, async (c) => {
    const auth = await requireAdminRequest(c, "Solo administradores pueden consultar Buk.");
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const baseUrl = sanitizeBukBaseUrl(
        typeof body?.baseUrl === "string" ? body.baseUrl : "",
      );
      let apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
      const maxPages = Math.min(25, Math.max(1, Number(body?.maxPages) || 15));
      const pageSize = Math.min(100, Math.max(1, Number(body?.pageSize) || 100));
      if (apiToken.toLowerCase().startsWith("bearer ")) apiToken = apiToken.slice(7).trim();
      if (!baseUrl || !apiToken) {
        return c.json({ error: "Faltan baseUrl o apiToken." }, 400);
      }

      const all: unknown[] = [];
      let page = 1;
      let totalPages = 1;
      const started = Date.now();

      while (page <= totalPages && page <= maxPages) {
        const targetUrl = buildBukAsistenciaTargetUrl(baseUrl, page, pageSize);
        if (!isAllowedBukUrl(targetUrl)) {
          return c.json({ error: "URL de destino no permitida." }, 400);
        }
        const res = await fetchBukAsistencia(targetUrl, apiToken);
        const text = await res.text();
        if (!res.ok) {
          return c.json(
            {
              error: bukFailureMessage(res.status, targetUrl, text),
            },
            res.status >= 500 ? 502 : res.status,
          );
        }
        let json: { data?: unknown[]; pagination?: { totalPages?: number; count?: number } } = {};
        try {
          json = JSON.parse(text);
        } catch {
          return c.json({ error: `Respuesta Buk no es JSON válido (página ${page}).` }, 502);
        }
        if (Array.isArray(json.data)) all.push(...json.data);
        totalPages = json.pagination?.totalPages ?? page;
        page += 1;
      }

      return c.json({
        data: all,
        totalPages,
        count: all.length,
        pagesFetched: page - 1,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      console.error("buk/fetch-all error:", error);
      return c.json({ error: "Error al obtener asistencia desde Buk." }, 500);
    }
  });

  app.post(`${base}/buk/probe`, async (c) => {
    const auth = await requireAdminRequest(c, "Solo administradores pueden explorar Buk.");
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const baseUrl = sanitizeBukBaseUrl(typeof body?.baseUrl === "string" ? body.baseUrl : "");
      let apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
      const pathOrUrl =
        typeof body?.pathOrUrl === "string"
          ? body.pathOrUrl.trim()
          : typeof body?.path === "string"
            ? body.path.trim()
            : "";
      let targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
      if (apiToken.toLowerCase().startsWith("bearer ")) apiToken = apiToken.slice(7).trim();
      if (!targetUrl && pathOrUrl) {
        targetUrl = pathOrUrl.startsWith("http")
          ? pathOrUrl
          : `${baseUrl.replace(/\/+$/, "")}/${pathOrUrl.replace(/^\/+/, "")}`;
      }
      if (!targetUrl || !apiToken) {
        return c.json({ error: "Faltan pathOrUrl/targetUrl o apiToken." }, 400);
      }
      if (!isAllowedBukUrl(targetUrl)) {
        return c.json({ error: "URL de destino no permitida." }, 400);
      }
      const started = Date.now();
      const res = await fetchBukAsistencia(targetUrl, apiToken);
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        json = null;
      }
      const records =
        json && Array.isArray(json.data)
          ? (json.data as unknown[])
          : Array.isArray(json)
            ? json
            : [];
      const count =
        json && typeof json.pagination === "object" && json.pagination !== null
          ? Number((json.pagination as { count?: number }).count ?? records.length)
          : records.length;
      const durationMs = Date.now() - started;
      if (!res.ok) {
        return c.json({
          ok: false,
          status: res.status,
          message: bukFailureMessage(res.status, targetUrl, text),
          triedUrl: targetUrl,
          durationMs,
          data: [],
          sample: [],
          recordCount: 0,
        });
      }
      return c.json({
        ok: true,
        status: res.status,
        message: count > 0 ? `OK. ${count} registro(s) detectados.` : "OK. Sin arreglo de registros.",
        triedUrl: targetUrl,
        durationMs,
        data: records,
        sample: records.slice(0, 3),
        recordCount: count,
        pagination: json?.pagination ?? null,
        rawPreview: json,
      });
    } catch (error) {
      console.error("buk/probe error:", error);
      return c.json({ error: "Error al consultar endpoint Buk." }, 500);
    }
  });

  app.post(`${base}/buk-pe/test`, async (c) => {
    const auth = await requireAdminRequest(c, "Solo administradores pueden probar Buk.pe.");
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const baseUrl = sanitizeBukPeBaseUrl(typeof body?.baseUrl === "string" ? body.baseUrl : "");
      let apiToken = typeof body?.apiToken === "string" ? normalizeBukPeToken(body.apiToken) : "";
      let targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
      if (!targetUrl) {
        targetUrl = `${baseUrl.replace(/\/+$/, "")}/employees?page=1&page_size=5`;
      }
      if (!targetUrl || !apiToken) {
        return c.json({ error: "Faltan targetUrl o apiToken." }, 400);
      }
      if (!isAllowedBukPeUrl(targetUrl)) {
        return c.json({ error: "URL de destino no permitida." }, 400);
      }
      const started = Date.now();
      const res = await fetchBukPeApi(targetUrl, apiToken);
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const records = extractBukPeRecords(json);
      const durationMs = Date.now() - started;
      if (!res.ok) {
        return c.json({
          ok: false,
          status: res.status,
          message: bukPeFailureMessage(res.status, targetUrl, text),
          triedUrl: targetUrl,
          durationMs,
        });
      }
      return c.json({
        ok: true,
        status: res.status,
        message: `Conexión OK. ${records.length} empleado(s) detectados.`,
        triedUrl: targetUrl,
        durationMs,
      });
    } catch (error) {
      console.error("buk-pe/test error:", error);
      return c.json({ error: "Error al contactar Buk.pe." }, 500);
    }
  });

  app.post(`${base}/buk-pe/probe`, async (c) => {
    const auth = await requireAdminRequest(c, "Solo administradores pueden explorar Buk.pe.");
    if (auth.response) return auth.response;
    try {
      const body = await c.req.json();
      const baseUrl = sanitizeBukPeBaseUrl(typeof body?.baseUrl === "string" ? body.baseUrl : "");
      let apiToken = typeof body?.apiToken === "string" ? normalizeBukPeToken(body.apiToken) : "";
      const pathOrUrl =
        typeof body?.pathOrUrl === "string"
          ? body.pathOrUrl.trim()
          : typeof body?.path === "string"
            ? body.path.trim()
            : "";
      let targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
      if (!targetUrl && pathOrUrl) {
        targetUrl = pathOrUrl.startsWith("http")
          ? pathOrUrl
          : `${baseUrl.replace(/\/+$/, "")}/${pathOrUrl.replace(/^\/+/, "")}`;
      }
      if (!targetUrl || !apiToken) {
        return c.json({ error: "Faltan pathOrUrl/targetUrl o apiToken." }, 400);
      }
      if (!isAllowedBukPeUrl(targetUrl)) {
        return c.json({ error: "URL de destino no permitida." }, 400);
      }
      const started = Date.now();
      const res = await fetchBukPeApi(targetUrl, apiToken);
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        json = null;
      }
      const records = extractBukPeRecords(json);
      const durationMs = Date.now() - started;
      if (!res.ok) {
        return c.json({
          ok: false,
          status: res.status,
          message: bukPeFailureMessage(res.status, targetUrl, text),
          triedUrl: targetUrl,
          durationMs,
          data: [],
          sample: [],
          recordCount: 0,
        });
      }
      return c.json({
        ok: true,
        status: res.status,
        message:
          records.length > 0
            ? `OK. ${records.length} registro(s) detectados.`
            : "OK. Sin arreglo de registros.",
        triedUrl: targetUrl,
        durationMs,
        data: records,
        sample: records.slice(0, 3),
        recordCount: records.length,
        pagination: json?.pagination ?? null,
        rawPreview: json,
      });
    } catch (error) {
      console.error("buk-pe/probe error:", error);
      return c.json({ error: "Error al consultar endpoint Buk.pe." }, 500);
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
    const key = kvKeyFromUrl(c);
    if (key == null || key === "") {
      return c.json({ error: "Missing key" }, 400);
    }
    if (kvRequiresAdminWrite(key)) {
      const admin = await requireAdminRequest(
        c,
        "Solo administradores pueden modificar usuarios o roles.",
      );
      if (admin.response) return admin.response;
    } else {
      const auth = await requireAuthenticatedRequest(c);
      if (auth.response) return auth.response;
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