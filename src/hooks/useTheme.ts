import { useEffect, useState } from 'react'
import type { ThemeMode } from '../lib/theme'

const STORAGE_KEY = 'attendance-dashboard-theme'

function getInitialMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // 隐私模式下 localStorage 可能不可用
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme(): { mode: ThemeMode; toggleTheme: () => void } {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
    const themeColor = mode === 'dark' ? '#0d0d0d' : '#f9f9f7'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // 忽略存储失败
    }
  }, [mode])

  return {
    mode,
    toggleTheme: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
  }
}
