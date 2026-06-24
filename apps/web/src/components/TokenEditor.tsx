import { memo, useMemo, useRef } from 'react'
import {
  combineTextFromRange,
  extendWordRange,
  extractClauseByWord,
  extractSentenceByWord,
  findTokenRangeForText,
  isAdjacentWordToRange,
  isWordInRange,
  segmentText,
  type SelectionGranularity,
  type TokenSegment,
} from '@parawrite/core/client'
import clsx from 'clsx'

interface TokenEditorProps {
  text: string
  lang: string
  isStreaming: boolean
  selectedRange: { start: number; end: number } | null
  selectionGranularity?: SelectionGranularity | null
  placeholder?: string
  onTokenClick: (word: string, range: { start: number; end: number }) => void
  onConsecutiveWordSelect?: (word: string, range: { start: number; end: number }) => void
  onPhraseSelect?: (word: string, range: { start: number; end: number }) => void
}

const CLICK_DELAY_MS = 350

export const TokenEditor = memo(function TokenEditor({
  text,
  lang,
  isStreaming,
  selectedRange,
  selectionGranularity,
  placeholder,
  onTokenClick,
  onConsecutiveWordSelect,
  onPhraseSelect,
}: TokenEditorProps) {
  const segments = useMemo(() => segmentText(text, lang), [text, lang])
  const containerRef = useRef<HTMLDivElement>(null)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingClickRef = useRef<{
    word: string
    range: { start: number; end: number }
  } | null>(null)

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

  const handleWordClick = (word: string, range: { start: number; end: number }) => {
    if (selectedRange) {
      if (selectionGranularity === 'word') {
        if (isWordInRange(range.start, selectedRange)) return

        if (
          onConsecutiveWordSelect &&
          isAdjacentWordToRange(segments, range.start, selectedRange)
        ) {
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
          }
          clickCountRef.current = 0
          pendingClickRef.current = null

          const newRange = extendWordRange(selectedRange, range.start)
          const phrase = combineTextFromRange(segments, newRange).trim()
          onConsecutiveWordSelect(phrase, newRange)
          return
        }
      }

      return
    }

    clickCountRef.current += 1
    pendingClickRef.current = { word, range }

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    clickTimerRef.current = setTimeout(resolveClick, CLICK_DELAY_MS)
  }

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
      <div className="min-h-[6rem] w-full whitespace-pre-wrap break-words text-lg leading-relaxed text-deepl-blue">
        {text || (
          <span className="text-deepl-blue/40">{placeholder ?? '\u00a0'}</span>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="min-h-[6rem] w-full select-text text-lg leading-relaxed text-deepl-blue"
    >
      {segments.map((seg) => (
        <TokenSpan
          key={`${seg.index}-${seg.text}`}
          segment={seg}
          selectedRange={selectedRange}
          onTokenClick={handleWordClick}
        />
      ))}
    </div>
  )
})

function TokenSpan({
  segment,
  selectedRange,
  onTokenClick,
}: {
  segment: TokenSegment
  selectedRange: { start: number; end: number } | null
  onTokenClick: (word: string, range: { start: number; end: number }) => void
}) {
  const isSelected =
    selectedRange &&
    segment.index >= selectedRange.start &&
    segment.index <= selectedRange.end

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
        'rounded px-0.5 transition-colors hover:bg-deepl-accent/15',
        isSelected && 'bg-deepl-accent/25 ring-1 ring-deepl-accent/40'
      )}
    >
      {segment.text}
    </button>
  )
}
