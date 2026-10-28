import { supabase } from './supabase'

export type AccountRole = 'admin' | 'member'

export interface ManagedAccount {
  id: string
  username: string
  role: AccountRole
  disabled: boolean
  created_at: string | null
  last_sign_in_at: string | null
  is_self: boolean
}

interface AccountListResponse {
  accounts: ManagedAccount[]
}

async function callAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('尚未配置 Supabase 环境变量')

  const { data, error } = await supabase.functions.invoke('admin-users', { body })

  if (error) {
    const context = (error as { context?: unknown }).context
    let remoteMessage = ''

    if (context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as { error?: unknown }
        if (typeof payload.error === 'string' && payload.error.trim()) {
          remoteMessage = payload.error
        }
      } catch {
        // 非 JSON 错误响应交给下面的通用提示
      }
      if (!remoteMessage && context.status === 404) {
        throw new Error('账号服务尚未部署，请先部署 admin-users 函数')
      }
    }

    if (remoteMessage) throw new Error(remoteMessage)
    const message = error.message || '账号服务请求失败'
    if (/failed to fetch|failed to send|networkerror|network error/i.test(message)) {
      throw new Error('无法连接账号服务，请检查网络后重试')
    }
    throw new Error(message)
  }

  if (!data || typeof data !== 'object') throw new Error('账号服务返回格式错误')
  const payload = data as { error?: unknown }
  if (typeof payload.error === 'string' && payload.error.trim()) {
    throw new Error(payload.error)
  }
  return data as T
}

export async function listAccounts(): Promise<ManagedAccount[]> {
  const data = await callAdminUsers<AccountListResponse>({ action: 'list' })
  return Array.isArray(data.accounts) ? data.accounts : []
}

export async function createAccount(input: {
  username: string
  password: string
  role: AccountRole
}): Promise<void> {
  await callAdminUsers({
    action: 'create',
    username: input.username,
    password: input.password,
    role: input.role,
  })
}

export async function setAccountDisabled(id: string, disabled: boolean): Promise<void> {
  await callAdminUsers({ action: 'set_disabled', id, disabled })
}

export async function deleteAccount(id: string): Promise<void> {
  await callAdminUsers({ action: 'delete', id })
}

export async function resetAccountPassword(id: string, password: string): Promise<void> {
  await callAdminUsers({ action: 'reset_password', id, password })
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await callAdminUsers({
    action: 'self_change_password',
    current_password: currentPassword,
    new_password: newPassword,
  })
}
