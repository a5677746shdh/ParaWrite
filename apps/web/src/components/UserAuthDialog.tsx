import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { loginUser, registerUser } from '../api'
import { textButtonPx } from '../ui'

interface UserAuthDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  sessionTtlHours?: number
  defaultTab?: 'login' | 'register'
}

export function UserAuthDialog({
  open,
  onClose,
  onSuccess,
  sessionTtlHours = 168,
  defaultTab = 'login',
}: UserAuthDialogProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sessionTtlDays = Math.floor(sessionTtlHours / 24)

  if (!open) return null

  const resetForm = () => {
    setUsername('')
    setPassword('')
    setNickname('')
    setRememberMe(false)
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || !username.trim() || !password) return

    setLoading(true)
    setError(null)
    try {
      if (tab === 'login') {
        await loginUser({ username: username.trim(), password, rememberMe })
      } else {
        await registerUser({
          username: username.trim(),
          password,
          nickname: nickname.trim() || undefined,
        })
      }
      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      setError((err as Error).message || t('userAuthError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-deepl-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-deepl-blue">{t('userAuthTitle')}</h2>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('login')
              setError(null)
            }}
            className={clsx(
              `flex-1 rounded-lg py-2 text-sm font-medium ${textButtonPx}`,
              tab === 'login'
                ? 'bg-deepl-accent text-white'
                : 'border border-deepl-border bg-white hover:bg-deepl-light'
            )}
          >
            {t('userAuthLoginTab')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register')
              setError(null)
            }}
            className={clsx(
              `flex-1 rounded-lg py-2 text-sm font-medium ${textButtonPx}`,
              tab === 'register'
                ? 'bg-deepl-accent text-white'
                : 'border border-deepl-border bg-white hover:bg-deepl-light'
            )}
          >
            {t('userAuthRegisterTab')}
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-deepl-blue/70">{t('userAuthUsername')}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="rounded-lg border border-deepl-border px-3 py-2 outline-none focus:border-deepl-accent"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-deepl-blue/70">{t('userAuthPassword')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="rounded-lg border border-deepl-border px-3 py-2 outline-none focus:border-deepl-accent"
            />
          </label>

          {tab === 'register' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-deepl-blue/70">{t('userAuthNickname')}</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
                className="rounded-lg border border-deepl-border px-3 py-2 outline-none focus:border-deepl-accent"
              />
            </label>
          )}

          {tab === 'login' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-deepl-blue/80">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-deepl-border text-deepl-accent focus:ring-deepl-accent"
              />
              <span>{t('userAuthRememberMe', { days: sessionTtlDays })}</span>
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-deepl-error/30 bg-deepl-error/10 px-3 py-2 text-sm text-deepl-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className={clsx('rounded-lg bg-deepl-accent py-2.5 text-sm font-medium text-white hover:bg-deepl-accent/90 disabled:opacity-50', textButtonPx)}
          >
            {tab === 'login' ? t('userAuthSubmitLogin') : t('userAuthSubmitRegister')}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className={clsx('rounded-lg bg-deepl-light py-2.5 text-sm hover:bg-deepl-border/50', textButtonPx)}
          >
            {t('resetBack')}
          </button>
        </form>
      </div>
    </div>
  )
}
