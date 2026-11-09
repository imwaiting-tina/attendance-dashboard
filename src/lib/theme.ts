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
    surface: '#faf9f6',
    textPrimary: '#2b2e2f',
    textSecondary: '#5c605f',
    muted: '#868a87',
    grid: '#dcd7cc',
    axis: '#c4beb2',
    border: 'rgba(43,46,47,0.12)',
    tooltipBg: '#ffffff',
    // 莫兰迪色板：低饱和、带灰调；顺序与叠放顺序一致，已通过明暗两套校验
    series: ['#3f76ac', '#b86144', '#008e88', '#af8328', '#8a5299', '#528f4c'],
    success: '#3e6b4a',
    critical: '#8a5a5a',
  },
  dark: {
    mode: 'dark',
    surface: '#242728',
    textPrimary: '#f2f0ea',
    textSecondary: '#c8c5ba',
    muted: '#9a988f',
    grid: '#363a3b',
    axis: '#474c4d',
    border: 'rgba(242,240,234,0.14)',
    tooltipBg: '#2c3031',
    series: ['#5a8bc9', '#c26f50', '#2fa69e', '#ae8a42', '#a678b8', '#68a55e'],
    success: '#9db79b',
    critical: '#d3968d',
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
