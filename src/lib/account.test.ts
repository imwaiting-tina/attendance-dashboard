import { describe, expect, it } from 'vitest'
import { accountToEmail, displayAccount } from './account'

describe('登录账号映射', () => {
  it('用户名补全内部邮箱域名', () => {
    expect(accountToEmail('tina')).toBe('tina@attendance.local')
    expect(accountToEmail('  Tina  ')).toBe('tina@attendance.local')
  })

  it('完整邮箱保持原样并转小写', () => {
    expect(accountToEmail('Tina@Example.com')).toBe('tina@example.com')
  })

  it('空输入返回空字符串', () => {
    expect(accountToEmail('   ')).toBe('')
  })

  it('内部邮箱展示为用户名', () => {
    expect(displayAccount('tina@attendance.local')).toBe('tina')
    expect(displayAccount('Tina@Attendance.Local')).toBe('Tina')
  })

  it('外部邮箱与空值按原样处理', () => {
    expect(displayAccount('tina@example.com')).toBe('tina@example.com')
    expect(displayAccount(null)).toBe('')
    expect(displayAccount(undefined)).toBe('')
  })
})
