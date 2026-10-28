import { describe, expect, it } from 'vitest'
import { detectMonthFromFileName, formatMonthLabel, parseShortDate } from './normalize'

describe('detectMonthFromFileName', () => {
  it('识别常见的年月文件名', () => {
    expect(detectMonthFromFileName('202601考勤表.xlsx')).toBe('2026-01')
    expect(detectMonthFromFileName('202608考勤表v2(1).xlsx')).toBe('2026-08')
    expect(detectMonthFromFileName('/tmp/考勤汇总/202612考勤汇总.xlsx')).toBe('2026-12')
  })

  it('无法识别或月份非法时返回 null', () => {
    expect(detectMonthFromFileName('考勤表.xlsx')).toBeNull()
    expect(detectMonthFromFileName('202613考勤表.xlsx')).toBeNull()
    expect(detectMonthFromFileName('26-09考勤表.xlsx')).toBeNull()
  })
})

describe('parseShortDate', () => {
  it('兼容两位与四位年份', () => {
    expect(parseShortDate('26-09-01')).toBe('2026-09-01')
    expect(parseShortDate('2026-9-1')).toBe('2026-09-01')
    expect(parseShortDate('26-09-01 08:30:00')).toBe('2026-09-01')
  })

  it('拒绝空值和非法日期', () => {
    expect(parseShortDate(null)).toBeNull()
    expect(parseShortDate('休息')).toBeNull()
    expect(parseShortDate('26-13-01')).toBeNull()
    expect(parseShortDate('26-09-32')).toBeNull()
  })
})

describe('formatMonthLabel', () => {
  it('生成中文年月标签', () => {
    expect(formatMonthLabel('2026-10')).toBe('2026年10月')
    expect(formatMonthLabel('2026-01')).toBe('2026年1月')
  })

  it('格式不符时原样返回', () => {
    expect(formatMonthLabel('2026/10')).toBe('2026/10')
  })
})
