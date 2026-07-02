import { memo, useCallback, useEffect, useRef, useState, useMemo, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { diffHighlight } from '@parawrite/core/client'
import type {
  DictionaryEntry,
  RephraseBackTranslationPreload,
  RephraseOption,
  SynonymOption,
} from '@parawrite/core/client'
import { translateText } from '../api'
import { optionChipClass, optionListButtonClass, modalCloseButtonClass, paneIconButtonClass } from '../ui'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { PanelLoader } from './PanelLoader'
import { LookupModelDialog } from './LookupModelDialog'
import { RobotIcon } from '../icons/RobotIcon'
import { useTranslationStore } from '../store'

interface WordPanelProps {
  mode: 'resident' | 'modal' | 'sheet'
  visible: boolean
  selectedWord: string | null
  synonyms: SynonymOption[]
  dictionary: DictionaryEntry | null
  rephraseOptions: RephraseOption[]
  rephraseOriginalSentence: string | null
  sourceLang: string
  targetLang: string
  provider: string | null
  model: string | null
  rephraseHoverPreviewEnabled: boolean
  rephraseHoverPreviewDelayMs: number
  rephraseBackTranslationPreload: RephraseBackTranslationPreload
  isPhraseSelection: boolean
  isLoading: boolean
  onApplySynonym: (word: string) => void
  onApplyRephrase: (text: string) => void
  onClose: () => void
}

const HighlightedAlternative = memo(function HighlightedAlternative({
  original,
  alternative,
  lang,
}: {
  original: string
  alternative: string
  lang: string
}) {
  const parts = useMemo(
    () => diffHighlight(original, alternative, lang),
    [original, alternative, lang]
  )
  return (
    <>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark
            key={index}
            className="rounded bg-amber-100 px-0.5 text-deepl-blue not-italic"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  )
})

function useBackTranslationBaseline(
  enabled: boolean,
  phrase: string | null,
  sourceLang: string,
  targetLang: string,
  provider: string | null,
  model: string | null
): string | null {
  const [baseline, setBaseline] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !phrase?.trim() || !provider || !model || !sourceLang || sourceLang === 'auto') {
      setBaseline(null)
      return
    }

    const controller = new AbortController()
    void translateText(
      {
        text: phrase,
        sourceLang: targetLang,
        targetLang: sourceLang,
        provider,
        model,
      },
      controller.signal
    )
      .then((text) => {
        if (!controller.signal.aborted) setBaseline(text.trim())
      })
      .catch(() => {
        if (!controller.signal.aborted) setBaseline(null)
      })

    return () => controller.abort()
  }, [enabled, phrase, sourceLang, targetLang, provider, model])

  return baseline
}

const BACK_TRANSLATION_PREFETCH_CONCURRENCY = 3

function useRephraseBackTranslationCache({
  mode,
  enabled,
  options,
  sourceLang,
  targetLang,
  provider,
  model,
  panelReady,
}: {
  mode: RephraseBackTranslationPreload
  enabled: boolean
  options: RephraseOption[]
  sourceLang: string
  targetLang: string
  provider: string | null
  model: string | null
  panelReady: boolean
}) {
  const [cache, setCache] = useState<Record<string, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(() => new Set())
  const cacheRef = useRef<Record<string, string>>({})
  const loadingKeysRef = useRef<Set<string>>(new Set())
  const inflightRef = useRef<Map<string, AbortController>>(new Map())
  const pendingRef = useRef<string[]>([])
  const activeCountRef = useRef(0)

  const optionsKey = options.map((opt) => opt.text).join('\0')

  useEffect(() => {
    inflightRef.current.forEach((controller) => controller.abort())
    inflightRef.current.clear()
    pendingRef.current = []
    activeCountRef.current = 0
    cacheRef.current = {}
    loadingKeysRef.current = new Set()
    setCache({})
    setLoadingKeys(new Set())
  }, [optionsKey, sourceLang, targetLang, provider, model])

  const runPrefetch = useCallback(
    (text: string) => {
      if (!provider || !model || !sourceLang || sourceLang === 'auto') return

      const controller = new AbortController()
      inflightRef.current.set(text, controller)

      void translateText(
        {
          text,
          sourceLang: targetLang,
          targetLang: sourceLang,
          provider,
          model,
        },
        controller.signal
      )
        .then((result) => {
          if (controller.signal.aborted) return
          const trimmed = result.trim()
          cacheRef.current = { ...cacheRef.current, [text]: trimmed }
          setCache((prev) => ({ ...prev, [text]: trimmed }))
        })
        .catch(() => {
          if (controller.signal.aborted) return
          cacheRef.current = { ...cacheRef.current, [text]: '' }
          setCache((prev) => ({ ...prev, [text]: '' }))
        })
        .finally(() => {
          inflightRef.current.delete(text)
          activeCountRef.current = Math.max(0, activeCountRef.current - 1)
          if (!controller.signal.aborted) {
            const next = new Set(loadingKeysRef.current)
            next.delete(text)
            loadingKeysRef.current = next
            setLoadingKeys(next)
          }
          while (
            activeCountRef.current < BACK_TRANSLATION_PREFETCH_CONCURRENCY &&
            pendingRef.current.length > 0
          ) {
            const nextText = pendingRef.current.shift()!
            if (nextText in cacheRef.current || inflightRef.current.has(nextText)) continue
            activeCountRef.current++
            runPrefetch(nextText)
          }
        })
    },
    [sourceLang, targetLang, provider, model]
  )

  const prefetch = useCallback(
    (text: string) => {
      if (!enabled || mode === 'off' || !text.trim() || !provider || !model) return
      if (text in cacheRef.current || inflightRef.current.has(text)) return
      if (pendingRef.current.includes(text)) return
      if (!sourceLang || sourceLang === 'auto') return

      loadingKeysRef.current = new Set(loadingKeysRef.current).add(text)
      setLoadingKeys(loadingKeysRef.current)

      if (activeCountRef.current >= BACK_TRANSLATION_PREFETCH_CONCURRENCY) {
        pendingRef.current.push(text)
        return
      }

      activeCountRef.current++
      runPrefetch(text)
    },
    [enabled, mode, sourceLang, targetLang, provider, model, runPrefetch]
  )

  useEffect(() => {
    if (mode !== 'all' || !panelReady || !enabled) return
    for (const opt of options) {
      prefetch(opt.text)
    }
  }, [mode, panelReady, enabled, options, prefetch])

  return { cache, loadingKeys, prefetch }
}

const BackTranslationArrow = memo(function BackTranslationArrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-deepl-muted"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
})

const BatchBackTranslateIcon = memo(function BatchBackTranslateIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M714.3 251.9c-130.6 0-237.4 102.5-245 231.2h-0.7v43.3c0 87.7-71.3 159-159 159s-159-71.3-159-159c0-87.6 71.3-158.9 158.9-158.9v72.2l173.4-115.6-173.3-115.6v72.3C174.2 280.8 64 391 64 526.5s110.2 245.7 245.7 245.7c130.6 0 237.4-102.5 245-231.2h0.7v-43.4c0-87.7 71.3-159 159-159s159 71.3 159 159c0 87.6-71.3 158.9-159 158.9v-72.3L540.9 699.9l173.4 115.6v-72.3C849.8 743.2 960 633 960 497.6c0-135.5-110.2-245.7-245.7-245.7" />
    </svg>
  )
})

/** One line of `text-sm leading-relaxed` — arrow and loader align to this height. */
const backTranslationLineClass = 'h-[1.625em]'

const BackTranslationPreview = memo(function BackTranslationPreview({
  loading,
  preview,
  baselineBackTranslation,
  sourceLang,
}: {
  loading: boolean
  preview: string | null
  baselineBackTranslation: string | null
  sourceLang: string
}) {
  if (!loading && !preview) return null

  return (
    <div className="mt-1 flex gap-1.5 text-sm leading-relaxed text-deepl-muted">
      <div
        className={`flex w-3.5 shrink-0 items-center justify-center self-start ${backTranslationLineClass}`}
      >
        <BackTranslationArrow />
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className={`flex items-center ${backTranslationLineClass}`}>
            <PanelLoader />
          </div>
        ) : preview && baselineBackTranslation ? (
          <HighlightedAlternative
            original={baselineBackTranslation}
            alternative={preview}
            lang={sourceLang}
          />
        ) : (
          preview
        )}
      </div>
    </div>
  )
})

const RephraseOptionRow = memo(function RephraseOptionRow({
  opt,
  originalTarget,
  baselineBackTranslation,
  sourceLang,
  targetLang,
  provider,
  model,
  previewEnabled,
  previewDelayMs,
  preloadMode,
  preloadedPreview,
  preloadLoading,
  onPrefetch,
  batchPreviewVisible,
  batchPreview,
  batchPreviewLoading,
  onApply,
}: {
  opt: RephraseOption
  originalTarget: string | null
  baselineBackTranslation: string | null
  sourceLang: string
  targetLang: string
  provider: string | null
  model: string | null
  previewEnabled: boolean
  previewDelayMs: number
  preloadMode: RephraseBackTranslationPreload
  preloadedPreview: string | null
  preloadLoading: boolean
  onPrefetch: (text: string) => void
  batchPreviewVisible: boolean
  batchPreview: string | null
  batchPreviewLoading: boolean
  onApply: (text: string) => void
}) {
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [localPreviewLoading, setLocalPreviewLoading] = useState(false)
  const [hoverPreviewVisible, setHoverPreviewVisible] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const usesPreloadCache = preloadMode !== 'off'

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const clearOffModeFetch = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLocalPreview(null)
    setLocalPreviewLoading(false)
  }, [])

  const clearHoverPreview = useCallback(() => {
    clearHoverTimer()
    setHoverPreviewVisible(false)
    if (!usesPreloadCache) {
      clearOffModeFetch()
    }
  }, [clearHoverTimer, clearOffModeFetch, usesPreloadCache])

  useEffect(() => () => clearHoverPreview(), [clearHoverPreview])

  const scheduleHoverPreview = useCallback(
    (delayMs: number) => {
      clearHoverTimer()
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null
        setHoverPreviewVisible(true)
      }, delayMs)
    },
    [clearHoverTimer]
  )

  const handleMouseEnter = () => {
    if (
      !previewEnabled ||
      !provider ||
      !model ||
      !sourceLang ||
      sourceLang === 'auto'
    ) {
      return
    }

    if (usesPreloadCache) {
      onPrefetch(opt.text)
      scheduleHoverPreview(previewDelayMs)
      return
    }

    if (abortRef.current || localPreview) return

    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null
      const controller = new AbortController()
      abortRef.current = controller
      setLocalPreviewLoading(true)
      void translateText(
        {
          text: opt.text,
          sourceLang: targetLang,
          targetLang: sourceLang,
          provider,
          model,
        },
        controller.signal
      )
        .then((text) => {
          if (!controller.signal.aborted) setLocalPreview(text.trim())
        })
        .catch(() => {
          if (!controller.signal.aborted) setLocalPreview(null)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLocalPreviewLoading(false)
        })
    }, previewDelayMs)
  }

  const handleMouseLeave = (e: MouseEvent<HTMLLIElement>) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    clearHoverPreview()
  }

  const preview = usesPreloadCache ? preloadedPreview : localPreview
  const previewLoading = usesPreloadCache ? preloadLoading : localPreviewLoading
  const showHoverPreview = usesPreloadCache
    ? previewEnabled && hoverPreviewVisible && (previewLoading || !!preview)
    : previewEnabled && (previewLoading || !!preview)

  return (
    <li
      className="rounded-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => onApply(opt.text)}
        className={optionListButtonClass}
      >
        {originalTarget ? (
          <HighlightedAlternative
            original={originalTarget}
            alternative={opt.text}
            lang={targetLang}
          />
        ) : (
          opt.text
        )}
        {opt.style && (
          <span className="ml-2 text-xs text-deepl-blue/50">{opt.style}</span>
        )}
      </button>
      {showHoverPreview && (
        <BackTranslationPreview
          loading={previewLoading}
          preview={preview}
          baselineBackTranslation={baselineBackTranslation}
          sourceLang={sourceLang}
        />
      )}
      {batchPreviewVisible && (
        <BackTranslationPreview
          loading={batchPreviewLoading}
          preview={batchPreview}
          baselineBackTranslation={baselineBackTranslation}
          sourceLang={sourceLang}
        />
      )}
    </li>
  )
})

export const WordPanel = memo(function WordPanel({
  mode,
  visible,
  selectedWord,
  synonyms,
  dictionary,
  rephraseOptions,
  rephraseOriginalSentence,
  sourceLang,
  targetLang,
  provider,
  model,
  rephraseHoverPreviewEnabled,
  rephraseHoverPreviewDelayMs,
  rephraseBackTranslationPreload,
  isPhraseSelection,
  isLoading,
  onApplySynonym,
  onApplyRephrase,
  onClose,
}: WordPanelProps) {
  const { t } = useTranslation()
  const showLookupSettings = useTranslationStore(
    (s) => (s.meta?.enableLookupModelSelect ?? true) && (s.meta?.providers.length ?? 0) > 0
  )
  const [lookupModelOpen, setLookupModelOpen] = useState(false)
  const isOverlay = mode !== 'resident' && visible
  useBodyScrollLock(isOverlay)

  const [batchExpanded, setBatchExpanded] = useState(false)
  const [batchPreviews, setBatchPreviews] = useState<Record<string, string>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const [partialBaselineActive, setPartialBaselineActive] = useState(false)
  const partialBaselineActiveRef = useRef(false)
  const batchAbortRef = useRef<AbortController | null>(null)

  const canBackTranslate =
    !!provider && !!model && !!sourceLang && sourceLang !== 'auto'

  const rephrasePanelReady =
    canBackTranslate && !isLoading && rephraseOptions.length > 0

  const { cache: backTranslationCache, loadingKeys: backTranslationLoading, prefetch } =
    useRephraseBackTranslationCache({
    mode: rephraseBackTranslationPreload,
    enabled: canBackTranslate,
    options: rephraseOptions,
    sourceLang,
    targetLang,
    provider,
    model,
    panelReady: rephrasePanelReady,
  })

  const requestPartialBaseline = useCallback(() => {
    if (partialBaselineActiveRef.current) return
    partialBaselineActiveRef.current = true
    setPartialBaselineActive(true)
  }, [])

  const prefetchBackTranslation = useCallback(
    (text: string) => {
      if (rephraseBackTranslationPreload === 'partial') {
        requestPartialBaseline()
      }
      prefetch(text)
    },
    [rephraseBackTranslationPreload, prefetch, requestPartialBaseline]
  )

  const baselineBackTranslation = useBackTranslationBaseline(
    canBackTranslate &&
      (batchExpanded ||
        (rephraseBackTranslationPreload === 'all' && rephrasePanelReady) ||
        (rephraseBackTranslationPreload === 'partial' && partialBaselineActive) ||
        (rephraseBackTranslationPreload === 'off' && rephraseHoverPreviewEnabled)),
    rephraseOriginalSentence,
    sourceLang,
    targetLang,
    provider,
    model
  )

  useEffect(() => {
    setBatchExpanded(false)
    setBatchPreviews({})
    setBatchLoading(false)
    partialBaselineActiveRef.current = false
    setPartialBaselineActive(false)
    batchAbortRef.current?.abort()
    batchAbortRef.current = null
  }, [rephraseOptions, rephraseOriginalSentence])

  useEffect(
    () => () => {
      batchAbortRef.current?.abort()
    },
    []
  )

  const collapseBatch = useCallback(() => {
    batchAbortRef.current?.abort()
    batchAbortRef.current = null
    setBatchExpanded(false)
    setBatchPreviews({})
    setBatchLoading(false)
  }, [])

  const expandBatch = useCallback(() => {
    if (!canBackTranslate || rephraseOptions.length === 0) return

    setBatchExpanded(true)

    if (rephraseBackTranslationPreload === 'all') {
      return
    }

    if (rephraseBackTranslationPreload === 'partial') {
      requestPartialBaseline()
      for (const opt of rephraseOptions) {
        prefetch(opt.text)
      }
      return
    }

    const controller = new AbortController()
    batchAbortRef.current = controller
    setBatchPreviews({})
    setBatchLoading(true)

    void Promise.allSettled(
      rephraseOptions.map((opt) =>
        translateText(
          {
            text: opt.text,
            sourceLang: targetLang,
            targetLang: sourceLang,
            provider: provider!,
            model: model!,
          },
          controller.signal
        ).then((text) => ({ key: opt.text, text: text.trim() }))
      )
    ).then((results) => {
      if (controller.signal.aborted) return
      const next: Record<string, string> = {}
      for (const result of results) {
        if (result.status === 'fulfilled') {
          next[result.value.key] = result.value.text
        }
      }
      setBatchPreviews(next)
      setBatchLoading(false)
    })
  }, [
    canBackTranslate,
    rephraseOptions,
    rephraseBackTranslationPreload,
    prefetch,
    requestPartialBaseline,
    sourceLang,
    targetLang,
    provider,
    model,
  ])

  const toggleBatchBackTranslate = () => {
    if (batchExpanded) {
      collapseBatch()
      return
    }
    expandBatch()
  }

  if (mode !== 'resident' && !visible) return null

  const lookupModelDialog = (
    <LookupModelDialog open={lookupModelOpen} onClose={() => setLookupModelOpen(false)} />
  )

  const showHint = mode === 'resident' && !selectedWord && !isLoading
  const showClose = mode !== 'resident'
  const showPanelContent = !!selectedWord || isLoading
  const lookupInHeader = mode === 'resident'

  const lookupSettingsButton = showLookupSettings ? (
    <button
      type="button"
      onClick={() => setLookupModelOpen(true)}
      title={t('lookupSettings')}
      aria-label={t('lookupSettings')}
      className={paneIconButtonClass}
    >
      <RobotIcon />
    </button>
  ) : null

  const panelBody = (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-deepl-blue">
          {selectedWord ? `"${selectedWord}"` : t('wordPanelTitle')}
        </h3>
        <div className="flex items-center gap-2">
          {lookupInHeader && lookupSettingsButton}
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              title={t('close')}
              aria-label={t('close')}
              className={modalCloseButtonClass}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {showHint ? (
        <p className="text-sm leading-relaxed text-deepl-blue/60">{t('panelHint')}</p>
      ) : showPanelContent ? (
        <>
          {!isPhraseSelection && (
            <section>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deepl-blue/60">
                {t('synonyms')}
              </h4>
              {synonyms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {synonyms.map((syn) => (
                    <button
                      key={syn.word}
                      type="button"
                      onClick={() => onApplySynonym(syn.word)}
                      className={optionChipClass}
                      title={syn.note}
                    >
                      {syn.word}
                    </button>
                  ))}
                </div>
              ) : isLoading ? (
                <PanelLoader />
              ) : (
                <p className="text-sm text-deepl-blue/50">{t('noResults')}</p>
              )}
            </section>
          )}

          {!isPhraseSelection && (
            <section>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deepl-blue/60">
                {t('dictionary')}
              </h4>
              {dictionary && dictionary.meanings.length > 0 ? (
                <>
                  {dictionary.phonetic && (
                    <p className="mb-2 text-sm text-deepl-blue/70">/{dictionary.phonetic}/</p>
                  )}
                  <ul className="space-y-2 text-sm">
                    {dictionary.meanings.map((m, i) => (
                      <li key={i}>
                        {m.partOfSpeech && (
                          <span className="mr-2 rounded bg-deepl-light px-1.5 py-0.5 text-xs">
                            {m.partOfSpeech}
                          </span>
                        )}
                        <span>{m.definition}</span>
                        {m.example && (
                          <p className="mt-1 text-deepl-blue/60 italic">{m.example}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : isLoading ? (
                <PanelLoader />
              ) : (
                <p className="text-sm text-deepl-blue/50">{t('noResults')}</p>
              )}
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-deepl-blue/60">
                {t('alternatives')}
              </h4>
              {canBackTranslate && rephraseOptions.length > 0 && (
                <button
                  type="button"
                  onClick={toggleBatchBackTranslate}
                  title={
                    batchExpanded
                      ? t('rephraseBatchCollapse')
                      : t('rephraseBatchBackTranslate')
                  }
                  aria-label={
                    batchExpanded
                      ? t('rephraseBatchCollapse')
                      : t('rephraseBatchBackTranslate')
                  }
                  className={clsx(
                    paneIconButtonClass,
                    batchExpanded &&
                      'border-deepl-accent bg-deepl-accent/10 text-deepl-accent'
                  )}
                >
                  <BatchBackTranslateIcon />
                </button>
              )}
            </div>
            {rephraseOptions.length > 0 ? (
              <ul className="space-y-1.5">
                {rephraseOptions.map((opt) => {
                  const cached = opt.text in backTranslationCache ? backTranslationCache[opt.text] : undefined
                  const preloadedPreview = cached === undefined ? null : cached || null
                  const preloadLoading = backTranslationLoading.has(opt.text)
                  const useSharedCache = rephraseBackTranslationPreload !== 'off'

                  return (
                  <RephraseOptionRow
                    key={opt.text}
                    opt={opt}
                    originalTarget={rephraseOriginalSentence}
                    baselineBackTranslation={baselineBackTranslation}
                    sourceLang={sourceLang}
                    targetLang={targetLang}
                    provider={provider}
                    model={model}
                    previewEnabled={rephraseHoverPreviewEnabled && !batchExpanded}
                    previewDelayMs={rephraseHoverPreviewDelayMs}
                    preloadMode={rephraseBackTranslationPreload}
                    preloadedPreview={preloadedPreview}
                    preloadLoading={preloadLoading}
                    onPrefetch={prefetchBackTranslation}
                    batchPreviewVisible={batchExpanded}
                    batchPreview={
                      useSharedCache ? preloadedPreview : (batchPreviews[opt.text] ?? null)
                    }
                    batchPreviewLoading={
                      useSharedCache
                        ? preloadLoading && cached === undefined
                        : batchLoading && !(opt.text in batchPreviews)
                    }
                    onApply={onApplyRephrase}
                  />
                  )
                })}
              </ul>
            ) : isLoading ? (
              <PanelLoader />
            ) : (
              <p className="text-sm text-deepl-blue/50">{t('noResults')}</p>
            )}
          </section>
        </>
      ) : null}
    </>
  )

  const overlayPanelContent = (
    <>
      <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-4 pb-14 touch-pan-y">
        {panelBody}
      </div>
      {lookupSettingsButton && (
        <div className="absolute bottom-4 right-4 z-10">{lookupSettingsButton}</div>
      )}
    </>
  )

  if (mode === 'sheet') {
    return (
      <>
        <div
          className="fixed inset-0 z-50 flex items-end overscroll-none bg-black/30"
          onClick={onClose}
          role="presentation"
        >
          <div
            className="relative flex max-h-[70vh] w-full flex-col rounded-t-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {overlayPanelContent}
          </div>
        </div>
        {lookupModelDialog}
      </>
    )
  }

  if (mode === 'modal') {
    return (
      <>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/30 p-4"
          onClick={onClose}
          role="presentation"
        >
          <div
            className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {overlayPanelContent}
          </div>
        </div>
        {lookupModelDialog}
      </>
    )
  }

  return (
    <>
      <aside className="flex w-full min-w-0 flex-col gap-4 self-start overflow-hidden rounded-2xl border border-deepl-border bg-white p-4 shadow-sm">
        {panelBody}
      </aside>
      {lookupModelDialog}
    </>
  )
})
