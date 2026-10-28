import type { EChartsCoreOption } from 'echarts/core'
import type { MonthlyPoint } from './aggregate'
import { formatMonthAxis, formatMonthFull, formatNumber, formatRate } from './format'
import { LEAVE_TYPES, type ChartTheme } from './theme'

const FONT_FAMILY = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'

interface TooltipRow {
  label: string
  value: string
  color?: string
}

interface TooltipParam {
  dataIndex?: number
  value?: number | string | null
  seriesName?: string
  color?: string
}

function tooltipHtml(
  theme: ChartTheme,
  title: string,
  rows: TooltipRow[],
  total?: TooltipRow,
): string {
  const rowHtml = rows
    .map(
      (row) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;line-height:22px">
          <span style="display:flex;align-items:center;color:${theme.textSecondary}">
            ${
              row.color
                ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${row.color};margin-right:8px;flex:none"></span>`
                : ''
            }
            ${row.label}
          </span>
          <span style="font-variant-numeric:tabular-nums;color:${theme.textPrimary};font-weight:500">${row.value}</span>
        </div>`,
    )
    .join('')

  const totalHtml = total
    ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;line-height:22px;margin-top:6px;padding-top:6px;border-top:1px solid ${theme.grid}">
        <span style="color:${theme.textSecondary}">${total.label}</span>
        <span style="font-variant-numeric:tabular-nums;color:${theme.textPrimary};font-weight:600">${total.value}</span>
      </div>`
    : ''

  return `<div style="min-width:156px;font-family:${FONT_FAMILY}">
    <div style="font-size:12px;font-weight:600;color:${theme.textPrimary};margin-bottom:6px">${title}</div>
    ${rowHtml}${totalHtml}
  </div>`
}

function valueAxisCommon(theme: ChartTheme) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: theme.muted,
      fontSize: 11,
      fontFamily: FONT_FAMILY,
      formatter: (value: number) => formatNumber(value),
    },
    splitLine: {
      show: true,
      lineStyle: { color: theme.grid, width: 1, type: 'solid' as const },
    },
  }
}

function baseLegend(theme: ChartTheme, show: boolean) {
  return {
    show,
    top: 0,
    left: 0,
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
    icon: 'roundRect',
    textStyle: {
      color: theme.textSecondary,
      fontSize: 12,
      fontFamily: FONT_FAMILY,
    },
    inactiveColor: theme.muted,
  }
}

function baseTooltip(theme: ChartTheme, pointer: 'shadow' | 'line') {
  return {
    trigger: 'axis' as const,
    axisPointer:
      pointer === 'shadow'
        ? {
            type: 'shadow' as const,
            shadowStyle: {
              color: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(11,11,11,0.04)',
            },
          }
        : {
            type: 'line' as const,
            lineStyle: { color: theme.axis, width: 1 },
          },
    backgroundColor: theme.tooltipBg,
    borderColor: theme.border,
    borderWidth: 1,
    padding: 12,
    textStyle: {
      color: theme.textPrimary,
      fontSize: 12,
      fontFamily: FONT_FAMILY,
    },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);',
  }
}

function xAxisCommon(points: MonthlyPoint[], theme: ChartTheme, boundaryGap: boolean) {
  return {
    type: 'category' as const,
    data: points.map((point) => formatMonthAxis(point.month)),
    boundaryGap,
    axisLine: { lineStyle: { color: theme.axis, width: 1 } },
    axisTick: { show: false },
    axisLabel: {
      color: theme.muted,
      fontSize: 11,
      fontFamily: FONT_FAMILY,
      margin: 10,
      // 让 ECharts 按容器宽度自动抽稀，移动端不会把 26/01 和 26/02 挤在一起
      interval: 'auto' as const,
    },
    splitLine: { show: false },
  }
}

function lastIndexLabel(
  theme: ChartTheme,
  lastIndex: number,
  textForIndex: (index: number) => string,
  position: 'top' | 'right' = 'top',
) {
  return {
    show: true,
    position,
    distance: position === 'top' ? 5 : 8,
    color: theme.textSecondary,
    fontSize: 11,
    fontFamily: FONT_FAMILY,
    formatter: (params: TooltipParam) => {
      if (params.dataIndex !== lastIndex) return ''
      return textForIndex(lastIndex)
    },
  }
}

/** 迟到趋势：迟到 + 严重迟到堆叠柱，单一纵轴（次） */
export function buildLateTrendOption(points: MonthlyPoint[], theme: ChartTheme): EChartsCoreOption {
  const showLate = points.some((point) => point.late > 0)
  const showSevere = points.some((point) => point.severeLate > 0)
  const showLegend = showLate && showSevere
  const last = points.length - 1
  const lastTotal = points[last] ? points[last].late + points[last].severeLate : 0

  const totalLabel = lastIndexLabel(theme, last, () => formatNumber(lastTotal))
  const series: EChartsCoreOption[] = []
  if (showLate) {
    series.push({
      name: '迟到',
      type: 'bar',
      stack: 'late',
      // 只有该月没有严重迟到时，迟到才是堆叠柱的顶端
      data: points.map((point) => ({
        value: point.late,
        itemStyle:
          !showSevere || point.severeLate === 0 ? { borderRadius: [4, 4, 0, 0] } : undefined,
      })),
      barMaxWidth: 22,
      itemStyle: { color: theme.series[0] },
      emphasis: { focus: 'series' },
      label: showSevere ? undefined : totalLabel,
    })
  }
  if (showSevere) {
    series.push({
      name: '严重迟到',
      type: 'bar',
      stack: 'late',
      data: points.map((point) => ({
        value: point.severeLate,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      })),
      barMaxWidth: 22,
      itemStyle: { color: theme.series[1] },
      emphasis: { focus: 'series' },
      label: totalLabel,
    })
  }

  return {
    animationDuration: 420,
    grid: { left: 4, right: 12, top: showLegend ? 38 : 18, bottom: 4, containLabel: true },
    legend: baseLegend(theme, showLegend),
    tooltip: {
      ...baseTooltip(theme, 'shadow'),
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rows: TooltipRow[] = []
        if (showLate) rows.push({ label: '迟到', value: `${formatNumber(point.late)} 次`, color: theme.series[0] })
        if (showSevere) {
          rows.push({ label: '严重迟到', value: `${formatNumber(point.severeLate)} 次`, color: theme.series[1] })
        }
        return tooltipHtml(theme, formatMonthFull(point.month), rows, {
          label: '合计',
          value: `${formatNumber(point.late + point.severeLate)} 次`,
        })
      },
    },
    xAxis: xAxisCommon(points, theme, true),
    yAxis: { ...valueAxisCommon(theme), minInterval: 1 },
    series,
  }
}

/** 缺卡主图：缺卡次数（柱）+ 补卡人数（线），同为计数、共用一根纵轴 */
export function buildMissingPunchOption(points: MonthlyPoint[], theme: ChartTheme): EChartsCoreOption {
  const showProof = points.some((point) => point.proofCount > 0)
  const last = points.length - 1
  const lastMissing = points[last]?.missingPunch ?? 0

  const series: EChartsCoreOption[] = [
    {
      name: '缺卡次数',
      type: 'bar',
      data: points.map((point) => point.missingPunch),
      barMaxWidth: 22,
      itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' },
      label: lastIndexLabel(theme, last, () => formatNumber(lastMissing)),
    },
  ]

  if (showProof) {
    series.push({
      name: '补卡人数',
      type: 'line',
      data: points.map((point) => point.proofCount),
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: true,
      // 单月视图下柱子会盖住线点，提高层级让补卡人数始终可见
      z: 10,
      lineStyle: { width: 2, color: theme.series[1], cap: 'round', join: 'round' },
      itemStyle: { color: theme.series[1], borderColor: theme.surface, borderWidth: 2 },
      emphasis: { focus: 'series' },
    })
  }

  return {
    animationDuration: 420,
    grid: { left: 4, right: 12, top: showProof ? 38 : 18, bottom: 4, containLabel: true },
    legend: baseLegend(theme, showProof),
    tooltip: {
      ...baseTooltip(theme, 'shadow'),
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rows: TooltipRow[] = [
          { label: '缺卡次数', value: `${formatNumber(point.missingPunch)} 次`, color: theme.series[0] },
        ]
        if (showProof) {
          rows.push({ label: '补卡人数', value: `${formatNumber(point.proofCount)} 人`, color: theme.series[1] })
        }
        return tooltipHtml(theme, formatMonthFull(point.month), rows)
      },
    },
    xAxis: xAxisCommon(points, theme, true),
    yAxis: { ...valueAxisCommon(theme), minInterval: 1 },
    series,
  }
}

/** 考勤异常单独一张小图，避免与「次 / 人」共用纵轴 */
export function buildAbnormalDaysOption(points: MonthlyPoint[], theme: ChartTheme): EChartsCoreOption {
  const last = points.length - 1
  const lastValue = points[last]?.abnormalDays ?? 0

  return {
    animationDuration: 420,
    grid: { left: 4, right: 12, top: 14, bottom: 4, containLabel: true },
    legend: baseLegend(theme, false),
    tooltip: {
      ...baseTooltip(theme, 'shadow'),
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        return tooltipHtml(theme, formatMonthFull(point.month), [
          { label: '考勤异常', value: `${formatNumber(point.abnormalDays)} 天`, color: theme.series[0] },
        ])
      },
    },
    xAxis: xAxisCommon(points, theme, true),
    // 小图只有 88px 高，减少刻度数量，避免纵轴标签挤在一起
    yAxis: { ...valueAxisCommon(theme), splitNumber: 2, minInterval: 1 },
    series: [
      {
        name: '考勤异常天数',
        type: 'bar',
        data: points.map((point) => point.abnormalDays),
        barMaxWidth: 22,
        itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
        label: lastIndexLabel(theme, last, () => formatNumber(lastValue)),
      },
    ],
  }
}

/** 假期分类：固定顺序堆叠，颜色跟随假期种类 */
export function buildLeaveTrendOption(points: MonthlyPoint[], theme: ChartTheme): EChartsCoreOption {
  const activeTypes = LEAVE_TYPES.map((leave, index) => ({
    ...leave,
    index,
    total: points.reduce((sum, point) => sum + point[leave.key], 0),
  })).filter((leave) => leave.total > 0)

  // 每个月最上方的非零假期种类需要圆角，不能只看全局最后一种
  const topTypeIndex = points.map((point) => {
    let top = -1
    activeTypes.forEach((leave, index) => {
      if (point[leave.key] > 0) top = index
    })
    return top
  })
  const series: EChartsCoreOption[] = activeTypes.map((leave, seriesIndex) => ({
    name: leave.label,
    type: 'bar',
    stack: 'leave',
    data: points.map((point, pointIndex) => ({
      value: point[leave.key],
      itemStyle:
        topTypeIndex[pointIndex] === seriesIndex ? { borderRadius: [4, 4, 0, 0] } : undefined,
    })),
    barMaxWidth: 22,
    itemStyle: {
      color: theme.series[leave.colorIndex],
      borderColor: theme.surface,
      borderWidth: 1,
    },
    emphasis: { focus: 'series' },
  }))

  return {
    animationDuration: 420,
    grid: { left: 4, right: 12, top: activeTypes.length > 1 ? 38 : 18, bottom: 4, containLabel: true },
    legend: baseLegend(theme, activeTypes.length > 1),
    tooltip: {
      ...baseTooltip(theme, 'shadow'),
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rows: TooltipRow[] = activeTypes
          .filter((leave) => point[leave.key] > 0)
          .map((leave) => ({
            label: leave.label,
            value: `${formatNumber(point[leave.key])} 天`,
            color: theme.series[leave.colorIndex],
          }))
        const total = activeTypes.reduce((sum, leave) => sum + point[leave.key], 0)
        return tooltipHtml(theme, formatMonthFull(point.month), rows, {
          label: '合计请假',
          value: `${formatNumber(total)} 天`,
        })
      },
    },
    xAxis: xAxisCommon(points, theme, true),
    yAxis: valueAxisCommon(theme),
    series,
  }
}

/** 加班趋势：月度柱 + 3 个月移动平均线，同一纵轴（小时） */
export function buildOvertimeOption(points: MonthlyPoint[], theme: ChartTheme): EChartsCoreOption {
  const last = points.length - 1
  const lastValue = points[last]?.overtimeHours ?? 0
  // 少于 3 个月无法计算 3 个月移动平均，单月视图下不显示平均线
  const showAverage = points.length >= 3
  const movingAverage = showAverage
    ? points.map((_, index) => {
        if (index < 2) return null
        const window = points.slice(index - 2, index + 1)
        return Number((window.reduce((sum, point) => sum + point.overtimeHours, 0) / 3).toFixed(2))
      })
    : []

  const series: EChartsCoreOption[] = [
    {
      name: '加班时长',
      type: 'bar',
      data: points.map((point) => point.overtimeHours),
      barMaxWidth: 22,
      itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' },
      label: lastIndexLabel(theme, last, () => `${formatNumber(lastValue)} h`, 'right'),
    },
  ]
  if (showAverage) {
    series.push({
      name: '3 个月移动平均',
      type: 'line',
      data: movingAverage,
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: true,
      connectNulls: false,
      lineStyle: { width: 2, color: theme.series[1], cap: 'round', join: 'round' },
      itemStyle: { color: theme.series[1], borderColor: theme.surface, borderWidth: 2 },
      emphasis: { focus: 'series' },
    })
  }

  return {
    animationDuration: 420,
    // 右侧留出端点标签与移动平均线的间距
    grid: { left: 4, right: 46, top: 38, bottom: 4, containLabel: true },
    legend: baseLegend(theme, showAverage),
    tooltip: {
      ...baseTooltip(theme, 'shadow'),
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rows: TooltipRow[] = [
          { label: '加班时长', value: `${formatNumber(point.overtimeHours)} h`, color: theme.series[0] },
        ]
        const average = movingAverage[index]
        if (typeof average === 'number') {
          rows.push({ label: '3 个月移动平均', value: `${formatNumber(average)} h`, color: theme.series[1] })
        }
        return tooltipHtml(theme, formatMonthFull(point.month), rows)
      },
    },
    xAxis: xAxisCommon(points, theme, true),
    yAxis: valueAxisCommon(theme),
    series,
  }
}

/** 出勤率趋势：实际打卡 / 应出勤，单一纵轴（%），纵轴按数据范围缩放 */
export function buildAttendanceRateOption(points: MonthlyPoint[], theme: ChartTheme): EChartsCoreOption {
  const rates = points.map((point) => (point.rate === null ? null : point.rate * 100))
  const valid = rates.filter((rate): rate is number => rate !== null)
  const minRate = valid.length > 0 ? Math.min(...valid) : 0
  // 向下取整到 5%；若最低点刚好落在刻度上，再留一格，避免折线贴底
  const floorRate = Math.floor(minRate / 5) * 5
  const axisMin = Math.max(0, minRate === floorRate ? floorRate - 5 : floorRate)
  const last = points.length - 1

  return {
    animationDuration: 420,
    grid: { left: 4, right: 18, top: 18, bottom: 4, containLabel: true },
    legend: baseLegend(theme, false),
    tooltip: {
      ...baseTooltip(theme, 'line'),
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as TooltipParam[]
        const index = list[0]?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rows: TooltipRow[] = [
          { label: '出勤率', value: formatRate(point.rate), color: theme.series[0] },
          { label: '实际打卡', value: `${formatNumber(point.attendedDays)} 天` },
          { label: '应出勤', value: `${formatNumber(point.expectedDays)} 天` },
        ]
        return tooltipHtml(theme, formatMonthFull(point.month), rows)
      },
    },
    xAxis: xAxisCommon(points, theme, false),
    yAxis: {
      ...valueAxisCommon(theme),
      min: axisMin,
      max: 100,
      axisLabel: {
        color: theme.muted,
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        formatter: (value: number) => `${value}%`,
      },
    },
    series: [
      {
        name: '出勤率',
        type: 'line',
        data: rates,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        lineStyle: { width: 2, color: theme.series[0], cap: 'round', join: 'round' },
        itemStyle: { color: theme.series[0], borderColor: theme.surface, borderWidth: 2 },
        areaStyle: { color: theme.series[0], opacity: 0.1 },
        emphasis: { focus: 'series' },
        label: lastIndexLabel(theme, last, (index) => formatRate(points[index].rate), 'top'),
      },
    ],
  }
}
