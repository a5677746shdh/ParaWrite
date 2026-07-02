import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useTranslationStore } from '../store'
import {
  buildProviderModelOptions,
  formatProviderModelValue,
  parseProviderModelValue,
} from '../lib/provider-model-select'
import { formSelectClass } from '../ui'

interface LookupModelDialogProps {
  open: boolean
  onClose: () => void
}

export function LookupModelDialog({ open, onClose }: LookupModelDialogProps) {
  const { t } = useTranslation()
  const { meta, lookupProvider, lookupModel, setLookupProviderModel } = useTranslationStore(
    useShallow((s) => ({
      meta: s.meta,
      lookupProvider: s.lookupProvider,
      lookupModel: s.lookupModel,
      setLookupProviderModel: s.setLookupProviderModel,
    }))
  )

  const savedValue = formatProviderModelValue(lookupProvider, lookupModel)
  const [draftValue, setDraftValue] = useState(savedValue)

  useEffect(() => {
    if (open) setDraftValue(savedValue)
  }, [open, savedValue])

  useBodyScrollLock(open)

  const showProvider = meta?.showProviderInModelSelect ?? true
  const options = useMemo(
    () => (meta ? buildProviderModelOptions(meta.providers, showProvider) : []),
    [meta, showProvider]
  )

  if (!open || !meta) return null

  const labelKey = showProvider ? 'providerModel' : 'model'
  const dirty = draftValue !== savedValue

  const handleClose = () => {
    if (dirty) {
      const parsed = parseProviderModelValue(draftValue)
      if (parsed) setLookupProviderModel(parsed.provider, parsed.model)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/30 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm touch-pan-y overscroll-contain rounded-xl bg-deepl-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-lg font-semibold text-deepl-blue">
          {t('lookupSettings')}
        </h2>

        {options.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-deepl-blue/70">{t(labelKey)}</span>
            <select
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              className={formSelectClass}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-center text-sm text-deepl-muted">{t('noResults')}</p>
        )}

        <button
          type="button"
          onClick={handleClose}
          className={clsx(
            'mt-4 w-full rounded-lg py-2.5 text-center text-sm',
            dirty
              ? 'bg-deepl-accent font-medium text-white hover:bg-deepl-accent/90'
              : 'bg-deepl-light text-deepl-blue hover:bg-deepl-border/50'
          )}
        >
          {dirty ? t('confirm') : t('resetBack')}
        </button>
      </div>
    </div>
  )
}
