import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AttendancePeriod, AttendanceRecord } from '../lib/types'

const PAGE_SIZE = 1000

interface AttendanceDataState {
  periods: AttendancePeriod[]
  records: AttendanceRecord[]
  loading: boolean
  refreshing: boolean
  error: string | null
  reload: () => Promise<void>
}

/** 登录后拉取全部月份和记录；PostgREST 单次上限 1000 行，按页取完 */
export function useAttendanceData(enabled: boolean): AttendanceDataState {
  const [periods, setPeriods] = useState<AttendancePeriod[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const hasLoadedRef = useRef(false)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('尚未配置 Supabase 环境变量')
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (hasLoadedRef.current) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const periodResult = await supabase
        .from('attendance_periods')
        .select('*')
        .order('month', { ascending: true })

      if (periodResult.error) throw new Error(periodResult.error.message)

      const allRecords: AttendanceRecord[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const result = await supabase
          .from('attendance_records')
          .select('*')
          .order('month', { ascending: true })
          .order('employee_key', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (result.error) throw new Error(result.error.message)
        const page = (result.data ?? []) as AttendanceRecord[]
        allRecords.push(...page)
        if (page.length < PAGE_SIZE) break
      }

      if (requestId !== requestIdRef.current) return
      setPeriods((periodResult.data ?? []) as AttendancePeriod[])
      setRecords(allRecords)
      hasLoadedRef.current = true
      setHasLoaded(true)
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setError(message)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  return {
    periods,
    records,
    // 启用后首次请求发出前也视为加载中，避免闪过“还没有数据”的空状态
    loading: loading || (enabled && !hasLoaded && !error),
    refreshing,
    error,
    reload: load,
  }
}
