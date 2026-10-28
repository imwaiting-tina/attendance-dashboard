/**
 * 一次性管理员初始化：用 service_role 创建（或复用）管理员账号，
 * 并把 uid 写入 app_admins。
 *
 * 前置：.env.setup 中配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
 *      ADMIN_EMAIL / ADMIN_PASSWORD；service_role 只在本机使用。
 *
 * 用法：npm run bootstrap:admin
 */
import { createClient } from '@supabase/supabase-js'

for (const envFile of ['.env.setup', '.env.local']) {
  try {
    process.loadEnvFile(envFile)
  } catch {
    // 文件不存在时忽略
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? ''
const adminPassword = process.env.ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? ''

if (!supabaseUrl || !serviceRoleKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，请检查 .env.setup')
  process.exit(1)
}
if (!adminEmail || !adminPassword) {
  console.error('缺少 ADMIN_EMAIL 或 ADMIN_PASSWORD，请检查 .env.setup')
  process.exit(1)
}
if (adminPassword.length < 8) {
  console.error('ADMIN_PASSWORD 至少需要 8 位')
  process.exit(1)
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(email: string) {
  const perPage = 200
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`读取用户列表失败：${error.message}`)
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) return null
  }
  return null
}

let userId: string
const existing = await findUserByEmail(adminEmail)

if (existing) {
  userId = existing.id
  console.log(`管理员账号已存在，复用 ${adminEmail}（未修改密码）`)
} else {
  const { data, error } = await client.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  })
  if (error || !data.user) {
    console.error(`创建管理员失败：${error?.message ?? '未知错误'}`)
    process.exit(1)
  }
  userId = data.user.id
  console.log(`已创建管理员账号 ${adminEmail}`)
}

const { error: adminError } = await client
  .from('app_admins')
  .upsert({ user_id: userId }, { onConflict: 'user_id' })
if (adminError) {
  console.error(`写入 app_admins 失败：${adminError.message}`)
  process.exit(1)
}

console.log(`已登记管理员 uid：${userId}`)
console.log('下一步：在 Supabase 控制台关闭邮箱自助注册，然后用该账号登录仪表盘。')
