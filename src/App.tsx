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
import { displayAccount } from './lib/account'
import { isSupabaseConfigured, supabase } from './lib/supabase'

interface AccountContext {
  account: string
  active: boolean
  is_admin: boolean
}

type AccessState = 'checking' | 'ready' | 'denied'

export default function App() {
  const { mode, toggleTheme } = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [accessState, setAccessState] = useState<AccessState>('checking')
  const [accountContext, setAccountContext] = useState<AccountContext | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)

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
      setAccessState('checking')
      setAccountContext(null)
      setAccessError(null)
      return
    }

    let active = true
    setAccessState('checking')
    setAccountContext(null)
    setAccessError(null)

    void supabase.rpc('account_context').then(
      ({ data, error }) => {
        if (!active) return
        if (error) {
          setAccessState('denied')
          setAccessError(error.message)
          return
        }

        const value = data as Partial<AccountContext> | null
        if (
          !value ||
          typeof value.active !== 'boolean' ||
          typeof value.is_admin !== 'boolean' ||
          typeof value.account !== 'string'
        ) {
          setAccessState('denied')
          setAccessError('账号状态返回格式错误')
          return
        }

        const context: AccountContext = {
          account: value.account,
          active: value.active,
          is_admin: value.is_admin,
        }
        setAccountContext(context)

        if (!context.active) {
          setAccessState('denied')
          return
        }
        setAccessState('ready')
      },
      (error: unknown) => {
        if (!active) return
        setAccessState('denied')
        setAccessError(error instanceof Error ? error.message : String(error))
      },
    )

    return () => {
      active = false
    }
  }, [session])

  const data = useAttendanceData(
    isSupabaseConfigured && Boolean(session) && accessState === 'ready',
  )

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setAccessState('checking')
    setAccountContext(null)
    setAccessError(null)
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

  if (accessState === 'checking') {
    return <FullPageLoader message="正在验证账号状态…" />
  }

  if (accessState === 'denied') {
    const sessionAccount = displayAccount(session.user.email) || '未知账号'
    return (
      <NoAccessScreen
        mode={mode}
        onToggleTheme={toggleTheme}
        account={accountContext?.account || sessionAccount}
        message={
          accountContext && !accountContext.active
            ? '该账号已被停用，无法查看考勤数据。请联系管理员重新启用。'
            : '无法验证该账号的访问权限，请稍后刷新页面，或联系管理员检查迁移是否已执行。'
        }
        detail={accessError}
        onSignOut={() => void handleSignOut()}
      />
    )
  }

  const sessionAccount = displayAccount(session.user.email) || '成员'

  return (
    <Dashboard
      account={accountContext?.account || sessionAccount}
      isAdmin={accountContext?.is_admin === true}
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
