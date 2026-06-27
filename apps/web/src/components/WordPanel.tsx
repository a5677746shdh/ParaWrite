import { memo, useCallback, useEffect, useRef, useState, useMemo, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { diffHighlight } from '@parawrite/core/client'
import type {
  DictionaryEntry,
  RephraseOption,
  SynonymOption,
} from '@parawrite/core/client'
import { translateText } from '../api'
import { optionChipClass, optionListButtonClass, modalCloseButtonClass, paneIconButtonClass } from '../ui'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { PanelLoader } from './PanelLoader'

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
  batchPreviewVisible: boolean
  batchPreview: string | null
  batchPreviewLoading: boolean
  onApply: (text: string) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const clearHoverPreview = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
    setPreview(null)
    setPreviewLoading(false)
  }, [])

  useEffect(() => () => clearHoverPreview(), [clearHoverPreview])

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

    if (abortRef.current || preview) return

    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null
      const controller = new AbortController()
      abortRef.current = controller
      setPreviewLoading(true)
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
          if (!controller.signal.aborted) setPreview(text.trim())
        })
        .catch(() => {
          if (!controller.signal.aborted) setPreview(null)
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false)
        })
    }, previewDelayMs)
  }

  const handleMouseLeave = (e: MouseEvent<HTMLLIElement>) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    clearHoverPreview()
  }

  const showHoverPreview = previewEnabled && (previewLoading || preview)

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

export function WordPanel({
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
  isPhraseSelection,
  isLoading,
  onApplySynonym,
  onApplyRephrase,
  onClose,
}: WordPanelProps) {
  const { t } = useTranslation()
  const isOverlay = mode !== 'resident' && visible
  useBodyScrollLock(isOverlay)

  const [batchExpanded, setBatchExpanded] = useState(false)
  const [batchPreviews, setBatchPreviews] = useState<Record<string, string>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const batchAbortRef = useRef<AbortController | null>(null)

  const canBackTranslate =
    !!provider && !!model && !!sourceLang && sourceLang !== 'auto'

  const baselineBackTranslation = useBackTranslationBaseline(
    canBackTranslate && (rephraseHoverPreviewEnabled || batchExpanded),
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

    const controller = new AbortController()
    batchAbortRef.current = controller
    setBatchExpanded(true)
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
  }, [canBackTranslate, rephraseOptions, sourceLang, targetLang, provider, model])

  const toggleBatchBackTranslate = () => {
    if (batchExpanded) {
      collapseBatch()
      return
    }
    expandBatch()
  }

  if (mode !== 'resident' && !visible) return null

  const showHint = mode === 'resident' && !selectedWord && !isLoading
  const showClose = mode !== 'resident'
  const showPanelContent = !!selectedWord || isLoading

  const panelBody = (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-deepl-blue">
          {selectedWord ? `"${selectedWord}"` : t('wordPanelTitle')}
        </h3>
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
                {rephraseOptions.map((opt) => (
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
                    batchPreviewVisible={batchExpanded}
                    batchPreview={batchPreviews[opt.text] ?? null}
                    batchPreviewLoading={batchLoading && !(opt.text in batchPreviews)}
                    onApply={onApplyRephrase}
                  />
                ))}
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

  if (mode === 'sheet') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end overscroll-none bg-black/30"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="flex max-h-[70vh] w-full touch-pan-y flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {panelBody}
        </div>
      </div>
    )
  }

  if (mode === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/30 p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="flex max-h-[80vh] w-full max-w-md touch-pan-y flex-col gap-4 overflow-y-auto overscroll-contain rounded-xl bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {panelBody}
        </div>
      </div>
    )
  }

  return (
    <aside className="flex w-full min-w-0 flex-col gap-4 self-start overflow-hidden rounded-2xl border border-deepl-border bg-white p-4 shadow-sm">
      {panelBody}
    </aside>
  )
}
