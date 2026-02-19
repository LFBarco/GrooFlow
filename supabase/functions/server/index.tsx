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
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const BASE_PATH = "/make-server-674cc941";

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
    return c.json({ error: error.message }, 400);
  }

  return c.json({ data });
});

// --- GENERIC KV ENDPOINTS ---

// Get data by key
app.get(`${BASE_PATH}/kv/:key`, async (c) => {
  const key = c.req.param("key");
  try {
    const value = await kv.get(key);
    return c.json({ data: value });
  } catch (error) {
    console.error(`Error fetching key ${key}:`, error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
});

// Set data by key
app.post(`${BASE_PATH}/kv/:key`, async (c) => {
  const key = c.req.param("key");
  try {
    const body = await c.req.json();
    await kv.set(key, body);
    return c.json({ success: true });
  } catch (error) {
    console.error(`Error setting key ${key}:`, error);
    return c.json({ error: "Failed to save data" }, 500);
  }
});

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