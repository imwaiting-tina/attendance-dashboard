import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { AxisPointerComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECElementEvent, EChartsCoreOption, EChartsType } from 'echarts/core'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, AxisPointerComponent, CanvasRenderer])

interface ChartProps {
  option: EChartsCoreOption
  height: number
  ariaLabel: string
  /** 点击数据图元时回传分类名，目前用于部门对比图跳转人员明细 */
  onClick?: (name: string) => void
}

/** 轻量 ECharts 容器：自适应尺寸，主题变化时整体替换配置 */
export function Chart({ option, height, ariaLabel, onClick }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const onClickRef = useRef(onClick)

  useEffect(() => {
    onClickRef.current = onClick
  }, [onClick])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const chart = echarts.init(element, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    chart.setOption({ ...option, animation: !reducedMotion }, { notMerge: true })

    // 点击柱子时 params.name 是 y 轴分类，即部门名称
    const handleClick = (params: ECElementEvent) => {
      if (typeof params.name === 'string') onClickRef.current?.(params.name)
    }
    chart.on('click', handleClick)

    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      chart.off('click', handleClick)
      chart.dispose()
      chartRef.current = null
    }
    // 初始化只执行一次，后续通过下面的 effect 更新配置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  return <div ref={containerRef} className="chart-canvas" style={{ height }} role="img" aria-label={ariaLabel} />
}

export function ChartEmpty({ height, message }: { height: number; message: string }) {
  return (
    <div className="chart-empty" style={{ height }}>
      <span className="chart-empty-dot" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
