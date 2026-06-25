import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { restartServer, logoutUser } from '../api'
import { textButtonPx } from '../ui'

function formatVersionDisplay(version: string, runtimeEnv?: string): string {
  const displayVersion = version.replace('+', '.')
  return runtimeEnv ? `${displayVersion} ${runtimeEnv}` : displayVersion
}

interface ResetDialogProps {
  open: boolean
  version: string
  runtimeEnv?: string
  uiLanguage: string
  restartAuthRequired?: boolean
  canRestartBackend?: boolean
  userLoginEnabled?: boolean
  userAuthenticated?: boolean
  onClose: () => void
  onUiLanguageChange: (lang: string) => void
  onReloadFrontend: () => void
  onRestartSuccess: () => void
  onLogout?: () => void
}

export function ResetDialog({
  open,
  version,
  runtimeEnv,
  uiLanguage,
  restartAuthRequired,
  canRestartBackend,
  userLoginEnabled,
  userAuthenticated,
  onClose,
  onUiLanguageChange,
  onReloadFrontend,
  onRestartSuccess,
  onLogout,
}: ResetDialogProps) {
  const { t } = useTranslation()
  const [totpCode, setTotpCode] = useState('')
  const [restartError, setRestartError] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  if (!open) return null

  const handleRestart = async () => {
    if (restarting) return
    if (restartAuthRequired && totpCode.length !== 6) return

    setRestarting(true)
    setRestartError(false)
    try {
      await restartServer(restartAuthRequired ? totpCode : undefined)
      setTotpCode('')
      onRestartSuccess()
      onClose()
    } catch {
      setRestartError(true)
    } finally {
      setRestarting(false)
    }
  }

  const handleClose = () => {
    setTotpCode('')
    setRestartError(false)
    onClose()
  }

  const handleTotpChange = (value: string) => {
    setTotpCode(value.replace(/\D/g, '').slice(0, 6))
    if (restartError) setRestartError(false)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutUser()
      onLogout?.()
      onClose()
    } catch {
      // ignore
    } finally {
      setLoggingOut(false)
    }
  }

  const restartLabel = restarting
    ? t('restartBackendRestarting')
    : restartError
      ? t('authInvalidCode')
      : t('restartBackend')

  const actionButtonClass =
    `rounded-lg ${textButtonPx} py-2.5 text-center text-sm hover:bg-deepl-light`

  const selectClass =
    'h-10 flex-1 rounded-lg border border-deepl-border bg-white px-3 py-0 text-sm leading-10 outline-none focus:border-deepl-accent'

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
        <h2 className="mb-4 text-center text-lg font-semibold text-deepl-blue">
          {t('optionsTitle')}
        </h2>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center text-deepl-muted"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <select
              value={uiLanguage}
              onChange={(e) => onUiLanguageChange(e.target.value)}
              className={selectClass}
              aria-label={t('uiLanguage')}
            >
              <option value="en">{t('english')}</option>
              <option value="zh">{t('chinese')}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onReloadFrontend}
            className={clsx(actionButtonClass, 'border border-deepl-border')}
          >
            {t('reloadFrontend')}
          </button>

          {canRestartBackend && (
            <>
              {restartAuthRequired && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-center font-medium text-deepl-blue/70">
                    {t('restartAuthCodeLabel')}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => handleTotpChange(e.target.value)}
                    placeholder="000000"
                    className={clsx(
                      'rounded-lg border px-3 py-2 text-center tracking-widest outline-none focus:border-deepl-accent',
                      restartError ? 'border-deepl-error/40' : 'border-deepl-border'
                    )}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => void handleRestart()}
                disabled={(restartAuthRequired && totpCode.length !== 6) || restarting}
                className={clsx(
                  'rounded-lg py-2.5 text-center text-sm font-medium disabled:opacity-50',
                  textButtonPx,
                  restartError
                    ? 'bg-deepl-error text-white hover:bg-deepl-error'
                    : 'bg-deepl-alert text-white hover:bg-deepl-alert/90'
                )}
              >
                {restartLabel}
              </button>
            </>
          )}

          {userLoginEnabled && userAuthenticated && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className={clsx(
                actionButtonClass,
                'border border-deepl-alert text-deepl-alert disabled:opacity-50'
              )}
            >
              {t('logout')}
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-deepl-muted">
          {formatVersionDisplay(version, runtimeEnv)}
        </p>

        <button
          type="button"
          onClick={handleClose}
          className={clsx(actionButtonClass, 'mt-2 w-full bg-deepl-light hover:bg-deepl-border/50')}
        >
          {t('resetBack')}
        </button>
      </div>
    </div>
  )
}
