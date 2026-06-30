import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { verifyAccess } from '../api'
import { textButtonPx } from '../ui'

interface AuthGateProps {
  sessionTtlHours: number
  onAuthenticated: () => void
}

export function AuthGate({ sessionTtlHours, onAuthenticated }: AuthGateProps) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const sessionTtlDays = Math.floor(sessionTtlHours / 24)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!code.trim() || loading) return

    setLoading(true)
    setError(false)
    try {
      await verifyAccess(code.trim(), rememberMe)
      onAuthenticated()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, 6))
    if (error) setError(false)
  }

  const buttonLabel = loading ? t('authVerifying') : error ? t('authInvalidCode') : t('authSubmit')

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-deepl-light p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-deepl-border bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-deepl-blue">{t('authTitle')}</h1>
        <p className="mt-2 text-sm text-deepl-blue/60">{t('authDescription')}</p>

        <label className="mt-5 block text-sm font-medium text-deepl-blue/70">
          {t('authCodeLabel')}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            className={clsx(
              'mt-1 w-full rounded-lg border px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-deepl-accent',
              error ? 'border-deepl-error/40' : 'border-deepl-border'
            )}
            autoFocus
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-sm text-deepl-blue/80">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-deepl-border text-deepl-accent focus:ring-deepl-accent"
          />
          <span>{t('authRememberMe', { days: sessionTtlDays })}</span>
        </label>

        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className={clsx(
            `mt-5 w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 ${textButtonPx}`,
            error
              ? 'bg-deepl-error text-white hover:bg-deepl-error'
              : 'bg-deepl-accent text-white hover:bg-deepl-accent/90'
          )}
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  )
}
