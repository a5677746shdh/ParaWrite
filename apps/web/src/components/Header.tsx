import { useState, useRef, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useTranslationStore } from '../store'
import { LanguageSelect } from './LanguageSelect'
import { ResetDialog } from './ResetDialog'
import { AutoSwapIcon } from '../icons/AutoSwapIcon'
import { formSelectClass, headerIconButtonClass } from '../ui'
import {
  buildProviderModelOptions,
  formatProviderModelValue,
  parseProviderModelValue,
} from '../lib/provider-model-select'
import { getTranslationModelLabelKey } from '../lib/translation-model-label'

const PROVIDER_SELECT_MIN_WIDTH = 120
const PROVIDER_SELECT_MAX_WIDTH = 320

function HeaderIconButton({
  onClick,
  title,
  disabled = false,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={headerIconButtonClass}
    >
      {children}
    </button>
  )
}

function HeaderIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function SwapIcon() {
  return (
    <HeaderIcon>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </HeaderIcon>
  )
}

function SettingsIcon() {
  return (
    <HeaderIcon>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </HeaderIcon>
  )
}

export function Header() {
  const { t, i18n } = useTranslation()
  const {
    meta,
    sourceLang,
    targetLang,
    detectedSourceLang,
    provider,
    model,
    lookupProvider,
    lookupModel,
    setSourceLang,
    setTargetLang,
    swapLanguages,
    setProviderModel,
  } = useTranslationStore(
    useShallow((s) => ({
      meta: s.meta,
      sourceLang: s.sourceLang,
      targetLang: s.targetLang,
      detectedSourceLang: s.detectedSourceLang,
      provider: s.provider,
      model: s.model,
      lookupProvider: s.lookupProvider,
      lookupModel: s.lookupModel,
      setSourceLang: s.setSourceLang,
      setTargetLang: s.setTargetLang,
      swapLanguages: s.swapLanguages,
      setProviderModel: s.setProviderModel,
    }))
  )

  const canSwapLanguages =
    meta?.autoSwapLanguages ||
    sourceLang !== 'auto' ||
    Boolean(detectedSourceLang)

  const [optionsOpen, setOptionsOpen] = useState(false)
  const [restartMessage, setRestartMessage] = useState<string | null>(null)
  const refreshMeta = useTranslationStore((s) => s.refreshMeta)

  const changeUiLang = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('parawrite-ui-lang', lang)
  }

  const providerModelValue = formatProviderModelValue(provider, model)
  const showProviderInSelect = meta?.showProviderInModelSelect ?? true
  const showTranslateModelSelect = meta?.enableTranslateModelSelect ?? true

  const providerModelOptions = useMemo(
    () => (meta ? buildProviderModelOptions(meta.providers, showProviderInSelect) : []),
    [meta, showProviderInSelect]
  )

  const providerModelLabel =
    providerModelOptions.find((o) => o.value === providerModelValue)?.label ?? ''

  const providerModelLabelKey = useMemo(
    () =>
      meta
        ? getTranslationModelLabelKey(meta, provider, model, lookupProvider, lookupModel)
        : 'model',
    [meta, provider, model, lookupProvider, lookupModel]
  )

  const providerMeasureRef = useRef<HTMLSpanElement>(null)
  const [providerSelectWidth, setProviderSelectWidth] = useState(PROVIDER_SELECT_MIN_WIDTH)

  useLayoutEffect(() => {
    const el = providerMeasureRef.current
    if (!el) return
    const contentWidth = el.offsetWidth
    const chromeWidth = 36 + 24
    setProviderSelectWidth(
      Math.min(
        PROVIDER_SELECT_MAX_WIDTH,
        Math.max(PROVIDER_SELECT_MIN_WIDTH, contentWidth + chromeWidth)
      )
    )
  }, [providerModelLabel, providerModelOptions])

  const handleProviderModelChange = (value: string) => {
    const parsed = parseProviderModelValue(value)
    if (parsed) setProviderModel(parsed.provider, parsed.model)
  }

  const handleReloadFrontend = () => {
    window.location.href = `${window.location.pathname}?_r=${Date.now()}`
  }

  const handleRestartSuccess = () => {
    setRestartMessage(t('restartBackendSuccess'))
    setTimeout(() => setRestartMessage(null), 3000)
  }

  return (
    <>
    <header className="w-full border-b border-deepl-border bg-deepl-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex shrink-0 items-center gap-3">
            <img
              src="/icons/app-icon.png"
              alt="ParaWrite"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-2xl font-bold text-deepl-blue">{t('appName')}</h1>
              <p className="text-sm text-deepl-blue/60">{t('tagline')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <LanguageSelect
              label={t('sourceLanguage')}
              value={sourceLang}
              onChange={setSourceLang}
              allowAuto
              languageOrder={meta?.languageOrder}
            />

            <HeaderIconButton
              onClick={swapLanguages}
              title={t('swapLanguages')}
              disabled={!canSwapLanguages}
            >
              {meta?.autoSwapLanguages ? <AutoSwapIcon /> : <SwapIcon />}
            </HeaderIconButton>

            <LanguageSelect
              label={t('targetLanguage')}
              value={targetLang}
              onChange={setTargetLang}
              languageOrder={meta?.targetLanguageOrder}
            />

            <div className="flex shrink-0 items-end gap-2">
              {meta && showTranslateModelSelect && providerModelOptions.length > 0 && (
                <label className="relative flex flex-col gap-1 text-sm">
                  <span className="font-medium text-deepl-blue/70">{t(providerModelLabelKey)}</span>
                  <span
                    ref={providerMeasureRef}
                    aria-hidden
                    className="pointer-events-none invisible absolute whitespace-nowrap text-base leading-10"
                  >
                    {providerModelLabel}
                  </span>
                  <select
                    value={providerModelValue}
                    onChange={(e) => handleProviderModelChange(e.target.value)}
                    className={formSelectClass}
                    style={{ width: providerSelectWidth }}
                  >
                    {providerModelOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <HeaderIconButton
                onClick={() => setOptionsOpen(true)}
                title={t('settings')}
              >
                <SettingsIcon />
              </HeaderIconButton>
            </div>
          </div>
        </div>
        {restartMessage && (
          <p className="pb-2 text-center text-sm text-deepl-accent">{restartMessage}</p>
        )}
      </header>

      <ResetDialog
        open={optionsOpen}
        version={meta?.version ?? '0.1.0'}
        runtimeEnv={meta?.runtimeEnv}
        uiLanguage={i18n.language}
        restartAuthRequired={meta?.restartAuthRequired}
        canRestartBackend={meta?.canRestartBackend}
        userLoginEnabled={meta?.userLogin?.enabled}
        userAuthenticated={meta?.userLogin?.authenticated}
        authRequired={meta?.authRequired}
        onClose={() => setOptionsOpen(false)}
        onUiLanguageChange={changeUiLang}
        onReloadFrontend={handleReloadFrontend}
        onRestartSuccess={handleRestartSuccess}
        onLogout={() => void refreshMeta()}
        onForgetAccessAuth={() => void refreshMeta()}
      />
    </>
  )
}
