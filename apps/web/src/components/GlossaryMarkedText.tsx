import { memo, useMemo } from 'react'
import clsx from 'clsx'
import type { CharRange, PointOutGlossaryMode } from '@parawrite/core/client'

type MarkKind = 'plain' | 'dot' | 'underline'

/** Line thickness, dot diameter, and offset below the baseline (px). */
const LINE_SIZE_PX = 2
const DOT_SIZE_PX = 4
const MARK_OFFSET_PX = 3

function buildMarkKinds(
  length: number,
  ranges: CharRange[],
  mode: PointOutGlossaryMode
): MarkKind[] {
  const kinds: MarkKind[] = Array.from({ length }, () => 'plain')
  if (mode === 'off') return kinds

  for (const range of ranges) {
    if (mode === 'first' && range.start < length) {
      kinds[range.start] = 'dot'
    } else if (mode === 'full') {
      for (let i = range.start; i < range.end && i < length; i++) {
        kinds[i] = 'underline'
      }
    }
  }
  return kinds
}

function groupMarkedParts(text: string, kinds: MarkKind[]): Array<{ text: string; kind: MarkKind }> {
  if (text.length === 0) return []
  const parts: Array<{ text: string; kind: MarkKind }> = []
  let start = 0
  let kind = kinds[0] ?? 'plain'

  for (let i = 1; i <= text.length; i++) {
    const nextKind = i < text.length ? kinds[i] : null
    if (nextKind !== kind) {
      parts.push({ text: text.slice(start, i), kind })
      start = i
      kind = nextKind ?? 'plain'
    }
  }
  return parts
}

const lineIndicatorStyle = {
  bottom: -MARK_OFFSET_PX,
  height: LINE_SIZE_PX,
} as const

const dotIndicatorStyle = {
  bottom: -MARK_OFFSET_PX,
  width: DOT_SIZE_PX,
  height: DOT_SIZE_PX,
} as const

export const GlossaryMarkedText = memo(function GlossaryMarkedText({
  text,
  mode,
  ranges,
  className,
}: {
  text: string
  mode: PointOutGlossaryMode
  ranges: CharRange[]
  className?: string
}) {
  const parts = useMemo(() => {
    if (mode === 'off' || ranges.length === 0) {
      return [{ text, kind: 'plain' as MarkKind }]
    }
    const kinds = buildMarkKinds(text.length, ranges, mode)
    return groupMarkedParts(text, kinds)
  }, [text, mode, ranges])

  return (
    <span className={clsx('whitespace-pre-wrap break-words', className)}>
      {parts.map((part, index) =>
        part.kind === 'plain' ? (
          <span key={index}>{part.text}</span>
        ) : part.kind === 'dot' ? (
          <span key={index} className="relative text-inherit">
            {part.text}
            <span
              aria-hidden
              className="pointer-events-none absolute left-[0.35em] -translate-x-1/2 rounded-full bg-deepl-border"
              style={dotIndicatorStyle}
            />
          </span>
        ) : (
          <span key={index} className="relative text-inherit">
            {part.text}
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 rounded-sm bg-deepl-border"
              style={{ ...lineIndicatorStyle, width: '100%' }}
            />
          </span>
        )
      )}
    </span>
  )
})
