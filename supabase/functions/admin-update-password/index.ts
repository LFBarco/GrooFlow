import {
  getCorsHeaders,
  isCorsPreflightAllowed,
  jsonResponse,
  requireAdminCaller,
  resolveTargetUserId,
  validatePasswordPolicy,
  writeAuditLog,
} from '../_shared/adminEdgeUtils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    if (!isCorsPreflightAllowed(req)) {
      return new Response(null, { status: 403 })
    }
    return new Response(null, { status: 204, headers: getCorsHeaders(req, 'POST, OPTIONS') })
  }
  const corsHeaders = getCorsHeaders(req, 'POST, OPTIONS')
  if (req.method !== 'POST') {
    return jsonResponse(corsHeaders, 405, { error: 'Method not allowed' })
  }

  const admin = await requireAdminCaller(req)
  if (!admin.ok) return admin.response
  const { ctx, corsHeaders: cors } = admin

  let body: { userId?: string; email?: string; newPassword?: string }
  try {
    body = await req.json()
    if (!body.newPassword) throw new Error('newPassword required')
    const pwdErr = validatePasswordPolicy(body.newPassword)
    if (pwdErr) throw new Error(pwdErr)
    if (!body.userId && !body.email) throw new Error('userId or email required')
  } catch (e) {
    return jsonResponse(cors, 400, { error: e instanceof Error ? e.message : 'Invalid body' })
  }

  const targetUserId = await resolveTargetUserId(ctx.adminClient, body.userId, body.email)
  if (!targetUserId) {
    return jsonResponse(cors, 404, { error: 'Usuario no encontrado con ese correo' })
  }

  const { error } = await ctx.adminClient.auth.admin.updateUserById(targetUserId, {
    password: body.newPassword!,
  })

  if (error) {
    await writeAuditLog(
      ctx.adminClient,
      ctx.caller.id,
      'admin_update_password_failed',
      targetUserId,
      {
        actorEmail: ctx.caller.email,
        actorRole: ctx.callerRole || null,
        actorRoleSource: ctx.profileSource,
        reason: error.message,
      }
    )
    return jsonResponse(cors, 400, { error: error.message })
  }

  await writeAuditLog(
    ctx.adminClient,
    ctx.caller.id,
    'admin_update_password_success',
    targetUserId,
    {
      actorEmail: ctx.caller.email,
      actorRole: ctx.callerRole || null,
      actorRoleSource: ctx.profileSource,
    }
  )
  return jsonResponse(cors, 200, { ok: true })
})
