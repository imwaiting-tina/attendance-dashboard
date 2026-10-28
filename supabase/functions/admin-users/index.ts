import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

// 账号管理函数：service_role 只存在于 Edge Function 环境，不会下发到浏览器。
// 所有管理动作都会先验证调用者的 JWT、启用状态和 app_admins 管理员身份。

type AppRole = 'admin' | 'member'

interface ManagedAccount {
  id: string
  username: string
  role: AppRole
  disabled: boolean
  created_at: string | null
  last_sign_in_at: string | null
  is_self: boolean
}

interface AuthUserLike {
  id: string
  email?: string | null
  created_at?: string
  last_sign_in_at?: string | null
  banned_until?: string | null
}

const ACCOUNT_DOMAIN = 'attendance.local'
const BAN_DURATION = '876000h'
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// 服务端客户端只用于 Auth Admin API 与 app_admins 查询
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function fail(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}

function isDisabled(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  if (bannedUntil === 'infinity') return true
  const timestamp = Date.parse(bannedUntil)
  return Number.isFinite(timestamp) && timestamp > Date.now()
}

function usernameFromEmail(email: string | null | undefined): string {
  if (!email) return '未命名账号'
  const suffix = `@${ACCOUNT_DOMAIN}`
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email
}

function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function readPassword(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return '密码至少 8 位'
  if (password.length > 72) return '密码不能超过 72 位'
  return null
}

function validateUsername(username: string): string | null {
  if (!username) return '请输入账号名'
  if (!USERNAME_PATTERN.test(username)) {
    return '账号需为 2–32 位，仅限小写字母、数字、点、下划线或短横线，且以字母或数字开头'
  }
  return null
}

function mapAccount(
  user: AuthUserLike,
  adminIds: Set<string>,
  callerId: string,
): ManagedAccount {
  return {
    id: user.id,
    username: usernameFromEmail(user.email),
    role: adminIds.has(user.id) ? 'admin' : 'member',
    disabled: isDisabled(user.banned_until),
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    is_self: user.id === callerId,
  }
}

async function listAllUsers(): Promise<AuthUserLike[]> {
  const users: AuthUserLike[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`读取账号列表失败：${error.message}`)
    users.push(...data.users)
    if (data.users.length < 1000) break
  }
  return users
}

async function readAdminIds(): Promise<Set<string>> {
  const { data, error } = await serviceClient.from('app_admins').select('user_id')
  if (error) throw new Error(`读取管理员名单失败：${error.message}`)
  return new Set((data ?? []).map((row) => String(row.user_id)))
}

async function countActiveAdmins(excludeId: string): Promise<number> {
  const adminIds = await readAdminIds()
  let count = 0
  for (const id of adminIds) {
    if (id === excludeId) continue
    const { data, error } = await serviceClient.auth.admin.getUserById(id)
    if (error || !data.user) continue
    if (!isDisabled(data.user.banned_until)) count += 1
  }
  return count
}

async function requireCaller(req: Request) {
  const authorization = req.headers.get('Authorization') ?? ''
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]
  if (!token) return { error: fail('请先登录', 401) } as const

  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return { error: fail('登录状态已失效，请重新登录', 401) } as const

  const { data: fresh, error: freshError } = await serviceClient.auth.admin.getUserById(
    data.user.id,
  )
  if (freshError || !fresh.user) return { error: fail('账号不存在', 401) } as const
  if (isDisabled(fresh.user.banned_until)) {
    return { error: fail('账号已停用，请联系管理员', 403) } as const
  }

  return { caller: fresh.user } as const
}

async function handleList(callerId: string): Promise<Response> {
  const [users, adminIds] = await Promise.all([listAllUsers(), readAdminIds()])
  const accounts = users
    .map((user) => mapAccount(user, adminIds, callerId))
    .sort((a, b) => {
      const roleDifference = Number(b.role === 'admin') - Number(a.role === 'admin')
      if (roleDifference !== 0) return roleDifference
      return a.username.localeCompare(b.username, 'en')
    })
  return jsonResponse({ accounts })
}

async function handleCreate(body: Record<string, unknown>): Promise<Response> {
  const username = normalizeUsername(body.username)
  const password = readPassword(body.password)
  const role = body.role

  const usernameError = validateUsername(username)
  if (usernameError) return fail(usernameError)
  const passwordError = validatePassword(password)
  if (passwordError) return fail(passwordError)
  if (role !== 'admin' && role !== 'member') return fail('账号角色不正确')

  const email = `${username}@${ACCOUNT_DOMAIN}`
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  })

  if (error) {
    if (/already.*registered|already.*exists|duplicate/i.test(error.message)) {
      return fail('该账号已存在', 409)
    }
    if (/password/i.test(error.message)) return fail('密码不符合要求，请更换后重试')
    return fail(`创建账号失败：${error.message}`, 500)
  }

  if (!data.user) return fail('创建账号失败：未返回用户信息', 500)

  if (role === 'admin') {
    const { error: adminError } = await serviceClient
      .from('app_admins')
      .insert({ user_id: data.user.id })
    if (adminError) {
      // 管理员名单写入失败时回滚刚创建的 Auth 账号，避免留下半套数据
      await serviceClient.auth.admin.deleteUser(data.user.id)
      return fail(`设置管理员权限失败：${adminError.message}`, 500)
    }
  }

  const adminIds = role === 'admin' ? new Set([data.user.id]) : new Set<string>()
  return jsonResponse({ account: mapAccount(data.user, adminIds, '') }, 201)
}

async function handleSetDisabled(
  body: Record<string, unknown>,
  callerId: string,
): Promise<Response> {
  const userId = typeof body.id === 'string' ? body.id : ''
  const disabled = body.disabled
  if (!UUID_PATTERN.test(userId)) return fail('账号参数不正确')
  if (typeof disabled !== 'boolean') return fail('停用状态参数不正确')
  if (userId === callerId && disabled) return fail('不能停用当前登录账号', 400)

  const { data, error } = await serviceClient.auth.admin.getUserById(userId)
  if (error || !data.user) return fail('账号不存在', 404)

  const currentlyDisabled = isDisabled(data.user.banned_until)
  if (currentlyDisabled === disabled) return jsonResponse({ ok: true })

  if (disabled) {
    const adminIds = await readAdminIds()
    if (adminIds.has(userId)) {
      const remaining = await countActiveAdmins(userId)
      if (remaining === 0) return fail('至少需要保留一个可用的管理员账号', 400)
    }
  }

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? BAN_DURATION : 'none',
  })
  if (updateError) return fail(`更新账号状态失败：${updateError.message}`, 500)

  return jsonResponse({ ok: true })
}

async function handleDelete(body: Record<string, unknown>, callerId: string): Promise<Response> {
  const userId = typeof body.id === 'string' ? body.id : ''
  if (!UUID_PATTERN.test(userId)) return fail('账号参数不正确')
  if (userId === callerId) return fail('不能删除当前登录账号', 400)

  const { data, error } = await serviceClient.auth.admin.getUserById(userId)
  if (error || !data.user) return fail('账号不存在', 404)

  const adminIds = await readAdminIds()
  if (adminIds.has(userId) && !isDisabled(data.user.banned_until)) {
    const remaining = await countActiveAdmins(userId)
    if (remaining === 0) return fail('至少需要保留一个可用的管理员账号', 400)
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
  if (deleteError) return fail(`删除账号失败：${deleteError.message}`, 500)

  return jsonResponse({ ok: true })
}

async function handleResetPassword(body: Record<string, unknown>): Promise<Response> {
  const userId = typeof body.id === 'string' ? body.id : ''
  const password = readPassword(body.password)
  if (!UUID_PATTERN.test(userId)) return fail('账号参数不正确')
  const passwordError = validatePassword(password)
  if (passwordError) return fail(passwordError)

  const { data, error } = await serviceClient.auth.admin.getUserById(userId)
  if (error || !data.user) return fail('账号不存在', 404)

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    password,
  })
  if (updateError) {
    if (/password/i.test(updateError.message)) return fail('密码不符合要求，请更换后重试')
    return fail(`重置密码失败：${updateError.message}`, 500)
  }

  return jsonResponse({ ok: true })
}

async function handleSelfChangePassword(
  body: Record<string, unknown>,
  caller: { id: string; email?: string | null },
): Promise<Response> {
  const currentPassword = readPassword(body.current_password)
  const newPassword = readPassword(body.new_password)
  if (!currentPassword) return fail('请输入当前密码')
  const passwordError = validatePassword(newPassword)
  if (passwordError) return fail(passwordError)
  if (!caller.email) return fail('账号缺少登录邮箱，无法修改密码', 400)

  // 用一次性的匿名客户端验证旧密码，避免影响当前浏览器的登录会话
  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: caller.email,
    password: currentPassword,
  })
  if (signInError) {
    if (/invalid login credentials/i.test(signInError.message)) return fail('当前密码不正确')
    return fail(`验证当前密码失败：${signInError.message}`, 500)
  }
  await verifier.auth.signOut().catch(() => undefined)

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(caller.id, {
    password: newPassword,
  })
  if (updateError) {
    if (/password/i.test(updateError.message)) return fail('密码不符合要求，请更换后重试')
    return fail(`修改密码失败：${updateError.message}`, 500)
  }

  return jsonResponse({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return fail('仅支持 POST 请求', 405)

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fail('请求格式错误')
    }
    body = parsed as Record<string, unknown>
  } catch {
    return fail('请求格式错误')
  }

  const action = typeof body.action === 'string' ? body.action : ''
  if (!action) return fail('缺少操作类型')

  try {
    const auth = await requireCaller(req)
    if ('error' in auth) return auth.error
    const { caller } = auth

    // 个人改密只要求账号已启用，不要求管理员身份
    if (action === 'self_change_password') {
      return await handleSelfChangePassword(body, caller)
    }

    const { data: adminRow, error: adminError } = await serviceClient
      .from('app_admins')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle()
    if (adminError) return fail(`校验管理员权限失败：${adminError.message}`, 500)
    if (!adminRow) return fail('仅管理员可管理账号', 403)

    switch (action) {
      case 'list':
        return await handleList(caller.id)
      case 'create':
        return await handleCreate(body)
      case 'set_disabled':
        return await handleSetDisabled(body, caller.id)
      case 'delete':
        return await handleDelete(body, caller.id)
      case 'reset_password':
        return await handleResetPassword(body)
      default:
        return fail('不支持的操作类型')
    }
  } catch (error) {
    console.error('admin-users failed', action, error)
    return fail('账号服务暂时不可用，请稍后重试', 500)
  }
})
