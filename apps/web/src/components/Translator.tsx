import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  detectSelectionGranularity,
  detectTextLanguage,
  extractSentenceByWord,
  replaceTokenRange,
  resolveLayoutMode,
  resolveRephraseTarget,
  segmentText,
  splitAlternatives,
  countWordsInRange,
  type AlternativesSeparator,
  type LayoutMode,
  type SelectionGranularity,
} from '@parawrite/core/client'
import {
  fetchDictionaryContext,
  fetchRephrase,
  fetchSynonyms,
  streamTranslate,
} from '../api'
import { useTranslationStore } from '../store'
import { TextStats } from './TextStats'
import { TokenEditor } from './TokenEditor'
import { WordPanel } from './WordPanel'

const DEFAULT_BREAKPOINTS = {
  threeColumnMinWidth: 1280,
  twoColumnMinWidth: 768,
}

export function Translator() {
  const { t, i18n } = useTranslation()
  const {
    meta,
    sourceLang,
    targetLang,
    provider,
    model,
    sourceText,
    targetText,
    isTranslating,
    isStreaming,
    error,
    selectedWord,
    selectedRange,
    selectionGranularity,
    synonyms,
    dictionary,
    rephraseOptions,
    rephraseOriginalSentence,
    isPanelLoading,
    setSourceText,
    setTargetText,
    setDetectedSourceLang,
    appendTargetText,
    setTranslating,
    setStreaming,
    setError,
    setSelection,
    setSynonyms,
    setDictionary,
    setRephraseOptions,
    setPanelLoading,
    clear,
  } = useTranslationStore()

  const [copied, setCopied] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('twoColumn')
  const abortRef = useRef<AbortController | null>(null)
  const autoTranslateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTranslateRef = useRef<() => Promise<void>>(async () => {})
  const prevSourceForAutoRef = useRef<string | null>(null)
  const streamBufferRef = useRef('')
  const streamRafRef = useRef<number | null>(null)

  const breakpoints = meta?.layoutBreakpoints ?? DEFAULT_BREAKPOINTS

  const flushStreamBuffer = useCallback(() => {
    const pending = streamBufferRef.current
    if (!pending) return
    streamBufferRef.current = ''
    appendTargetText(pending)
  }, [appendTargetText])

  const onStreamChunk = useCallback(
    (chunk: string) => {
      streamBufferRef.current += chunk
      if (streamRafRef.current === null) {
        streamRafRef.current = requestAnimationFrame(() => {
          streamRafRef.current = null
          flushStreamBuffer()
        })
      }
    },
    [flushStreamBuffer]
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const updateLayout = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setLayoutMode(resolveLayoutMode(window.innerWidth, breakpoints))
      }, 150)
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('resize', updateLayout)
    }
  }, [breakpoints])

  useEffect(() => {
    if (sourceLang !== 'auto') return

    if (!sourceText.trim()) {
      setDetectedSourceLang(null)
      return
    }

    const timer = setTimeout(() => {
      setDetectedSourceLang(detectTextLanguage(sourceText))
    }, 300)

    return () => clearTimeout(timer)
  }, [sourceText, sourceLang, setDetectedSourceLang])

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || !provider || !model) return

    if (autoTranslateTimer.current) {
      clearTimeout(autoTranslateTimer.current)
      autoTranslateTimer.current = null
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setTranslating(true)
    setStreaming(true)
    setError(null)
    setTargetText('')
    setSelection(null, null)
    setRephraseOptions([])

    try {
      await streamTranslate(
        {
          text: sourceText,
          sourceLang,
          targetLang,
          provider,
          model,
        },
        onStreamChunk,
        controller.signal
      )
      flushStreamBuffer()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      if (streamRafRef.current !== null) {
        cancelAnimationFrame(streamRafRef.current)
        streamRafRef.current = null
      }
      flushStreamBuffer()
      setTranslating(false)
      setStreaming(false)
    }
  }, [
    sourceText,
    provider,
    model,
    sourceLang,
    targetLang,
    setTranslating,
    setStreaming,
    setError,
    setTargetText,
    setSelection,
    setRephraseOptions,
    onStreamChunk,
    flushStreamBuffer,
  ])

  handleTranslateRef.current = handleTranslate

  const translateOnEnter = meta?.translateOnEnter ?? false

  const handleSourceKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (translateOnEnter) {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        void handleTranslate()
      }
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleTranslate()
    }
  }

  const resolveAlternativesSeparator = (): AlternativesSeparator => {
    const separators = meta?.alternativesSeparators
    if (!separators) return 'comma'
    return separators.byLanguage[targetLang] ?? separators.default ?? 'comma'
  }

  useEffect(() => {
    const delay = meta?.autoTranslateDelaySeconds ?? 0
    if (autoTranslateTimer.current) {
      clearTimeout(autoTranslateTimer.current)
      autoTranslateTimer.current = null
    }

    if (delay <= 0 || !sourceText.trim() || !provider || !model) return

    const sourceChanged = prevSourceForAutoRef.current !== sourceText
    prevSourceForAutoRef.current = sourceText

    if (!sourceChanged) {
      return
    }

    autoTranslateTimer.current = setTimeout(() => {
      handleTranslateRef.current()
    }, delay * 1000)

    return () => {
      if (autoTranslateTimer.current) {
        clearTimeout(autoTranslateTimer.current)
      }
    }
  }, [sourceText, meta?.autoTranslateDelaySeconds, provider, model])

  const selectedWordCount = useMemo(() => {
    if (!selectedRange || !targetText) return 0
    return countWordsInRange(segmentText(targetText, targetLang), selectedRange)
  }, [selectedRange, targetText, targetLang])

  const phraseWordThreshold = useMemo(() => {
    const thresholds = meta?.phraseWordThresholds
    if (!thresholds) return 1
    return thresholds.byLanguage[targetLang] ?? thresholds.default
  }, [meta?.phraseWordThresholds, targetLang])

  const isPhraseSelection = selectedWordCount > phraseWordThreshold

  const loadWordData = async (
    word: string,
    range: { start: number; end: number },
    forcedGranularity?: SelectionGranularity
  ) => {
    const granularity = forcedGranularity ?? detectSelectionGranularity(word, targetText)
    setSelection(word, range, granularity)
    setPanelLoading(true)
    setSynonyms([])
    setDictionary(null)
    setRephraseOptions([])

    const sentence = extractSentenceByWord(targetText, word, targetLang)
    const rephraseTarget = resolveRephraseTarget(
      word,
      targetText,
      targetLang,
      granularity
    )
    const uiLang = i18n.language.startsWith('zh') ? 'zh' : 'en'
    const wordCount = countWordsInRange(segmentText(targetText, targetLang), range)
    const threshold =
      meta?.phraseWordThresholds?.byLanguage[targetLang] ??
      meta?.phraseWordThresholds?.default ??
      1
    const isPhrase = wordCount > threshold

    try {
      const [syns, dict, rephrase] = await Promise.all([
        isPhrase
          ? Promise.resolve([])
          : fetchSynonyms({
              word,
              sentence,
              sourceText,
              sourceLang,
              targetLang,
              provider,
              model,
            }),
        isPhrase
          ? Promise.resolve(null)
          : fetchDictionaryContext({
              word,
              sentence,
              sourceText,
              sourceLang,
              targetLang,
              uiLang,
              provider,
              model,
            }),
        fetchRephrase({
          sentence: rephraseTarget,
          sourceText,
          fullTranslation: targetText,
          sourceLang,
          targetLang,
          provider,
          model,
        }),
      ])
      setSynonyms(syns)
      setDictionary(dict)
      const rephraseTexts =
        granularity === 'sentence'
          ? splitAlternatives(
              rephrase.map((r) => r.text),
              resolveAlternativesSeparator()
            )
          : rephrase.map((r) => r.text.trim()).filter(Boolean)
      setRephraseOptions(
        [...new Set(rephraseTexts)].map((text) => ({ text })),
        rephraseTarget
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPanelLoading(false)
    }
  }

  const handleConsecutiveWordSelect = (word: string, range: { start: number; end: number }) => {
    void loadWordData(word, range, 'word')
  }

  const clearSelection = () => {
    setSelection(null, null)
    setSynonyms([])
    setDictionary(null)
    setRephraseOptions([])
  }

  const applySynonym = (replacement: string) => {
    if (!selectedRange) return
    const segments = segmentText(targetText, targetLang)
    const newText = replaceTokenRange(
      targetText,
      segments,
      selectedRange.start,
      selectedRange.end,
      replacement
    )
    setTargetText(newText)
    setSelection(replacement, selectedRange)
  }

  const applyRephrase = (text: string) => {
    if (!selectedWord) return
    const granularity = selectionGranularity ?? 'word'
    const replaceTarget = resolveRephraseTarget(
      selectedWord,
      targetText,
      targetLang,
      granularity
    )
    const newText = targetText.replace(replaceTarget, text)
    setTargetText(newText === targetText ? text : newText)
    setRephraseOptions([])
    setSelection(null, null)
  }

  const copyText = async () => {
    if (!targetText || copied) return
    await navigator.clipboard.writeText(targetText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const speak = () => {
    if (!targetText || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(targetText)
    utterance.lang = targetLang === 'zh' ? 'zh-CN' : targetLang
    window.speechSynthesis.speak(utterance)
  }

  const isThreeColumn = layoutMode === 'threeColumn'
  const isStacked = layoutMode === 'stacked'

  const panelMode = isThreeColumn ? 'resident' : isStacked ? 'sheet' : 'modal'
  const panelVisible = isThreeColumn || !!selectedWord || isPanelLoading

  const paneClass = 'relative flex h-full min-h-0 w-full min-w-0 flex-col p-4'
  const paneFooterClass =
    'mt-auto flex w-full items-center justify-between gap-3 border-t border-transparent pt-3'

  const sourcePane = (
    <section
      className={clsx(
        paneClass,
        isStacked && 'border-b border-deepl-border'
      )}
    >
      <div className="min-h-[6rem] w-full flex-1">
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          onKeyDown={handleSourceKeyDown}
          placeholder={t('sourcePlaceholder')}
          rows={Math.max(3, sourceText.split('\n').length)}
          className="h-full min-h-[6rem] w-full resize-none border-0 bg-transparent text-lg leading-relaxed text-deepl-blue outline-none [field-sizing:content]"
        />
      </div>
      <div className={paneFooterClass}>
        <TextStats text={sourceText} lang={sourceLang} />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating || !sourceText.trim()}
            className="rounded-lg bg-deepl-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-deepl-accent/90 disabled:opacity-50"
          >
            {isTranslating ? t('translating') : t('translate')}
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-deepl-border bg-white px-3 py-1.5 text-sm hover:bg-deepl-light"
          >
            {t('clear')}
          </button>
        </div>
      </div>
    </section>
  )

  const targetPane = (
    <section className={paneClass}>
      <div className="min-h-[6rem] w-full flex-1">
        <TokenEditor
          text={targetText}
          lang={targetLang}
          isStreaming={isStreaming}
          selectedRange={selectedRange}
          selectionGranularity={selectionGranularity}
          onTokenClick={loadWordData}
          onConsecutiveWordSelect={handleConsecutiveWordSelect}
          onPhraseSelect={loadWordData}
          placeholder={t('targetPlaceholder')}
        />
      </div>
      <div className={paneFooterClass}>
        <TextStats text={targetText} lang={targetLang} />
        <div className="flex shrink-0 gap-2">
          {selectedWordCount >= 2 && (
            <button
              type="button"
              onClick={clearSelection}
              title={t('clearSelection')}
              aria-label={t('clearSelection')}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-deepl-border bg-white hover:bg-deepl-light"
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={copyText}
            disabled={!targetText || copied}
            title={copied ? t('copied') : t('copy')}
            aria-label={copied ? t('copied') : t('copy')}
            className={clsx(
              'flex h-[34px] min-w-[54px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50',
              copied
                ? 'border-green-200 bg-green-50 text-green-600'
                : 'border-deepl-border bg-white hover:bg-deepl-light'
            )}
          >
            {copied ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              t('copy')
            )}
          </button>
          <button
            type="button"
            onClick={speak}
            disabled={!targetText}
            className="rounded-lg border border-deepl-border bg-white px-3 py-1.5 text-sm hover:bg-deepl-light disabled:opacity-50"
          >
            {t('speak')}
          </button>
        </div>
      </div>
    </section>
  )

  const translationCard = (
    <div className="w-full overflow-hidden rounded-2xl border border-deepl-border bg-white shadow-sm">
      <div
        className={clsx(
          'grid w-full items-stretch',
          isStacked ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]'
        )}
      >
        {sourcePane}
        {!isStacked && (
          <div className="w-px self-stretch bg-deepl-border" aria-hidden="true" />
        )}
        {targetPane}
      </div>
    </div>
  )

  const wordPanelProps = {
    selectedWord,
    synonyms,
    dictionary,
    rephraseOptions,
    rephraseOriginalSentence,
    targetLang,
    isPhraseSelection,
    isLoading: isPanelLoading,
    onApplySynonym: applySynonym,
    onApplyRephrase: applyRephrase,
    onClose: () => setSelection(null, null),
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      {isThreeColumn ? (
        <div className="grid w-full grid-cols-[1fr_minmax(260px,320px)] items-start gap-4">
          {translationCard}
          <WordPanel mode="resident" visible {...wordPanelProps} />
        </div>
      ) : (
        translationCard
      )}

      {!isThreeColumn && (
        <WordPanel
          mode={panelMode}
          visible={panelVisible}
          {...wordPanelProps}
        />
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('error')}: {error}
        </p>
      )}
    </main>
  )
}
