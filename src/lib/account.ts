/**
 * Supabase Auth 只支持邮箱登录，登录页对外使用更短的账号名。
 * 不含 @ 的输入会自动补上内部域名，完整邮箱也原样保留，便于迁移或应急登录。
 */
export const ACCOUNT_EMAIL_DOMAIN = 'attendance.local'

export function accountToEmail(input: string): string {
  const value = input.trim().toLowerCase()
  if (!value) return ''
  return value.includes('@') ? value : `${value}@${ACCOUNT_EMAIL_DOMAIN}`
}

/** 把内部邮箱还原成登录页上的账号名；其他邮箱保持原样 */
export function displayAccount(email: string | null | undefined): string {
  if (!email) return ''
  const suffix = `@${ACCOUNT_EMAIL_DOMAIN}`
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email
}
