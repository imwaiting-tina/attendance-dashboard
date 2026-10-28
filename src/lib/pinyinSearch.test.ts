import { describe, expect, it } from 'vitest'
import {
  employeePinyinLabel,
  matchesEmployeeKeyword,
  scoreEmployeeKeyword,
} from './pinyinSearch'

describe('拼音员工搜索', () => {
  it('首字母可以匹配姓名', () => {
    expect(matchesEmployeeKeyword('陈圆', 'cy')).toBe(true)
    expect(matchesEmployeeKeyword('陈圆', 'CY')).toBe(true)
    expect(matchesEmployeeKeyword('赖淑贤', 'lsx')).toBe(true)
  })

  it('支持全拼、空格全拼与部分拼音', () => {
    expect(matchesEmployeeKeyword('陈圆', 'chenyuan')).toBe(true)
    expect(matchesEmployeeKeyword('陈圆', 'chen yuan')).toBe(true)
    expect(matchesEmployeeKeyword('陈圆', 'cheny')).toBe(true)
    expect(matchesEmployeeKeyword('陈圆', 'yuan')).toBe(true)
  })

  it('保留中文直接搜索与英文姓名搜索', () => {
    expect(matchesEmployeeKeyword('陈圆', '陈')).toBe(true)
    expect(matchesEmployeeKeyword('陈圆', '圆')).toBe(true)
    expect(matchesEmployeeKeyword('Yvonne Lai', 'yvonne')).toBe(true)
  })

  it('多音姓氏按姓氏读音匹配', () => {
    expect(matchesEmployeeKeyword('曾小贤', 'zxx')).toBe(true)
    expect(matchesEmployeeKeyword('曾小贤', 'cxx')).toBe(false)
    expect(matchesEmployeeKeyword('单雄信', 'sxx')).toBe(true)
  })

  it('不相关的关键词不会误匹配', () => {
    expect(matchesEmployeeKeyword('张三', 'cy')).toBe(false)
    expect(matchesEmployeeKeyword('陈圆', 'wangwu')).toBe(false)
  })

  it('优先返回姓名与全拼更精确的结果', () => {
    expect(scoreEmployeeKeyword('陈圆', '陈圆')).toBeGreaterThan(
      scoreEmployeeKeyword('陈圆', 'cy'),
    )
    expect(scoreEmployeeKeyword('陈圆', 'chenyuan')).toBeGreaterThan(
      scoreEmployeeKeyword('陈圆', 'yuan'),
    )
  })

  it('下拉提示展示带空格的全拼', () => {
    expect(employeePinyinLabel('陈圆')).toBe('chen yuan')
    expect(employeePinyinLabel('Yvonne Lai')).toBe('')
  })
})
