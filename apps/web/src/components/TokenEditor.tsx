/**
 * Renders translated text as clickable word tokens.
 * Click counting: 1 = word, 2 = clause, 3 = sentence (debounced CLICK_DELAY_MS).
 * Adjacent word clicks extend selection; re-clicking an edge word shrinks the range.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  combineTextFromRange,
  extendWordRange,
  extractClauseByWord,
  extractSentenceByWord,
  findTokenRangeForText,
  getAdjacentWordHintsOutsideRange,
  isAdjacentWordToRange,
  isWordInRange,
  segmentText,
  shrinkWordRange,
  type SelectionGranularity,
  type TokenSegment,
} from '@parawrite/core/client'
import clsx from 'clsx'
import { paneEditorTextClass, panePlaceholderClass, wordSelectionClass } from '../ui'

interface TokenEditorProps {
  text: string
  lang: string
  isStreaming: boolean
  selectedRange: { start: number; end: number } | null
  selectionGranularity?: SelectionGranularity | null
  placeholder?: string
  onTokenClick: (word: string, range: { start: number; end: number }) => void
  onConsecutiveWordSelect?: (word: string, range: { start: number; end: number }) => void
  onShrinkWordSelect?: (word: string, range: { start: number; end: number }) => void
  onPhraseSelect?: (word: string, range: { start: number; end: number }) => void
  onDeselect?: () => void
}

const CLICK_DELAY_MS = 350
const INVALID_SELECT_FLASH_MS = 600

export const TokenEditor = memo(function TokenEditor({
  text,
  lang,
  isStreaming,
  selectedRange,
  selectionGranularity,
  placeholder,
  onTokenClick,
  onConsecutiveWordSelect,
  onShrinkWordSelect,
  onPhraseSelect,
  onDeselect,
}: TokenEditorProps) {
  const segments = useMemo(() => segmentText(text, lang), [text, lang])
  const containerRef = useRef<HTMLDivElement>(null)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flashRanges, setFlashRanges] = useState<Array<{ start: number; end: number }> | null>(
    null
  )
  const pendingClickRef = useRef<{
    word: string
    range: { start: number; end: number }
  } | null>(null)

  const flashInvalidSelection = (currentRange: { start: number; end: number }) => {
    const { before, after } = getAdjacentWordHintsOutsideRange(segments, currentRange)
    const hints: Array<{ start: number; end: number }> = []
    if (before !== null) hints.push({ start: before, end: before })
    if (after !== null) hints.push({ start: after, end: after })
    if (hints.length === 0) return

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashRanges(hints)
    flashTimerRef.current = setTimeout(() => {
      setFlashRanges(null)
      flashTimerRef.current = null
    }, INVALID_SELECT_FLASH_MS)
  }

  const resolveClick = () => {
    const count = clickCountRef.current
    const pending = pendingClickRef.current
    clickCountRef.current = 0
    pendingClickRef.current = null
    clickTimerRef.current = null

    if (!pending) return

    if (count === 1) {
      onTokenClick(pending.word, pending.range)
      return
    }

    if (!onPhraseSelect) return

    const phraseText =
      count >= 3
        ? extractSentenceByWord(text, pending.word, lang)
        : extractClauseByWord(text, pending.word, lang)

    const phraseRange = findTokenRangeForText(segments, phraseText) ?? pending.range
    onPhraseSelect(phraseText, phraseRange)
  }

  const applyShrinkFromRange = (wordIndex: number) => {
    if (!selectedRange) return

    const shrunk = shrinkWordRange(segments, selectedRange, wordIndex)
    if (shrunk === undefined) return
    if (shrunk === null) {
      onDeselect?.()
      return
    }
    const phrase = combineTextFromRange(segments, shrunk).trim()
    onShrinkWordSelect?.(phrase, shrunk)
  }

  const resolveSelectedRangeClick = () => {
    const count = clickCountRef.current
    const pending = pendingClickRef.current
    clickCountRef.current = 0
    pendingClickRef.current = null
    clickTimerRef.current = null

    if (!pending || !selectedRange) return

    if (count >= 2) {
      onDeselect?.()
      return
    }

    applyShrinkFromRange(pending.range.start)
  }

  const clearClickTimer = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
  }

  const handleWordClick = (word: string, range: { start: number; end: number }) => {
    if (selectedRange) {
      if (isWordInRange(range.start, selectedRange)) {
        clearClickTimer()

        if (selectionGranularity === 'word') {
          clickCountRef.current = 0
          pendingClickRef.current = null
          applyShrinkFromRange(range.start)
          return
        }

        if (selectionGranularity === 'clause' || selectionGranularity === 'sentence') {
          clickCountRef.current += 1
          pendingClickRef.current = { word, range }
          clickTimerRef.current = setTimeout(resolveSelectedRangeClick, CLICK_DELAY_MS)
          return
        }

        clickCountRef.current = 0
        pendingClickRef.current = null
        onDeselect?.()
        return
      }

      if (selectionGranularity === 'word') {
        if (
          onConsecutiveWordSelect &&
          isAdjacentWordToRange(segments, range.start, selectedRange)
        ) {
          clearClickTimer()
          clickCountRef.current = 0
          pendingClickRef.current = null

          const newRange = extendWordRange(selectedRange, range.start)
          const phrase = combineTextFromRange(segments, newRange).trim()
          onConsecutiveWordSelect(phrase, newRange)
          return
        }

        flashInvalidSelection(selectedRange)
        return
      }

      return
    }

    clickCountRef.current += 1
    pendingClickRef.current = { word, range }

    clearClickTimer()
    clickTimerRef.current = setTimeout(resolveClick, CLICK_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  const handleMouseUp = () => {
    if (!onPhraseSelect || clickCountRef.current > 0) return
    if (selectedRange) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) return

    const selectedText = selection.toString().trim()
    if (!selectedText || selectedText.length < 2) return

    const anchor = selection.anchorNode
    if (!anchor || !containerRef.current.contains(anchor)) return

    const range = findTokenRangeForText(segments, selectedText)
    if (!range) return

    onPhraseSelect(selectedText, range)
  }

  if (isStreaming || !text) {
    return (
      <div
        className={clsx(
          'block min-h-[6rem] w-full whitespace-pre-wrap break-words',
          paneEditorTextClass
        )}
      >
        {text || (
          <span className={panePlaceholderClass}>{placeholder ?? '\u00a0'}</span>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={clsx('block min-h-[6rem] w-full select-text', paneEditorTextClass)}
    >
      {segments.map((seg) => (
        <TokenSpan
          key={`${seg.index}-${seg.text}`}
          segment={seg}
          selectedRange={selectedRange}
          flashRanges={flashRanges}
          onTokenClick={handleWordClick}
        />
      ))}
    </div>
  )
})

function TokenSpan({
  segment,
  selectedRange,
  flashRanges,
  onTokenClick,
}: {
  segment: TokenSegment
  selectedRange: { start: number; end: number } | null
  flashRanges: Array<{ start: number; end: number }> | null
  onTokenClick: (word: string, range: { start: number; end: number }) => void
}) {
  const isSelected =
    selectedRange &&
    segment.index >= selectedRange.start &&
    segment.index <= selectedRange.end

  const isFlashing =
    flashRanges?.some(
      (r) => segment.index >= r.start && segment.index <= r.end
    ) ?? false

  if (!segment.isWord) {
    return <span className="whitespace-pre-wrap">{segment.text}</span>
  }

  return (
    <button
      type="button"
      onClick={() =>
        onTokenClick(segment.text, { start: segment.index, end: segment.index })
      }
      className={clsx(
        'rounded px-0.5 hover:bg-deepl-accent/15',
        isSelected || isFlashing ? wordSelectionClass : 'transition-colors'
      )}
    >
      {segment.text}
    </button>
  )
}
