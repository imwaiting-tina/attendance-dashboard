import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ChartColumn,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { accountToEmail } from '../lib/account'
import { supabase } from '../lib/supabase'
import type { ThemeMode } from '../lib/theme'

interface ThemeProps {
  mode: ThemeMode
  onToggleTheme: () => void
}

function ThemeToggle({ mode, onToggleTheme }: ThemeProps) {
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={onToggleTheme}
      title={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      aria-label={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
    >
      {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function AuthShell({ mode, onToggleTheme, children }: ThemeProps & { children: ReactNode }) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ChartColumn size={19} strokeWidth={2.2} />
          </span>
          <div className="brand-text">
            <h1>考勤汇总仪表盘</h1>
            <p>Attendance overview</p>
          </div>
        </div>
        <ThemeToggle mode={mode} onToggleTheme={onToggleTheme} />
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">数据仅对管理员开放 · 导入记录保存在私有 Supabase 项目中</footer>
    </div>
  )
}

function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return '账号或密码错误'
  if (/email not confirmed/i.test(message)) return '账号尚未确认，请先在 Supabase 中确认账号'
  if (/failed to fetch|networkerror|network error/i.test(message)) return '无法连接 Supabase，请检查网络或项目地址'
  if (/rate limit|too many requests/i.test(message)) return '尝试次数过多，请稍后再试'
  return `登录失败：${message}`
}

export function LoginScreen({ mode, onToggleTheme }: ThemeProps) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: accountToEmail(account),
      password,
    })
    if (signInError) setError(translateAuthError(signInError.message))
    setLoading(false)
  }

  return (
    <AuthShell mode={mode} onToggleTheme={onToggleTheme}>
      <div className="auth-card card">
        <span className="auth-badge">
          <ShieldCheck size={14} />
          管理员入口
        </span>
        <h2>欢迎回来</h2>
        <p className="auth-lead">登录后查看月度趋势、部门汇总，并导入新的考勤表。</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>账号</span>
            <input
              type="text"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="tina"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
            />
          </label>
          <label className="form-field">
            <span>密码</span>
            <span className="password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入密码"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error ? (
            <div className="alert alert-error" role="alert">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : null}
            {loading ? '正在登录…' : '登录'}
          </button>
        </form>

        <p className="auth-note">系统不开放注册，账号由管理员在 Supabase 中创建。</p>
      </div>
    </AuthShell>
  )
}

export function SetupScreen({ mode, onToggleTheme }: ThemeProps) {
  return (
    <AuthShell mode={mode} onToggleTheme={onToggleTheme}>
      <div className="auth-card card setup-card">
        <span className="auth-badge">
          <CircleAlert size={14} />
          尚未配置
        </span>
        <h2>还差一步：连接 Supabase</h2>
        <p className="auth-lead">
          在项目根目录创建 <code>.env.local</code>，填入 Supabase 项目的 URL 与 anon key，然后重启开发服务器。
        </p>
        <pre className="code-block">
          {`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="auth-note">
          GitHub Pages 部署时，请把同名变量写入仓库的 Actions secrets。anon key 可以公开，但业务数据受 RLS 与管理员名单保护。
        </p>
      </div>
    </AuthShell>
  )
}

interface NoAccessProps extends ThemeProps {
  account: string
  onSignOut: () => void
  detail?: string | null
}

export function NoAccessScreen({ mode, onToggleTheme, account, onSignOut, detail }: NoAccessProps) {
  return (
    <AuthShell mode={mode} onToggleTheme={onToggleTheme}>
      <div className="auth-card card setup-card">
        <span className="auth-badge auth-badge-warning">
          <ShieldCheck size={14} />
          权限不足
        </span>
        <h2>该账号不是管理员</h2>
        <p className="auth-lead">
          当前登录账号 <strong>{account}</strong> 不在管理员名单中，无法查看或导入考勤数据。
        </p>
        {detail ? <p className="auth-detail">权限检查返回：{detail}</p> : null}
        <button type="button" className="btn btn-secondary" onClick={onSignOut}>
          <LogOut size={16} />
          退出并更换账号
        </button>
      </div>
    </AuthShell>
  )
}

export function FullPageLoader({ message = '正在加载…' }: { message?: string }) {
  return (
    <div className="fullpage-loader" role="status">
      <Loader2 size={26} className="spin" />
      <span>{message}</span>
    </div>
  )
}
