import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, isCorsPreflightAllowed } from './corsUtils.ts'

export { getCorsHeaders, isCorsPreflightAllowed } from './corsUtils.ts'

export function jsonResponse(
  corsHeaders: Record<string, string>,
  status: number,
  body: Record<string, unknown>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export const ADMIN_ROLES = new Set(['admin', 'super_admin'])

export function getUserRole(user: {
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}) {
  const appRole = user.app_metadata?.role
  if (typeof appRole === 'string' && appRole.trim()) return appRole.trim().toLowerCase()
  const userRole = user.user_metadata?.role
  if (typeof userRole === 'string' && userRole.trim()) return userRole.trim().toLowerCase()
  return ''
}

export function getEmailAllowList() {
  return (Deno.env.get('ADMIN_CREATE_USER_EMAILS') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function getCallerRoleFromProfile(
  adminClient: ReturnType<typeof createClient>,
  userId: string
) {
  const { data, error } = await adminClient
    .from('app_user_profiles')
    .select('role,status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return { role: '', status: '', source: 'none' as const }
  return {
    role: typeof data.role === 'string' ? data.role.toLowerCase() : '',
    status: typeof data.status === 'string' ? data.status.toLowerCase() : '',
    source: 'profile' as const,
  }
}

export async function writeAuditLog(
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

export type AdminCallerContext = {
  adminClient: ReturnType<typeof createClient>
  caller: { id: string; email?: string }
  callerRole: string
  profileSource: string
}

/** Valida JWT del caller y permisos admin (rol SQL/metadata o allowlist). */
export async function requireAdminCaller(req: Request): Promise<
  | { ok: true; ctx: AdminCallerContext; corsHeaders: Record<string, string> }
  | { ok: false; response: Response }
> {
  const corsHeaders = getCorsHeaders(req, 'POST, OPTIONS')
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: jsonResponse(corsHeaders, 401, { error: 'Debes iniciar sesión.' }),
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return {
      ok: false,
      response: jsonResponse(corsHeaders, 500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }),
    }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: caller },
    error: callerErr,
  } = await userClient.auth.getUser()
  if (callerErr || !caller?.email) {
    return {
      ok: false,
      response: jsonResponse(corsHeaders, 401, { error: 'Sesión inválida.' }),
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: callerById, error: callerByIdErr } = await adminClient.auth.admin.getUserById(
    caller.id
  )
  if (callerByIdErr || !callerById?.user) {
    return {
      ok: false,
      response: jsonResponse(corsHeaders, 401, { error: 'No autorizado.' }),
    }
  }

  const profile = await getCallerRoleFromProfile(adminClient, caller.id)
  const metadataRole = getUserRole(callerById.user)
  const profileAdmin = ADMIN_ROLES.has(profile.role) && profile.status === 'active'
  const metadataAdmin = ADMIN_ROLES.has(metadataRole)
  const isInactive = profile.source === 'profile' && profile.status === 'inactive'
  const allowlisted = getEmailAllowList().includes(caller.email.toLowerCase())
  const adminByRole = !isInactive && (profileAdmin || metadataAdmin)
  if (!adminByRole && !allowlisted) {
    return {
      ok: false,
      response: jsonResponse(
        corsHeaders,
        403,
        {
          error:
            'Tu cuenta no tiene permisos administrativos. ' +
            'Verifica app_user_profiles.role=admin/super_admin o configura ADMIN_CREATE_USER_EMAILS.',
        }
      ),
    }
  }

  return {
    ok: true,
    corsHeaders,
    ctx: {
      adminClient,
      caller: { id: caller.id, email: caller.email },
      callerRole: profileAdmin ? profile.role : metadataRole,
      profileSource: profile.source,
    },
  }
}

/** Política mínima de contraseña para producción. */
export function validatePasswordPolicy(password: string): string | null {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra.'
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.'
  }
  return null
}

/** Busca usuario Auth por email con paginación (evita límite 1000). */
export async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; email?: string } | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) return null
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit?.id) return { id: hit.id, email: hit.email ?? email }
    if (data.users.length < perPage) return null
    page += 1
  }
}

/** Resuelve userId desde userId o email. */
export async function resolveTargetUserId(
  adminClient: ReturnType<typeof createClient>,
  userId?: string,
  email?: string
): Promise<string | null> {
  if (userId?.trim()) return userId.trim()
  if (email?.trim()) {
    const found = await findAuthUserByEmail(adminClient, email)
    return found?.id ?? null
  }
  return null
}
