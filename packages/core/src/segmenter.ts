import type { TokenSegment } from './types.js'

export function segmentText(text: string, lang: string): TokenSegment[] {
  if (!text) return []

  const locale = lang === 'zh' ? 'zh-Hans' : lang === 'auto' ? 'en' : lang

  try {
    const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, opts: { granularity: string }) => { segment: (text: string) => Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter
    if (Segmenter) {
      const segmenter = new Segmenter(locale, { granularity: 'word' })
      const segments: TokenSegment[] = []
      let index = 0
      for (const part of segmenter.segment(text)) {
        const segment = part.segment
        if (!segment) continue
        segments.push({
          text: segment,
          index: index++,
          isWord: part.isWordLike ?? /\w/.test(segment),
        })
      }
      return segments
    }
  } catch {
    // fallback below
  }

  return fallbackSegment(text)
}

function fallbackSegment(text: string): TokenSegment[] {
  const parts = text.split(/(\s+|[,.!?;:'"()[\]{}])/g).filter(Boolean)
  return parts.map((part, index) => ({
    text: part,
    index,
    isWord: /\w/.test(part) && !/^\s+$/.test(part),
  }))
}

export function isWordToken(text: string, lang: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const segments = segmentText(trimmed, lang)
  return segments.length === 1 && segments[0].isWord
}

export function replaceTokenRange(
  text: string,
  segments: TokenSegment[],
  startIndex: number,
  endIndex: number,
  replacement: string
): string {
  if (segments.length === 0) return text

  let result = ''
  for (const seg of segments) {
    if (seg.index < startIndex || seg.index > endIndex) {
      result += seg.text
    } else if (seg.index === startIndex) {
      result += replacement
    }
  }
  return result
}

export function countWords(text: string, lang: string): number {
  if (!text.trim()) return 0
  const segments = segmentText(text, lang)
  return segments.filter((s) => s.isWord).length
}

const SENTENCE_SPLIT = /([。.!?！？]+)/
const CLAUSE_SPLIT = /([，,、;；]+)/

export function splitIntoClauses(text: string): string[] {
  if (!text.trim()) return []
  const parts = text.split(CLAUSE_SPLIT)
  const clauses: string[] = []
  let current = ''
  for (const part of parts) {
    if (/^[，,、;；]+$/.test(part)) {
      current += part
      if (current.trim()) clauses.push(current.trim())
      current = ''
    } else {
      current += part
    }
  }
  if (current.trim()) clauses.push(current.trim())
  return clauses
}

export function splitIntoSentences(text: string): string[] {
  if (!text.trim()) return []
  const parts = text.split(SENTENCE_SPLIT)
  const sentences: string[] = []
  let current = ''
  for (const part of parts) {
    if (/^[。.!?！？]+$/.test(part)) {
      current += part
      if (current.trim()) sentences.push(current.trim())
      current = ''
    } else {
      current += part
    }
  }
  if (current.trim()) sentences.push(current.trim())
  return sentences
}

export function extractClauseByWord(
  text: string,
  word: string,
  _lang: string
): string {
  const clauses = splitIntoClauses(text)
  const trimmedWord = word.trim()
  const found = clauses.find((c) => c.includes(trimmedWord))
  return found ?? extractSentenceByWord(text, word, _lang)
}

export function extractSentenceByWord(
  text: string,
  word: string,
  _lang: string
): string {
  const sentences = splitIntoSentences(text)
  const trimmedWord = word.trim()
  const found = sentences.find((s) => s.includes(trimmedWord))
  return found ?? text
}

export type SelectionGranularity = 'word' | 'clause' | 'sentence'

export function detectSelectionGranularity(
  selectedText: string,
  fullText: string
): SelectionGranularity {
  const trimmed = selectedText.trim()
  if (!trimmed) return 'word'

  const sentences = splitIntoSentences(fullText)
  if (sentences.some((s) => s.trim() === trimmed)) return 'sentence'

  const clauses = splitIntoClauses(fullText)
  if (clauses.some((c) => c.trim() === trimmed)) return 'clause'

  return 'word'
}

export function findTokenRangeForText(
  segments: TokenSegment[],
  selectedText: string
): { start: number; end: number } | null {
  const trimmed = selectedText.trim()
  if (!trimmed || segments.length === 0) return null

  for (let start = 0; start < segments.length; start++) {
    let combined = ''
    for (let end = start; end < segments.length; end++) {
      combined += segments[end].text
      if (combined.trim() === trimmed) {
        return { start: segments[start].index, end: segments[end].index }
      }
      if (combined.trim().length > trimmed.length + 20) break
    }
  }

  return null
}

export function splitAlternativesByPeriod(texts: string[]): string[] {
  const result: string[] = []
  for (const text of texts) {
    const parts = text.split(/[。.!?！？]+/).map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) continue
    result.push(...parts)
  }
  return [...new Set(result)]
}

export function resolveLayoutMode(
  width: number,
  breakpoints: { threeColumnMinWidth: number; twoColumnMinWidth: number }
): 'threeColumn' | 'twoColumn' | 'stacked' {
  if (width >= breakpoints.threeColumnMinWidth) return 'threeColumn'
  if (width >= breakpoints.twoColumnMinWidth) return 'twoColumn'
  return 'stacked'
}
