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
    surface: '#fcfcfb',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    border: 'rgba(11,11,11,0.12)',
    tooltipBg: '#ffffff',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
    success: '#006300',
    critical: '#d03b3b',
  },
  dark: {
    mode: 'dark',
    surface: '#1a1a19',
    textPrimary: '#ffffff',
    textSecondary: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    border: 'rgba(255,255,255,0.14)',
    tooltipBg: '#222220',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
    success: '#0ca30c',
    critical: '#e66767',
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
