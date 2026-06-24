import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  detectSelectionGranularity,
  extractSentenceByWord,
  replaceTokenRange,
  resolveLayoutMode,
  segmentText,
  splitAlternativesByPeriod,
  type LayoutMode,
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
    isPanelLoading,
    setSourceText,
    setTargetText,
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleTranslate()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleTranslate])

  const loadWordData = async (
    word: string,
    range: { start: number; end: number }
  ) => {
    const granularity = detectSelectionGranularity(word, targetText)
    setSelection(word, range, granularity)
    setPanelLoading(true)
    setSynonyms([])
    setDictionary(null)
    setRephraseOptions([])

    const sentence = extractSentenceByWord(targetText, word, targetLang)
    const uiLang = i18n.language.startsWith('zh') ? 'zh' : 'en'
    const skipDictionary = granularity === 'sentence'

    try {
      const [syns, dict, rephrase] = await Promise.all([
        fetchSynonyms({
          word,
          sentence,
          sourceText,
          sourceLang,
          targetLang,
          provider,
          model,
        }),
        skipDictionary
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
          sentence,
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
      const splitTexts = splitAlternativesByPeriod(rephrase.map((r) => r.text))
      setRephraseOptions(splitTexts.map((text) => ({ text })))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPanelLoading(false)
    }
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
    const sentence = extractSentenceByWord(targetText, selectedWord, targetLang)
    const newText = targetText.replace(sentence, text)
    setTargetText(newText === targetText ? text : newText)
    setRephraseOptions([])
    setSelection(null, null)
  }

  const copyText = async () => {
    if (!targetText) return
    await navigator.clipboard.writeText(targetText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          onTokenClick={loadWordData}
          onPhraseSelect={loadWordData}
          placeholder={t('targetPlaceholder')}
        />
      </div>
      <div className={paneFooterClass}>
        <TextStats text={targetText} lang={targetLang} />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={copyText}
            disabled={!targetText}
            className="rounded-lg border border-deepl-border bg-white px-3 py-1.5 text-sm hover:bg-deepl-light disabled:opacity-50"
          >
            {copied ? t('copied') : t('copy')}
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
    selectionGranularity,
    synonyms,
    dictionary,
    rephraseOptions,
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
