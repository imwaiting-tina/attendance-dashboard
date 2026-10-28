import { describe, expect, it } from 'vitest'
import { canShowMovingAverage } from './aggregate'

const points = (months: string[]) => months.map((month) => ({ month }))

describe('canShowMovingAverage', () => {
  it('连续且不少于 3 个月时才计算移动平均', () => {
    expect(canShowMovingAverage(points(['2026-01', '2026-02', '2026-03']))).toBe(true)
    expect(canShowMovingAverage(points(['2026-11', '2026-12', '2027-01']))).toBe(true)
  })

  it('单月、两个月或非连续月份不计算移动平均', () => {
    expect(canShowMovingAverage(points(['2026-09']))).toBe(false)
    expect(canShowMovingAverage(points(['2026-08', '2026-09']))).toBe(false)
    expect(canShowMovingAverage(points(['2026-01', '2026-03', '2026-04']))).toBe(false)
  })
})
