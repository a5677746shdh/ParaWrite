import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useTranslationStore } from '../store'
import { LanguageSelect } from './LanguageSelect'
import { ResetDialog } from './ResetDialog'
import { restartServer } from '../api'
import appIcon from '../assets/app-icon.png'

const PROVIDER_MODEL_SEP = '::'

const selectClass =
  'h-10 rounded-lg border border-deepl-border bg-white px-3 py-2 text-sm outline-none focus:border-deepl-accent'

function HeaderIconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="invisible h-5 font-medium leading-5" aria-hidden="true">
        —
      </span>
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-deepl-border text-deepl-blue hover:bg-deepl-light"
      >
        {children}
      </button>
    </div>
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

function ResetIcon() {
  return (
    <HeaderIcon>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </HeaderIcon>
  )
}

export function Header() {
  const { t, i18n } = useTranslation()
  const {
    meta,
    sourceLang,
    targetLang,
    provider,
    model,
    setSourceLang,
    setTargetLang,
    swapLanguages,
    setProviderModel,
  } = useTranslationStore(
    useShallow((s) => ({
      meta: s.meta,
      sourceLang: s.sourceLang,
      targetLang: s.targetLang,
      provider: s.provider,
      model: s.model,
      setSourceLang: s.setSourceLang,
      setTargetLang: s.setTargetLang,
      swapLanguages: s.swapLanguages,
      setProviderModel: s.setProviderModel,
    }))
  )

  const [resetOpen, setResetOpen] = useState(false)
  const [restartMessage, setRestartMessage] = useState<string | null>(null)

  const changeUiLang = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('parawrite-ui-lang', lang)
  }

  const providerModelValue = `${provider}${PROVIDER_MODEL_SEP}${model}`

  const providerModelOptions =
    meta?.providers.flatMap((p) =>
      p.models.map((m) => ({
        value: `${p.id}${PROVIDER_MODEL_SEP}${m.id}`,
        label: `${p.id}-${m.name}`,
      }))
    ) ?? []

  const handleProviderModelChange = (value: string) => {
    const [p, m] = value.split(PROVIDER_MODEL_SEP)
    if (p && m) setProviderModel(p, m)
  }

  const handleReloadFrontend = () => {
    window.location.href = `${window.location.pathname}?_r=${Date.now()}`
  }

  const handleRestartBackend = async () => {
    try {
      await restartServer()
      setRestartMessage(t('restartBackendSuccess'))
      setTimeout(() => setRestartMessage(null), 3000)
      setResetOpen(false)
    } catch {
      setRestartMessage(t('restartBackendFailed'))
      setTimeout(() => setRestartMessage(null), 3000)
    }
  }

  return (
    <>
    <header className="w-full border-b border-deepl-border bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex shrink-0 items-center gap-3">
            <img
              src={appIcon}
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
            />

            <HeaderIconButton onClick={swapLanguages} title={t('swapLanguages')}>
              <SwapIcon />
            </HeaderIconButton>

            <LanguageSelect
              label={t('targetLanguage')}
              value={targetLang}
              onChange={setTargetLang}
            />

            {meta && providerModelOptions.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-deepl-blue/70">{t('providerModel')}</span>
                <select
                  value={providerModelValue}
                  onChange={(e) => handleProviderModelChange(e.target.value)}
                  className={selectClass}
                >
                  {providerModelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex shrink-0 items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-deepl-blue/70">{t('uiLanguage')}</span>
                <select
                  value={i18n.language}
                  onChange={(e) => changeUiLang(e.target.value)}
                  className={selectClass}
                >
                  <option value="en">{t('english')}</option>
                  <option value="zh">{t('chinese')}</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setResetOpen(true)}
                title={t('reset')}
                aria-label={t('reset')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-deepl-border text-deepl-blue hover:bg-deepl-light"
              >
                <ResetIcon />
              </button>
            </div>
          </div>
        </div>
        {restartMessage && (
          <p className="pb-2 text-center text-sm text-deepl-accent">{restartMessage}</p>
        )}
      </header>

      <ResetDialog
        open={resetOpen}
        version={meta?.version ?? '0.1.0'}
        runtimeEnv={meta?.runtimeEnv}
        onClose={() => setResetOpen(false)}
        onReloadFrontend={handleReloadFrontend}
        onRestartBackend={handleRestartBackend}
      />
    </>
  )
}
