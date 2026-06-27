import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { restartServer, logoutUser, clearAccessAuth, updateUserLocale } from '../api'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { UI_LANGUAGES, isUiLanguageCode } from '../i18n/languages'
import { applyUiLanguage } from '../lib/ui-language'
import { useTranslationStore } from '../store'
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
  authRequired?: boolean
  onClose: () => void
  onUiLanguageChange: (lang: string) => void
  onReloadFrontend: () => void
  onRestartSuccess: () => void
  onLogout?: () => void
  onForgetAccessAuth?: () => void
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
  authRequired,
  onClose,
  onUiLanguageChange,
  onReloadFrontend,
  onRestartSuccess,
  onLogout,
  onForgetAccessAuth,
}: ResetDialogProps) {
  const { t } = useTranslation()
  const [totpCode, setTotpCode] = useState('')
  const [restartError, setRestartError] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [forgettingAccess, setForgettingAccess] = useState(false)
  const [rememberingLocale, setRememberingLocale] = useState(false)
  const [localeSaved, setLocaleSaved] = useState(false)
  const setUserLocale = useTranslationStore((s) => s.setUserLocale)

  useEffect(() => {
    setLocaleSaved(false)
  }, [uiLanguage])

  useBodyScrollLock(open)

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
    setLocaleSaved(false)
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

  const handleRememberLocale = async () => {
    if (!userAuthenticated || rememberingLocale || localeSaved) return
    const lang = uiLanguage.split('-')[0]
    if (!isUiLanguageCode(lang)) return

    setRememberingLocale(true)
    try {
      const result = await updateUserLocale(lang)
      if (result.locale) {
        setUserLocale(result.locale)
        applyUiLanguage(result.locale)
        onUiLanguageChange(result.locale)
        setLocaleSaved(true)
      }
    } catch {
      // allow retry on failure
    } finally {
      setRememberingLocale(false)
    }
  }

  const handleForgetAccessAuth = async () => {
    if (forgettingAccess) return
    setForgettingAccess(true)
    try {
      await clearAccessAuth()
      onForgetAccessAuth?.()
      onClose()
    } catch {
      // ignore
    } finally {
      setForgettingAccess(false)
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

  const rememberButtonClass =
    'flex h-10 w-[4.875rem] shrink-0 items-center justify-center rounded-lg border border-deepl-border text-sm text-deepl-blue hover:bg-deepl-light'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/30 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-sm touch-pan-y overflow-y-auto overscroll-contain rounded-xl bg-deepl-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-lg font-semibold text-deepl-blue">
          {t('optionsTitle')}
        </h2>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 shrink-0 p-[11px] text-deepl-muted"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <select
              value={uiLanguage}
              onChange={(e) => onUiLanguageChange(e.target.value)}
              className={selectClass}
              aria-label={t('uiLanguage')}
            >
              {UI_LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            {userAuthenticated && (
              <button
                type="button"
                onClick={() => void handleRememberLocale()}
                disabled={rememberingLocale || localeSaved}
                aria-label={t('rememberUiLanguage')}
                className={clsx(
                  rememberButtonClass,
                  rememberingLocale && 'opacity-50',
                  localeSaved && 'pointer-events-none border-deepl-success/40'
                )}
              >
                {localeSaved ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-deepl-success"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  t('rememberUiLanguage')
                )}
              </button>
            )}
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

          {authRequired && !userAuthenticated && (
            <button
              type="button"
              onClick={() => void handleForgetAccessAuth()}
              disabled={forgettingAccess}
              className={clsx(
                actionButtonClass,
                'border border-deepl-alert text-deepl-alert disabled:opacity-50'
              )}
            >
              {t('forgetAccessAuth')}
            </button>
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
