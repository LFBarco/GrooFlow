/**
 * Crea usuario en Auth con la API admin (service role).
 */
import {
  findAuthUserByEmail,
  getCorsHeaders,
  jsonResponse,
  requireAdminCaller,
  validatePasswordPolicy,
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

  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
    if (!body.email?.trim()) throw new Error('email required')
    if (!body.password) throw new Error('password required')
    if (!body.name?.trim()) throw new Error('name required')
    const pwdErr = validatePasswordPolicy(body.password)
    if (pwdErr) throw new Error(pwdErr)
  } catch (e) {
    return jsonResponse(cors, 400, { error: e instanceof Error ? e.message : 'Invalid body' })
  }

  const { data: created, error: createErr } = await ctx.adminClient.auth.admin.createUser({
    email: body.email!.trim(),
    password: body.password!,
    email_confirm: true,
    user_metadata: { name: body.name!.trim() },
  })

  if (createErr) {
    const errMsg = (createErr.message || '').toLowerCase()
    const emailExists =
      createErr.code === 'email_exists' ||
      errMsg.includes('already been registered') ||
      errMsg.includes('already registered') ||
      errMsg.includes('user already registered')

    if (emailExists && body.email?.trim()) {
      const existingUser = await findAuthUserByEmail(ctx.adminClient, body.email.trim())
      if (existingUser) {
        await writeAuditLog(
          ctx.adminClient,
          ctx.caller.id,
          'admin_create_user_existing',
          existingUser.id,
          {
            actorEmail: ctx.caller.email,
            actorRole: ctx.callerRole || null,
            actorRoleSource: ctx.profileSource,
            targetEmail: existingUser.email ?? null,
          }
        )
        return jsonResponse(cors, 200, { user: existingUser, existing: true })
      }
    }

    console.warn('[admin-create-user] create failed', {
      actor: ctx.caller.email,
      targetEmail: body.email?.trim(),
      reason: createErr.message,
    })
    await writeAuditLog(ctx.adminClient, ctx.caller.id, 'admin_create_user_failed', null, {
      actorEmail: ctx.caller.email,
      actorRole: ctx.callerRole || null,
      actorRoleSource: ctx.profileSource,
      targetEmail: body.email?.trim() ?? null,
      reason: createErr.message,
    })
    return jsonResponse(cors, 400, { error: createErr.message })
  }

  const u = created.user
  if (!u) {
    return jsonResponse(cors, 500, { error: 'No se pudo crear el usuario.' })
  }

  await writeAuditLog(ctx.adminClient, ctx.caller.id, 'admin_create_user_success', u.id, {
    actorEmail: ctx.caller.email,
    actorRole: ctx.callerRole || null,
    actorRoleSource: ctx.profileSource,
    targetEmail: u.email ?? null,
  })

  return jsonResponse(cors, 200, { user: { id: u.id, email: u.email } })
})
