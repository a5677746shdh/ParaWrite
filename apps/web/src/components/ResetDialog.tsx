import { useTranslation } from 'react-i18next'

function formatVersionDisplay(version: string, runtimeEnv?: string): string {
  const displayVersion = version.replace('+', '.')
  return runtimeEnv ? `${displayVersion} ${runtimeEnv}` : displayVersion
}

interface ResetDialogProps {
  open: boolean
  version: string
  runtimeEnv?: string
  onClose: () => void
  onReloadFrontend: () => void
  onRestartBackend: () => void
}

export function ResetDialog({
  open,
  version,
  runtimeEnv,
  onClose,
  onReloadFrontend,
  onRestartBackend,
}: ResetDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
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
          <button
            type="button"
            onClick={onRestartBackend}
            className="rounded-lg border border-deepl-border px-4 py-2.5 text-left text-sm hover:bg-deepl-light"
          >
            {t('restartBackend')}
          </button>
          <button
            type="button"
            onClick={onClose}
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
