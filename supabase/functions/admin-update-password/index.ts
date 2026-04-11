// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getUserRole(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  const appRole = user.app_metadata?.role
  if (typeof appRole === 'string' && appRole.trim()) return appRole.trim().toLowerCase()
  const userRole = user.user_metadata?.role
  if (typeof userRole === 'string' && userRole.trim()) return userRole.trim().toLowerCase()
  return ''
}

function getEmailAllowList() {
  return Deno.env.get('ADMIN_CREATE_USER_EMAILS')
    ?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) ?? []
}

async function getCallerRoleFromProfile(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await adminClient
    .from('app_user_profiles')
    .select('role,status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { role: '', status: '', source: 'none' as const }
  if (!data) return { role: '', status: '', source: 'none' as const }
  return {
    role: typeof data.role === 'string' ? data.role.toLowerCase() : '',
    status: typeof data.status === 'string' ? data.status.toLowerCase() : '',
    source: 'profile' as const,
  }
}

async function writeAuditLog(
  adminClient: ReturnType<typeof createClient>,
  actorUserId: string,
  action: string,
  targetUserId: string | null,
  metadata: Record<string, unknown>
) {
  await adminClient.from('security_audit_logs').insert({
    actor_user_id: actorUserId,
    action,
    target_user_id: targetUserId,
    metadata,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Debes iniciar sesión para actualizar contraseñas.' })
  }

  let body: { userId?: string; email?: string; newPassword?: string }
  try {
    body = await req.json()
    if (!body.newPassword || body.newPassword.length < 6) throw new Error('newPassword required (min 6 characters)')
    if (!body.userId && !body.email) throw new Error('userId or email required')
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : 'Invalid body' })
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return json(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
  if (callerErr || !caller?.email) {
    return json(401, { error: 'Sesión inválida.' })
  }
  const { data: callerById, error: callerByIdErr } = await adminClient.auth.admin.getUserById(caller.id)
  if (callerByIdErr || !callerById?.user) {
    console.error('[admin-update-password] caller lookup failed', callerByIdErr?.message)
    return json(401, { error: 'No autorizado.' })
  }
  const profile = await getCallerRoleFromProfile(adminClient, caller.id)
  const metadataRole = getUserRole(callerById.user)
  const profileAdmin = ADMIN_ROLES.has(profile.role) && profile.status === 'active'
  const metadataAdmin = ADMIN_ROLES.has(metadataRole)
  const isInactive = profile.source === 'profile' && profile.status === 'inactive'
  const callerRole = profileAdmin ? profile.role : metadataRole
  const allowlisted = getEmailAllowList().includes(caller.email.toLowerCase())
  const adminByRole = !isInactive && (profileAdmin || metadataAdmin)
  if (!adminByRole && !allowlisted) {
    return json(403, {
      error:
        'Tu cuenta no tiene permisos administrativos. ' +
        'Verifica app_user_profiles.role=admin/super_admin o configura ADMIN_CREATE_USER_EMAILS temporalmente.',
    })
  }

  let targetUserId = body.userId
  if (!targetUserId && body.email) {
    const { data: list } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const found = list?.users?.find((u: any) => u.email?.toLowerCase() === String(body.email).toLowerCase())
    if (!found) return json(404, { error: 'Usuario no encontrado con ese correo' })
    targetUserId = found.id
  }
  if (!targetUserId) {
    return json(400, { error: 'userId or email required' })
  }

  const newPassword = body.newPassword!

  const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  })
  
  if (error) {
    console.warn('[admin-update-password] update failed', {
      actor: caller.email,
      actorRole: callerRole,
      targetUserId,
      reason: error.message,
    })
    await writeAuditLog(adminClient, caller.id, 'admin_update_password_failed', targetUserId, {
      actorEmail: caller.email,
      actorRole: callerRole || null,
      actorRoleSource: profile.source,
      reason: error.message,
    })
    return json(400, { error: error.message })
  }

  console.log('[admin-update-password] success', {
    actor: caller.email,
    actorRole: callerRole,
    targetUserId,
  })
  await writeAuditLog(adminClient, caller.id, 'admin_update_password_success', targetUserId, {
    actorEmail: caller.email,
    actorRole: callerRole || null,
    actorRoleSource: profile.source,
  })
  return json(200, { ok: true })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/admin-update-password' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
