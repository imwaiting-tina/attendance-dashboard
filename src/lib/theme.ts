export type ThemeMode = 'light' | 'dark'

/** 图表用色板：明暗两套，均通过 dataviz 校验 */
export interface ChartTheme {
  mode: ThemeMode
  surface: string
  textPrimary: string
  textSecondary: string
  muted: string
  grid: string
  axis: string
  border: string
  tooltipBg: string
  series: string[]
  success: string
  critical: string
}

export const CHART_THEMES: Record<ThemeMode, ChartTheme> = {
  light: {
    mode: 'light',
    surface: '#ffffff',
    textPrimary: '#17212b',
    textSecondary: '#4d5b6b',
    muted: '#68798b',
    grid: '#e4e9f0',
    axis: '#cbd4df',
    border: 'rgba(23,33,43,0.12)',
    tooltipBg: '#ffffff',
    // 商务蓝色板：蓝、陶土、青绿、金、紫、绿；顺序与叠放顺序一致，已通过明暗两套校验
    series: ['#4f8ac2', '#c97858', '#149a91', '#b78b32', '#9a6cb0', '#6aa05e'],
    success: '#2f7d4a',
    critical: '#b04646',
  },
  dark: {
    mode: 'dark',
    surface: '#2b323c',
    textPrimary: '#eef2f7',
    textSecondary: '#c2cbd7',
    muted: '#94a1b2',
    grid: '#3b4552',
    axis: '#4d5968',
    border: 'rgba(238,242,247,0.14)',
    tooltipBg: '#333b46',
    series: ['#5a8bc9', '#c26f50', '#2fa69e', '#ae8a42', '#a678b8', '#68a55e'],
    success: '#86c39a',
    critical: '#e09494',
  },
}

/** 假期种类的固定颜色顺序：颜色跟实体走，筛选后不重新分配 */
export const LEAVE_TYPES = [
  { key: 'annualLeave', label: '年假', colorIndex: 0 },
  { key: 'compLeave', label: '调休', colorIndex: 1 },
  { key: 'sickLeave', label: '病假', colorIndex: 2 },
  { key: 'personalLeave', label: '事假', colorIndex: 3 },
  { key: 'bereavementLeave', label: '丧假', colorIndex: 4 },
  { key: 'parentalLeave', label: '育儿假', colorIndex: 5 },
] as const
