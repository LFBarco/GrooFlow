/**
 * Crea usuario en Auth con la API admin (service role).
 * Evita depender de signUp público desde el navegador (CORS/red/signups deshabilitados).
 *
 * Secrets: SUPABASE_SERVICE_ROLE_KEY (ya usada en admin-update-password)
 * Opcional: ADMIN_CREATE_USER_EMAILS=correo1@x.com,correo2@x.com (solo esos correos pueden invocar)
 */
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
    return json(401, { error: 'Debes iniciar sesión para crear usuarios.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return json(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
  if (callerErr || !caller?.email) {
    return json(401, { error: 'Sesión inválida.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: callerById, error: callerByIdErr } = await adminClient.auth.admin.getUserById(caller.id)
  if (callerByIdErr || !callerById?.user) {
    console.error('[admin-create-user] caller lookup failed', callerByIdErr?.message)
    return json(401, { error: 'No autorizado.' })
  }

  const allowList = Deno.env.get('ADMIN_CREATE_USER_EMAILS')
    ?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const allowlisted = !!allowList?.includes(caller.email.toLowerCase())
  const profile = await getCallerRoleFromProfile(adminClient, caller.id)
  const metadataRole = getUserRole(callerById.user)
  const profileAdmin = ADMIN_ROLES.has(profile.role) && profile.status === 'active'
  const metadataAdmin = ADMIN_ROLES.has(metadataRole)
  const isInactive = profile.source === 'profile' && profile.status === 'inactive'
  const isAdminByRole = !isInactive && (profileAdmin || metadataAdmin)
  const callerRole = profileAdmin ? profile.role : metadataRole
  if (!isAdminByRole && !allowlisted) {
    return json(403, {
      error:
        'Tu cuenta no tiene permisos administrativos. ' +
        'Verifica app_user_profiles.role=admin/super_admin o configura ADMIN_CREATE_USER_EMAILS temporalmente.',
    })
  }

  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
    if (!body.email?.trim()) throw new Error('email required')
    if (!body.password || body.password.length < 6) throw new Error('password required (min 6 characters)')
    if (!body.name?.trim()) throw new Error('name required')
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : 'Invalid body' })
  }

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: body.email!.trim(),
    password: body.password!,
    email_confirm: true,
    user_metadata: { name: body.name!.trim() },
  })

  if (createErr) {
    console.warn('[admin-create-user] create failed', {
      actor: caller.email,
      actorRole: callerRole,
      targetEmail: body.email?.trim(),
      reason: createErr.message,
    })
    await writeAuditLog(adminClient, caller.id, 'admin_create_user_failed', null, {
      actorEmail: caller.email,
      actorRole: callerRole || null,
      actorRoleSource: profile.source,
      targetEmail: body.email?.trim() ?? null,
      reason: createErr.message,
    })
    return json(400, { error: createErr.message })
  }

  const u = created.user
  if (!u) {
    return json(500, { error: 'No se pudo crear el usuario.' })
  }

  console.log('[admin-create-user] success', {
    actor: caller.email,
    actorRole: callerRole,
    targetUserId: u.id,
    targetEmail: u.email,
  })
  await writeAuditLog(adminClient, caller.id, 'admin_create_user_success', u.id, {
    actorEmail: caller.email,
    actorRole: callerRole || null,
    actorRoleSource: profile.source,
    targetEmail: u.email ?? null,
  })

  return json(200, { user: { id: u.id, email: u.email } })
})
