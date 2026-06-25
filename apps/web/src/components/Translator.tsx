import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import clsx from 'clsx'
import {
  combineTextFromRange,
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
  saveHistory,
  streamTranslate,
} from '../api'
import { copyWithExecCommand, canUseClipboardApi } from '../clipboard'
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea'
import { useTranslationStore } from '../store'
import { TextStats } from './TextStats'
import { TokenEditor } from './TokenEditor'
import { WordPanel } from './WordPanel'
import { HistoryPanel } from './HistoryPanel'
import { textButtonPx, paneIconButtonClass, speakActiveButtonClass, wordSelectionCancelButtonClass } from '../ui'

/** Responsive breakpoints from meta.layout or defaults; drives three-column / modal / sheet word panel. */
const DEFAULT_BREAKPOINTS = {
  threeColumnMinWidth: 1280,
  twoColumnMinWidth: 768,
}

/** Wait for idle after multi-word selection before synonym/dictionary requests. */
const WORD_FETCH_DEBOUNCE_MS = 400

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
  } = useTranslationStore(
    useShallow((s) => ({
      meta: s.meta,
      sourceLang: s.sourceLang,
      targetLang: s.targetLang,
      provider: s.provider,
      model: s.model,
      sourceText: s.sourceText,
      targetText: s.targetText,
      isTranslating: s.isTranslating,
      isStreaming: s.isStreaming,
      error: s.error,
      selectedWord: s.selectedWord,
      selectedRange: s.selectedRange,
      selectionGranularity: s.selectionGranularity,
      synonyms: s.synonyms,
      dictionary: s.dictionary,
      rephraseOptions: s.rephraseOptions,
      rephraseOriginalSentence: s.rephraseOriginalSentence,
      isPanelLoading: s.isPanelLoading,
    }))
  )
  const {
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
    bumpHistoryRefresh,
  } = useTranslationStore(
    useShallow((s) => ({
      setSourceText: s.setSourceText,
      setTargetText: s.setTargetText,
      setDetectedSourceLang: s.setDetectedSourceLang,
      appendTargetText: s.appendTargetText,
      setTranslating: s.setTranslating,
      setStreaming: s.setStreaming,
      setError: s.setError,
      setSelection: s.setSelection,
      setSynonyms: s.setSynonyms,
      setDictionary: s.setDictionary,
      setRephraseOptions: s.setRephraseOptions,
      setPanelLoading: s.setPanelLoading,
      clear: s.clear,
      bumpHistoryRefresh: s.bumpHistoryRefresh,
    }))
  )

  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [wordPanelRequested, setWordPanelRequested] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('twoColumn')
  const abortRef = useRef<AbortController | null>(null)
  const panelAbortRef = useRef<AbortController | null>(null)
  const wordFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      // Batch DOM updates to one append per animation frame during SSE streaming.
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

    cancelScheduledWordFetch()
    panelAbortRef.current?.abort()
    setWordPanelRequested(false)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setTranslating(true)
    setStreaming(true)
    setError(null)
    setTargetText('')
    setSelection(null, null)
    setRephraseOptions([])

    let translatedFull = ''
    let saveSucceeded = false

    const captureChunk = (chunk: string) => {
      translatedFull += chunk
      onStreamChunk(chunk)
    }

    try {
      await streamTranslate(
        {
          text: sourceText,
          sourceLang,
          targetLang,
          provider,
          model,
        },
        captureChunk,
        controller.signal
      )
      flushStreamBuffer()
      saveSucceeded = true
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

      if (
        saveSucceeded &&
        meta?.userLogin?.enabled &&
        meta.userLogin.authenticated &&
        translatedFull.trim()
      ) {
        void saveHistory({
          sourceText,
          targetText: translatedFull,
          sourceLang,
          targetLang,
        })
          .then(() => bumpHistoryRefresh())
          .catch(() => {})
      }
    }
  }, [
    sourceText,
    provider,
    model,
    sourceLang,
    targetLang,
    meta,
    setTranslating,
    setStreaming,
    setError,
    setTargetText,
    setSelection,
    setRephraseOptions,
    onStreamChunk,
    flushStreamBuffer,
    bumpHistoryRefresh,
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

  const targetSegments = useMemo(
    () => segmentText(targetText, targetLang),
    [targetText, targetLang]
  )

  const selectedWordCount = useMemo(() => {
    if (!selectedRange || !targetText) return 0
    return countWordsInRange(targetSegments, selectedRange)
  }, [selectedRange, targetText, targetSegments])

  const phraseWordThreshold = useMemo(() => {
    const thresholds = meta?.phraseWordThresholds
    if (!thresholds) return 1
    return thresholds.byLanguage[targetLang] ?? thresholds.default
  }, [meta?.phraseWordThresholds, targetLang])

  const isPhraseSelection = selectedWordCount > phraseWordThreshold

  const selectionCopyEnabled = meta?.selectionCopyEnabled ?? false

  const isManualLookup = useMemo(() => {
    const mode = meta?.wordLookupMode ?? 'adaptive'
    if (mode === 'manual') return true
    if (mode === 'immediate') return false
    return layoutMode !== 'threeColumn'
  }, [meta?.wordLookupMode, layoutMode])

  const selectedText = useMemo(() => {
    if (!selectedRange) return ''
    return combineTextFromRange(targetSegments, selectedRange).trim()
  }, [selectedRange, targetSegments])

  const canCopySelection =
    selectionCopyEnabled && selectedWordCount >= 2 && !!selectedText

  const abortPanelFetch = () => {
    panelAbortRef.current?.abort()
    panelAbortRef.current = null
  }

  const fetchWordData = async (
    word: string,
    range: { start: number; end: number },
    forcedGranularity?: SelectionGranularity
  ) => {
    abortPanelFetch()
    const controller = new AbortController()
    panelAbortRef.current = controller
    const { signal } = controller

    const granularity = forcedGranularity ?? detectSelectionGranularity(word, targetText)
    setSelection(word, range, granularity)
    setPanelLoading(true)
    setSynonyms([])
    setDictionary(null)

    const sentence = extractSentenceByWord(targetText, word, targetLang)
    const rephraseTarget = resolveRephraseTarget(
      word,
      targetText,
      targetLang,
      granularity
    )
    setRephraseOptions([], rephraseTarget)
    const uiLang = i18n.language.startsWith('zh') ? 'zh' : 'en'
    const wordCount = countWordsInRange(targetSegments, range)
    const threshold =
      meta?.phraseWordThresholds?.byLanguage[targetLang] ??
      meta?.phraseWordThresholds?.default ??
      1
    const isPhrase = wordCount > threshold

    const sharedParams = {
      sourceText,
      sourceLang,
      targetLang,
      provider,
      model,
    }

    const isStale = () => signal.aborted

    try {
      const rephrasePromise = fetchRephrase(
        {
          sentence: rephraseTarget,
          fullTranslation: targetText,
          ...sharedParams,
        },
        signal
      ).then((rephrase) => {
        if (isStale()) return
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
      })

      const extrasPromise = isPhrase
        ? Promise.resolve()
        : Promise.allSettled([
            fetchSynonyms({ word, sentence, ...sharedParams }, signal).then((syns) => {
              if (!isStale()) setSynonyms(syns)
            }),
            fetchDictionaryContext(
              {
                word,
                sentence,
                uiLang,
                ...sharedParams,
              },
              signal
            ).then((dict) => {
              if (!isStale()) setDictionary(dict)
            }),
          ])

      await Promise.allSettled([rephrasePromise, extrasPromise])
    } catch (err) {
      if (!isStale() && (err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      if (!isStale()) {
        setPanelLoading(false)
      }
    }
  }

  const applySelectionVisual = (
    word: string,
    range: { start: number; end: number },
    forcedGranularity?: SelectionGranularity
  ) => {
    const granularity = forcedGranularity ?? detectSelectionGranularity(word, targetText)
    setSelection(word, range, granularity, true)
    setWordPanelRequested(false)
    abortPanelFetch()
    setPanelLoading(false)
    setSynonyms([])
    setDictionary(null)
    setRephraseOptions([])
  }

  const cancelScheduledWordFetch = () => {
    if (wordFetchTimerRef.current) {
      clearTimeout(wordFetchTimerRef.current)
      wordFetchTimerRef.current = null
    }
  }

  const selectWord = (
    word: string,
    range: { start: number; end: number },
    forcedGranularity?: SelectionGranularity
  ) => {
    cancelScheduledWordFetch()
    applySelectionVisual(word, range, forcedGranularity)
  }

  const selectWordAndFetch = (
    word: string,
    range: { start: number; end: number },
    forcedGranularity?: SelectionGranularity,
    debounce = false
  ) => {
    if (isManualLookup) {
      selectWord(word, range, forcedGranularity)
      return
    }

    applySelectionVisual(word, range, forcedGranularity)
    cancelScheduledWordFetch()

    if (debounce) {
      wordFetchTimerRef.current = setTimeout(() => {
        wordFetchTimerRef.current = null
        void fetchWordData(word, range, forcedGranularity)
      }, WORD_FETCH_DEBOUNCE_MS)
      return
    }

    void fetchWordData(word, range, forcedGranularity)
  }

  const handleConsecutiveWordSelect = (word: string, range: { start: number; end: number }) => {
    selectWordAndFetch(word, range, 'word', true)
  }

  const handleShrinkWordSelect = (word: string, range: { start: number; end: number }) => {
    selectWordAndFetch(word, range, 'word', true)
  }

  const handleWordSelect = (word: string, range: { start: number; end: number }) => {
    selectWordAndFetch(word, range, undefined, false)
  }

  const handlePhraseSelect = (word: string, range: { start: number; end: number }) => {
    selectWordAndFetch(word, range, undefined, false)
  }

  const handleManualLookup = () => {
    if (!selectedWord || !selectedRange) return
    cancelScheduledWordFetch()
    setWordPanelRequested(true)
    void fetchWordData(
      selectedWord,
      selectedRange,
      selectionGranularity ?? undefined
    )
  }

  useEffect(() => () => cancelScheduledWordFetch(), [])

  useEffect(() => {
    if (!isManualLookup) return
    cancelScheduledWordFetch()
    abortPanelFetch()
    setPanelLoading(false)
  }, [isManualLookup])

  const clearSelection = () => {
    cancelScheduledWordFetch()
    abortPanelFetch()
    setWordPanelRequested(false)
    setSelection(null, null)
    setSynonyms([])
    setDictionary(null)
    setRephraseOptions([])
    setPanelLoading(false)
  }

  const applySynonym = (replacement: string) => {
    if (!selectedRange) return
    const newText = replaceTokenRange(
      targetText,
      targetSegments,
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

  const copyText = () => {
    const textToCopy = canCopySelection ? selectedText : targetText
    if (!textToCopy || copied) return

    const showCopied = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    }

    if (canUseClipboardApi()) {
      void navigator.clipboard!.writeText(textToCopy).then(showCopied, () => {
        if (copyWithExecCommand(textToCopy)) showCopied()
      })
      return
    }

    if (copyWithExecCommand(textToCopy)) showCopied()
  }

  const speak = () => {
    if (!('speechSynthesis' in window)) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    if (!targetText) return
    const utterance = new SpeechSynthesisUtterance(targetText)
    utterance.lang = targetLang === 'zh' ? 'zh-CN' : targetLang
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    if (!targetText && isSpeaking && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [targetText, isSpeaking])

  const isThreeColumn = layoutMode === 'threeColumn'
  const isStacked = layoutMode === 'stacked'

  const panelMode = isThreeColumn ? 'resident' : isStacked ? 'sheet' : 'modal'
  const panelVisible =
    isThreeColumn ||
    isPanelLoading ||
    (isManualLookup ? wordPanelRequested && !!selectedWord : !!selectedWord)

  const sourceTextareaRef = useAutoResizeTextarea(sourceText)

  const paneClass = clsx(
    'relative flex w-full min-w-0 flex-col p-4',
    !isStacked && 'h-full min-h-0'
  )
  const paneContentClass = clsx('w-full', !isStacked && 'min-h-[6rem] flex-1')
  const paneFooterClass = 'mt-auto shrink-0 flex w-full items-center justify-between gap-3 pt-3'

  const sourcePane = (
    <section
      className={clsx(
        paneClass,
        isStacked && 'border-b border-deepl-border'
      )}
    >
      <div className={paneContentClass}>
        <textarea
          ref={sourceTextareaRef}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          onKeyDown={handleSourceKeyDown}
          placeholder={t('sourcePlaceholder')}
          className="block min-h-[6rem] w-full resize-none overflow-hidden border-0 bg-transparent text-lg leading-relaxed text-deepl-blue outline-none"
        />
      </div>
      <div className={paneFooterClass}>
        <TextStats text={sourceText} lang={sourceLang} />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={clear}
            title={t('clear')}
            aria-label={t('clear')}
            className={paneIconButtonClass}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating || !sourceText.trim()}
            className={clsx('rounded-lg bg-deepl-accent py-1.5 text-sm font-medium text-white hover:bg-deepl-accent/90 disabled:opacity-50', textButtonPx)}
          >
            {isTranslating ? t('translating') : t('translate')}
          </button>
        </div>
      </div>
    </section>
  )

  const targetPane = (
    <section className={paneClass}>
      <div className={paneContentClass}>
        <TokenEditor
          text={targetText}
          lang={targetLang}
          isStreaming={isStreaming}
          selectedRange={selectedRange}
          selectionGranularity={selectionGranularity}
          onTokenClick={handleWordSelect}
          onConsecutiveWordSelect={handleConsecutiveWordSelect}
          onShrinkWordSelect={handleShrinkWordSelect}
          onPhraseSelect={handlePhraseSelect}
          onDeselect={clearSelection}
          placeholder={t('targetPlaceholder')}
        />
      </div>
      <div className={paneFooterClass}>
        <TextStats
          text={targetText}
          lang={targetLang}
          showLookupButton={isManualLookup && !!selectedWord}
          onLookup={handleManualLookup}
          lookupDisabled={isPanelLoading}
        />
        <div className="flex shrink-0 gap-2">
          {selectedWordCount >= 2 && (
            <button
              type="button"
              onClick={clearSelection}
              title={t('clearSelection')}
              aria-label={t('clearSelection')}
              className={wordSelectionCancelButtonClass}
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
            disabled={copied || (canCopySelection ? !selectedText : !targetText)}
            title={copied ? t('copied') : t('copy')}
            aria-label={copied ? t('copied') : t('copy')}
            className={clsx(
              paneIconButtonClass,
              canCopySelection && !copied && wordSelectionCancelButtonClass,
              copied && 'border-deepl-success/30 bg-deepl-success/10 text-deepl-success'
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
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={speak}
            disabled={!targetText && !isSpeaking}
            title={isSpeaking ? t('stopSpeak') : t('speak')}
            aria-label={isSpeaking ? t('stopSpeak') : t('speak')}
            className={clsx(paneIconButtonClass, isSpeaking && speakActiveButtonClass)}
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
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )

  const translationCard = (
    <div className="w-full rounded-2xl border border-deepl-border bg-white shadow-sm">
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
    onClose: clearSelection,
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      {isThreeColumn ? (
        <div className="grid w-full grid-cols-[1fr_minmax(260px,320px)] items-start gap-4">
          <div className="min-w-0">
            {translationCard}
            <HistoryPanel />
          </div>
          <WordPanel mode="resident" visible {...wordPanelProps} />
        </div>
      ) : (
        <>
          {translationCard}
          <HistoryPanel />
        </>
      )}

      {!isThreeColumn && (
        <WordPanel
          mode={panelMode}
          visible={panelVisible}
          {...wordPanelProps}
        />
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-deepl-error/30 bg-deepl-error/10 px-4 py-3 text-sm text-deepl-error">
          {t('error')}: {error}
        </p>
      )}
    </main>
  )
}
