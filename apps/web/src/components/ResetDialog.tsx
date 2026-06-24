import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { restartServer } from '../api'

function formatVersionDisplay(version: string, runtimeEnv?: string): string {
  const displayVersion = version.replace('+', '.')
  return runtimeEnv ? `${displayVersion} ${runtimeEnv}` : displayVersion
}

interface ResetDialogProps {
  open: boolean
  version: string
  runtimeEnv?: string
  restartAuthRequired?: boolean
  onClose: () => void
  onReloadFrontend: () => void
  onRestartSuccess: () => void
}

export function ResetDialog({
  open,
  version,
  runtimeEnv,
  restartAuthRequired,
  onClose,
  onReloadFrontend,
  onRestartSuccess,
}: ResetDialogProps) {
  const { t } = useTranslation()
  const [totpCode, setTotpCode] = useState('')
  const [restartError, setRestartError] = useState(false)
  const [restarting, setRestarting] = useState(false)

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

  const restartLabel = restarting
    ? t('restartBackendRestarting')
    : restartError
      ? t('authInvalidCode')
      : t('restartBackend')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-deepl-blue">{t('resetTitle')}</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onReloadFrontend}
            className="rounded-lg border border-deepl-border px-4 py-2.5 text-left text-sm hover:bg-deepl-light"
          >
            {t('reloadFrontend')}
          </button>
          {restartAuthRequired && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-deepl-blue/70">{t('restartAuthCodeLabel')}</span>
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
                  restartError ? 'border-red-300' : 'border-deepl-border'
                )}
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => void handleRestart()}
            disabled={(restartAuthRequired && totpCode.length !== 6) || restarting}
            className={clsx(
              'rounded-lg px-4 py-2.5 text-left text-sm font-medium disabled:opacity-50',
              restartError
                ? 'bg-red-500 text-white hover:bg-red-500'
                : 'border border-deepl-border hover:bg-deepl-light'
            )}
          >
            {restartLabel}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-deepl-light px-4 py-2.5 text-sm hover:bg-deepl-border/50"
          >
            {t('resetBack')}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-deepl-blue/50">
          {formatVersionDisplay(version, runtimeEnv)}
        </p>
      </div>
    </div>
  )
}
