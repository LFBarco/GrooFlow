/**
 * Habilita o deshabilita acceso Auth (ban/unban) para un usuario.
 * Usado al eliminar usuario o marcarlo como inactivo.
 */
import {
  getCorsHeaders,
  jsonResponse,
  requireAdminCaller,
  resolveTargetUserId,
  writeAuditLog,
} from '../_shared/adminEdgeUtils.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(corsHeaders, 405, { error: 'Method not allowed' })
  }

  const admin = await requireAdminCaller(req)
  if (!admin.ok) return admin.response
  const { ctx, corsHeaders: cors } = admin

  let body: { userId?: string; email?: string; enabled?: boolean }
  try {
    body = await req.json()
    if (typeof body.enabled !== 'boolean') throw new Error('enabled (boolean) required')
    if (!body.userId && !body.email) throw new Error('userId or email required')
  } catch (e) {
    return jsonResponse(cors, 400, { error: e instanceof Error ? e.message : 'Invalid body' })
  }

  const targetUserId = await resolveTargetUserId(ctx.adminClient, body.userId, body.email)
  if (!targetUserId) {
    return jsonResponse(cors, 404, { error: 'Usuario no encontrado en Auth' })
  }

  if (targetUserId === ctx.caller.id && body.enabled === false) {
    return jsonResponse(cors, 400, { error: 'No puedes desactivar tu propia cuenta.' })
  }

  const { error } = await ctx.adminClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: body.enabled ? 'none' : '876000h',
  })

  if (error) {
    await writeAuditLog(ctx.adminClient, ctx.caller.id, 'admin_set_user_auth_failed', targetUserId, {
      actorEmail: ctx.caller.email,
      actorRole: ctx.callerRole || null,
      actorRoleSource: ctx.profileSource,
      enabled: body.enabled,
      reason: error.message,
    })
    return jsonResponse(cors, 400, { error: error.message })
  }

  await writeAuditLog(ctx.adminClient, ctx.caller.id, 'admin_set_user_auth_success', targetUserId, {
    actorEmail: ctx.caller.email,
    actorRole: ctx.callerRole || null,
    actorRoleSource: ctx.profileSource,
    enabled: body.enabled,
  })

  return jsonResponse(cors, 200, { ok: true, userId: targetUserId, enabled: body.enabled })
})
