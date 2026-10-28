import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import {
  FullPageLoader,
  LoginScreen,
  NoAccessScreen,
  SetupScreen,
} from './components/AuthScreens'
import { Dashboard } from './components/Dashboard'
import { useAttendanceData } from './hooks/useAttendanceData'
import { useTheme } from './hooks/useTheme'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type AdminState = 'checking' | 'allowed' | 'denied'

export default function App() {
  const { mode, toggleTheme } = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [adminState, setAdminState] = useState<AdminState>('checking')
  const [adminError, setAdminError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setAuthReady(true)
      })
      .catch(() => {
        if (active) setAuthReady(true)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setAdminState('checking')
      setAdminError(null)
      return
    }

    let active = true
    setAdminState('checking')
    setAdminError(null)

    void supabase.rpc('is_admin').then(
      ({ data, error }) => {
        if (!active) return
        if (error) {
          setAdminState('denied')
          setAdminError(error.message)
          return
        }
        setAdminState(data === true ? 'allowed' : 'denied')
      },
      (error: unknown) => {
        if (!active) return
        setAdminState('denied')
        setAdminError(error instanceof Error ? error.message : String(error))
      },
    )

    return () => {
      active = false
    }
  }, [session])

  const data = useAttendanceData(
    isSupabaseConfigured && Boolean(session) && adminState === 'allowed',
  )

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setAdminState('checking')
    setAdminError(null)
  }

  if (!isSupabaseConfigured) {
    return <SetupScreen mode={mode} onToggleTheme={toggleTheme} />
  }

  if (!authReady) {
    return <FullPageLoader message="正在初始化…" />
  }

  if (!session) {
    return <LoginScreen mode={mode} onToggleTheme={toggleTheme} />
  }

  if (adminState === 'checking') {
    return <FullPageLoader message="正在验证管理员权限…" />
  }

  if (adminState === 'denied') {
    return (
      <NoAccessScreen
        mode={mode}
        onToggleTheme={toggleTheme}
        email={session.user.email ?? '未知账号'}
        detail={adminError}
        onSignOut={() => void handleSignOut()}
      />
    )
  }

  return (
    <Dashboard
      email={session.user.email ?? '管理员'}
      records={data.records}
      periods={data.periods}
      loading={data.loading}
      refreshing={data.refreshing}
      error={data.error}
      mode={mode}
      onToggleTheme={toggleTheme}
      onSignOut={() => void handleSignOut()}
      reload={data.reload}
    />
  )
}
