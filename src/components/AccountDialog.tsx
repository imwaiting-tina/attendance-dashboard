import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import {
  changeOwnPassword,
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  setAccountDisabled,
  type AccountRole,
  type ManagedAccount,
} from '../lib/accountApi'
import { formatDateTime } from '../lib/format'

interface AccountDialogProps {
  open: boolean
  onClose: () => void
  account: string
  isAdmin: boolean
}

type DialogTab = 'accounts' | 'password'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function AccountDialog({ open, onClose, account, isAdmin }: AccountDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const wasOpenRef = useRef(false)
  const [tab, setTab] = useState<DialogTab>(isAdmin ? 'accounts' : 'password')
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<AccountRole>('member')
  const [creating, setCreating] = useState(false)

  const [resetTarget, setResetTarget] = useState<ManagedAccount | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetting, setResetting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ManagedAccount | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const busy =
    creating || resetting || Boolean(deletingId) || Boolean(togglingId) || changingPassword

  const loadAccounts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingAccounts(true)
    setError(null)
    try {
      setAccounts(await listAccounts())
    } catch (loadError) {
      setError(errorText(loadError))
    } finally {
      if (showLoader) setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()
      if (!wasOpenRef.current) {
        setTab(isAdmin ? 'accounts' : 'password')
        setError(null)
        setSuccess(null)
        setAccounts([])
        setNewUsername('')
        setNewPassword('')
        setNewRole('member')
        setResetTarget(null)
        setResetPassword('')
        setResetConfirm('')
        setDeleteTarget(null)
        setCurrentPassword('')
        setNextPassword('')
        setConfirmPassword('')
        if (isAdmin) void loadAccounts()
      }
    } else if (dialog.open) {
      dialog.close()
    }
    wasOpenRef.current = open
  }, [open, isAdmin, loadAccounts])

  const requestClose = () => {
    if (busy) return
    onClose()
  }

  const showError = (message: string) => {
    setError(message)
    setSuccess(null)
  }

  const showSuccess = (message: string) => {
    setSuccess(message)
    setError(null)
  }

  const switchTab = (nextTab: DialogTab) => {
    if (busy) return
    setTab(nextTab)
    setError(null)
    setSuccess(null)
    setResetTarget(null)
    setDeleteTarget(null)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const username = newUsername.trim().toLowerCase()
    if (!username) {
      showError('请输入账号名')
      return
    }
    if (newPassword.length < 8) {
      showError('初始密码至少 8 位')
      return
    }

    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      await createAccount({ username, password: newPassword, role: newRole })
      showSuccess(
        `账号 ${username} 已创建${newRole === 'admin' ? '（管理员）' : ''}，请把初始密码告知对方。`,
      )
      setNewUsername('')
      setNewPassword('')
      setNewRole('member')
      await loadAccounts(false)
    } catch (createError) {
      setError(errorText(createError))
    } finally {
      setCreating(false)
    }
  }

  const requestReset = (item: ManagedAccount) => {
    setResetTarget(item)
    setResetPassword('')
    setResetConfirm('')
    setDeleteTarget(null)
    setError(null)
    setSuccess(null)
  }

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!resetTarget) return
    if (resetPassword.length < 8) {
      showError('新密码至少 8 位')
      return
    }
    if (resetPassword !== resetConfirm) {
      showError('两次输入的新密码不一致')
      return
    }

    setResetting(true)
    setError(null)
    setSuccess(null)
    try {
      await resetAccountPassword(resetTarget.id, resetPassword)
      showSuccess(`已重置 ${resetTarget.username} 的密码，请把新密码告知对方。`)
      setResetTarget(null)
      setResetPassword('')
      setResetConfirm('')
    } catch (resetError) {
      setError(errorText(resetError))
    } finally {
      setResetting(false)
    }
  }

  const handleToggleDisabled = async (item: ManagedAccount) => {
    const nextDisabled = !item.disabled
    if (
      nextDisabled &&
      !window.confirm(`停用账号 ${item.username} 后，该账号将无法登录，确定继续吗？`)
    ) {
      return
    }

    setTogglingId(item.id)
    setError(null)
    setSuccess(null)
    try {
      await setAccountDisabled(item.id, nextDisabled)
      showSuccess(`已${nextDisabled ? '停用' : '启用'}账号 ${item.username}。`)
      setDeleteTarget(null)
      await loadAccounts(false)
    } catch (toggleError) {
      setError(errorText(toggleError))
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (item: ManagedAccount) => {
    setDeletingId(item.id)
    setError(null)
    setSuccess(null)
    try {
      await deleteAccount(item.id)
      showSuccess(`账号 ${item.username} 已删除。`)
      setDeleteTarget(null)
      if (resetTarget?.id === item.id) setResetTarget(null)
      await loadAccounts(false)
    } catch (deleteError) {
      setError(errorText(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  const handleChangeOwnPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (nextPassword.length < 8) {
      showError('新密码至少 8 位')
      return
    }
    if (nextPassword !== confirmPassword) {
      showError('两次输入的新密码不一致')
      return
    }
    if (currentPassword === nextPassword) {
      showError('新密码不能与当前密码相同')
      return
    }

    setChangingPassword(true)
    setError(null)
    setSuccess(null)
    try {
      await changeOwnPassword(currentPassword, nextPassword)
      showSuccess('密码已修改，下次登录请使用新密码。')
      setCurrentPassword('')
      setNextPassword('')
      setConfirmPassword('')
    } catch (changeError) {
      setError(errorText(changeError))
    } finally {
      setChangingPassword(false)
    }
  }

  const adminCount = useMemo(
    () => accounts.filter((item) => item.role === 'admin' && !item.disabled).length,
    [accounts],
  )

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="account-dialog-title"
      onClose={() => {
        if (wasOpenRef.current) onClose()
      }}
      onCancel={(event) => {
        if (busy) event.preventDefault()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="modal-panel modal-panel-wide account-modal-panel">
        <header className="modal-head">
          <div>
            <h2 id="account-dialog-title">{isAdmin ? '账号设置' : '修改密码'}</h2>
            <p>
              {isAdmin
                ? tab === 'accounts'
                  ? '创建、停用、删除账号，或为成员重置密码。'
                  : '修改当前登录账号的密码。'
                : '修改当前登录账号的密码。'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            disabled={busy}
            aria-label="关闭账号设置窗口"
          >
            <X size={18} />
          </button>
        </header>

        {isAdmin ? (
          <div className="account-tabs" role="tablist" aria-label="账号设置">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'accounts'}
              className={`account-tab ${tab === 'accounts' ? 'is-active' : ''}`}
              onClick={() => switchTab('accounts')}
              disabled={busy}
            >
              <UsersRound size={15} />
              账号管理
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'password'}
              className={`account-tab ${tab === 'password' ? 'is-active' : ''}`}
              onClick={() => switchTab('password')}
              disabled={busy}
            >
              <KeyRound size={15} />
              修改密码
            </button>
          </div>
        ) : null}

        <div className="modal-body">
          {error ? (
            <div className="alert alert-error" role="alert">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          ) : null}
          {success ? (
            <div className="alert alert-success" role="status">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          ) : null}

          {tab === 'accounts' && isAdmin ? (
            <div className="account-tab-panel" role="tabpanel" aria-label="账号管理">
              <form className="account-create-form" onSubmit={handleCreate}>
                <div className="account-section-head">
                  <div>
                    <h3>新建账号</h3>
                    <p>账号创建后立即可以登录，默认只能只读查看仪表盘。</p>
                  </div>
                </div>
                <div className="account-create-grid">
                  <label className="form-field">
                    <span>账号</span>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(event) => setNewUsername(event.target.value)}
                      placeholder="如 zhangsan"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={creating}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span>初始密码（至少 8 位）</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="设置一个初始密码"
                      autoComplete="new-password"
                      disabled={creating}
                      required
                      minLength={8}
                    />
                  </label>
                  <label className="form-field">
                    <span>角色</span>
                    <select
                      value={newRole}
                      onChange={(event) => setNewRole(event.target.value as AccountRole)}
                      disabled={creating}
                    >
                      <option value="member">成员（只读）</option>
                      <option value="admin">管理员</option>
                    </select>
                  </label>
                  <div className="account-create-submit">
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                      {creating ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                      {creating ? '正在创建…' : '创建账号'}
                    </button>
                  </div>
                </div>
                <p className="account-form-hint">
                  账号仅限小写字母、数字、点、下划线或短横线，长度 2–32 位。
                </p>
              </form>

              {resetTarget ? (
                <form className="account-reset-panel" onSubmit={handleResetPassword}>
                  <div className="account-section-head">
                    <div>
                      <h3>重置「{resetTarget.username}」的密码</h3>
                      <p>重置后旧密码立即失效，对方需要使用新密码登录。</p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setResetTarget(null)}
                      disabled={resetting}
                      aria-label="取消重置密码"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="account-reset-grid">
                    <label className="form-field">
                      <span>新密码</span>
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                        placeholder="至少 8 位"
                        autoComplete="new-password"
                        disabled={resetting}
                        required
                        minLength={8}
                        autoFocus
                      />
                    </label>
                    <label className="form-field">
                      <span>确认新密码</span>
                      <input
                        type="password"
                        value={resetConfirm}
                        onChange={(event) => setResetConfirm(event.target.value)}
                        placeholder="再次输入"
                        autoComplete="new-password"
                        disabled={resetting}
                        required
                        minLength={8}
                      />
                    </label>
                    <div className="account-reset-submit">
                      <button type="submit" className="btn btn-primary" disabled={resetting}>
                        {resetting ? (
                          <Loader2 size={15} className="spin" />
                        ) : (
                          <KeyRound size={15} />
                        )}
                        {resetting ? '正在保存…' : '保存新密码'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}

              <div className="account-list-head">
                <div>
                  <h3>全部账号</h3>
                  <p>
                    {loadingAccounts
                      ? '正在读取账号…'
                      : `共 ${accounts.length} 个账号 · ${adminCount} 个可用管理员`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void loadAccounts()}
                  disabled={loadingAccounts || busy}
                >
                  <RefreshCw size={14} className={loadingAccounts ? 'spin' : undefined} />
                  刷新
                </button>
              </div>

              {loadingAccounts && accounts.length === 0 ? (
                <div className="account-loading" role="status">
                  <Loader2 size={20} className="spin" />
                  正在读取账号…
                </div>
              ) : accounts.length === 0 ? (
                <div className="manage-empty">
                  <UsersRound size={22} aria-hidden="true" />
                  <p>还没有可显示的账号。</p>
                </div>
              ) : (
                <div className="table-scroll account-table-scroll">
                  <table className="data-table account-table">
                    <caption className="sr-only">系统登录账号</caption>
                    <thead>
                      <tr>
                        <th scope="col">账号</th>
                        <th scope="col">角色</th>
                        <th scope="col">状态</th>
                        <th scope="col">最近登录</th>
                        <th scope="col">创建时间</th>
                        <th scope="col">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((item) => (
                        <tr key={item.id} className={item.disabled ? 'is-disabled' : undefined}>
                          <th scope="row" className="account-name-cell">
                            <span className="account-name">{item.username}</span>
                            {item.is_self ? <span className="account-self-tag">当前</span> : null}
                          </th>
                          <td>
                            <span className={`account-badge role-${item.role}`}>
                              {item.role === 'admin' ? '管理员' : '成员'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`account-badge ${
                                item.disabled ? 'status-disabled' : 'status-active'
                              }`}
                            >
                              {item.disabled ? '已停用' : '使用中'}
                            </span>
                          </td>
                          <td>{formatDateTime(item.last_sign_in_at)}</td>
                          <td>{formatDateTime(item.created_at)}</td>
                          <td>
                            {deleteTarget?.id === item.id ? (
                              <div className="account-confirm-actions">
                                <span className="confirm-text">删除后账号立即失效</span>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void handleDelete(item)}
                                  disabled={deletingId === item.id}
                                >
                                  {deletingId === item.id ? (
                                    <Loader2 size={14} className="spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                  确认删除
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setDeleteTarget(null)}
                                  disabled={deletingId === item.id}
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div className="account-row-actions">
                                {item.is_self ? (
                                  <span className="account-self-label">当前登录账号</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => requestReset(item)}
                                      disabled={busy}
                                    >
                                      <KeyRound size={14} />
                                      重置密码
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => void handleToggleDisabled(item)}
                                      disabled={busy}
                                    >
                                      {togglingId === item.id ? (
                                        <Loader2 size={14} className="spin" />
                                      ) : item.disabled ? (
                                        <CheckCircle2 size={14} />
                                      ) : (
                                        <Ban size={14} />
                                      )}
                                      {item.disabled ? '启用' : '停用'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm danger-text"
                                      onClick={() => {
                                        setDeleteTarget(item)
                                        setResetTarget(null)
                                      }}
                                      disabled={busy}
                                    >
                                      <Trash2 size={14} />
                                      删除
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="account-tab-panel" role="tabpanel" aria-label="修改密码">
              <div className="account-identity-card">
                <span className="account-identity-icon" aria-hidden="true">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <strong>{account}</strong>
                  <span>{isAdmin ? '管理员账号' : '成员账号'} · 修改后下次登录使用新密码</span>
                </div>
              </div>

              <form className="account-password-form" onSubmit={handleChangeOwnPassword}>
                <label className="form-field">
                  <span>当前密码</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="输入当前密码"
                    autoComplete="current-password"
                    disabled={changingPassword}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>新密码（至少 8 位）</span>
                  <input
                    type="password"
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    placeholder="设置新密码"
                    autoComplete="new-password"
                    disabled={changingPassword}
                    required
                    minLength={8}
                  />
                </label>
                <label className="form-field">
                  <span>确认新密码</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入新密码"
                    autoComplete="new-password"
                    disabled={changingPassword}
                    required
                    minLength={8}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary account-password-submit"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <KeyRound size={15} />
                  )}
                  {changingPassword ? '正在修改…' : '修改密码'}
                </button>
                <p className="account-form-hint">
                  修改密码需要验证当前密码。如果忘记密码，请联系管理员重置。
                </p>
              </form>
            </div>
          )}
        </div>

        <footer className="modal-foot">
          <p className="modal-foot-note">
            {tab === 'accounts' && isAdmin
              ? loadingAccounts
                ? '正在读取账号…'
                : `共 ${accounts.length} 个账号 · 至少保留一个可用的管理员账号`
              : '修改密码后不会退出当前登录'}
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={requestClose}
              disabled={busy}
            >
              关闭
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  )
}
