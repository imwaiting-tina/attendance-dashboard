/**
 * 初始导入脚本：解析目录内的月度考勤表，逐月调用 Supabase RPC 原子入库。
 *
 * 用法：npm run seed -- /path/to/考勤汇总文件夹
 *
 * 优先使用 service_role（本地一次性初始化，不写入前端）；
 * 没有 service key 时退回管理员邮箱密码登录。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { parseAttendanceWorkbook } from '../src/lib/parseAttendance'
import type { PeriodPayload } from '../src/lib/types'

for (const envFile of ['.env.local', '.env.setup', '.env']) {
  try {
    process.loadEnvFile(envFile)
  } catch {
    // 文件不存在时忽略
  }
}

const folder = process.argv[2]
if (!folder) {
  console.error('用法：npm run seed -- /path/to/考勤汇总文件夹')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? ''
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? ''

if (!supabaseUrl) {
  console.error('缺少 SUPABASE_URL（或 VITE_SUPABASE_URL），请先配置 .env.local')
  process.exit(1)
}

const files = fs
  .readdirSync(folder)
  .filter((name) => /\.(xlsx|xls)$/i.test(name) && !name.startsWith('~$'))
  .sort()

if (files.length === 0) {
  console.error(`目录中没有 Excel 文件：${folder}`)
  process.exit(1)
}

interface ParsedMonth {
  file: string
  payload: PeriodPayload
  records: ReturnType<typeof parseAttendanceWorkbook>['records']
  warnings: string[]
}

const months: ParsedMonth[] = []
const seenMonths = new Set<string>()

for (const file of files) {
  const buffer = fs.readFileSync(path.join(folder, file))
  const parsed = parseAttendanceWorkbook(new Uint8Array(buffer), file)
  if (!parsed.month) {
    console.error(`❌ ${file}：无法识别月份，已停止（不会静默导入错误月份）`)
    process.exit(1)
  }
  if (seenMonths.has(parsed.month)) {
    console.error(`❌ ${file}：月份 ${parsed.month} 与前面的文件重复，已停止`)
    process.exit(1)
  }
  seenMonths.add(parsed.month)
  months.push({
    file,
    payload: {
      month: parsed.month,
      label: parsed.label ?? parsed.month,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      source_file: file,
      employee_count: parsed.records.length,
    },
    records: parsed.records,
    warnings: parsed.warnings,
  })
}

months.sort((a, b) => a.payload.month.localeCompare(b.payload.month))

const totalRecords = months.reduce((sum, item) => sum + item.records.length, 0)
console.log(`准备导入 ${months.length} 个月 / ${totalRecords} 条员工记录：`)
for (const item of months) {
  console.log(
    `  ${item.payload.month}  ${String(item.records.length).padStart(2)} 人  ${item.file}`,
  )
  for (const warning of item.warnings) console.log(`    ⚠️ ${warning}`)
}

async function createSeedClient(): Promise<SupabaseClient> {
  if (serviceRoleKey) {
    console.log('\n使用 service_role 本地导入（密钥不会离开本机）')
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!anonKey || !adminEmail || !adminPassword) {
    console.error(
      '\n缺少凭据：请设置 SUPABASE_SERVICE_ROLE_KEY，或同时设置 VITE_SUPABASE_ANON_KEY + SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD',
    )
    process.exit(1)
  }

  console.log(`\n使用管理员账号 ${adminEmail} 登录后导入`)
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error) {
    console.error(`管理员登录失败：${error.message}`)
    process.exit(1)
  }
  const { data: allowed, error: adminError } = await client.rpc('is_admin')
  if (adminError) {
    console.error(`检查管理员权限失败：${adminError.message}`)
    process.exit(1)
  }
  if (!allowed) {
    console.error('当前账号不在 app_admins 名单中，无法导入')
    process.exit(1)
  }
  return client
}

const client = await createSeedClient()

for (const item of months) {
  process.stdout.write(`导入 ${item.payload.month} … `)
  const { error } = await client.rpc('import_attendance', {
    p_period: item.payload,
    p_records: item.records,
  })
  if (error) {
    console.error(`失败：${error.message}`)
    process.exit(1)
  }
  console.log('完成')
}

const { count: periodCount, error: periodError } = await client
  .from('attendance_periods')
  .select('*', { count: 'exact', head: true })
const { count: recordCount, error: recordError } = await client
  .from('attendance_records')
  .select('*', { count: 'exact', head: true })

if (periodError || recordError) {
  console.error(`入库后校验失败：${periodError?.message ?? recordError?.message}`)
  process.exit(1)
}

console.log(`\n完成：数据库现有 ${periodCount} 个月 / ${recordCount} 条记录`)
if (periodCount !== months.length || recordCount !== totalRecords) {
  console.error('记录数与本次解析结果不一致，请检查是否还有其他月份或重复导入')
  process.exit(1)
}
