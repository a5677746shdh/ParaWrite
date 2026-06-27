/**
 * Text segmentation for word-level interaction in the target pane.
 * Uses Intl.Segmenter when available (cached per locale); clause/sentence splits use punctuation rules.
 */
import type { AlternativesSeparator, TokenSegment } from './types.js'

type IntlSegmenter = {
  segment: (text: string) => Iterable<{ segment: string; isWordLike?: boolean }>
}

const segmenterCache = new Map<string, IntlSegmenter>()

function getSegmenter(locale: string): IntlSegmenter | null {
  const cached = segmenterCache.get(locale)
  if (cached) return cached

  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (locale: string, opts: { granularity: string }) => IntlSegmenter
    }
  ).Segmenter
  if (!Segmenter) return null

  const segmenter = new Segmenter(locale, { granularity: 'word' })
  segmenterCache.set(locale, segmenter)
  return segmenter
}

export function segmentText(text: string, lang: string): TokenSegment[] {
  if (!text) return []

  const locale = lang === 'zh' ? 'zh-Hans' : lang === 'auto' ? 'en' : lang

  try {
    const segmenter = getSegmenter(locale)
    if (segmenter) {
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

const CLAUSE_PUNCT_CLASS = ',，、;；:：'
const SENTENCE_END_PUNCT_CLASS = '.。．!?！？…'

function charClassFrom(chars: string): string {
  const body = [...chars]
    .map((char) => {
      if (char === '-' || char === ']' || char === '\\') return `\\${char}`
      return char
    })
    .join('')
  return `[${body}]`
}

const CLAUSE_PUNCT_ONLY = charClassFrom(CLAUSE_PUNCT_CLASS)
const SENTENCE_END_PUNCT_ONLY = charClassFrom(SENTENCE_END_PUNCT_CLASS)

const CLAUSE_PUNCT_TEST = new RegExp(CLAUSE_PUNCT_ONLY, 'u')
const SENTENCE_END_PUNCT_TEST = new RegExp(SENTENCE_END_PUNCT_ONLY, 'u')
const CLAUSE_PUNCT_RUN = new RegExp(`${CLAUSE_PUNCT_ONLY}+`, 'u')
const SENTENCE_END_PUNCT_RUN = new RegExp(`${SENTENCE_END_PUNCT_ONLY}+`, 'u')

const SENTENCE_END_SPLIT = new RegExp(`(${SENTENCE_END_PUNCT_ONLY}+)`, 'u')
const COMMA_MODE_CLAUSE_SPLIT = new RegExp(
  `(${CLAUSE_PUNCT_ONLY}+|${SENTENCE_END_PUNCT_ONLY}+)`,
  'u'
)

function clauseSplitPattern(separator: AlternativesSeparator): RegExp {
  return separator === 'period' ? SENTENCE_END_SPLIT : COMMA_MODE_CLAUSE_SPLIT
}

function isClauseDelimiter(part: string, separator: AlternativesSeparator): boolean {
  if (!part) return false
  if (separator === 'period') return SENTENCE_END_PUNCT_RUN.test(part)
  return CLAUSE_PUNCT_RUN.test(part) || SENTENCE_END_PUNCT_RUN.test(part)
}

/** Drop trailing punctuation from a rephrase alternative when it would duplicate boundary punct in the surrounding text. */
export function normalizeRephraseReplacement(
  replacement: string,
  segments: TokenSegment[],
  range: { start: number; end: number }
): string {
  const followingText = segments
    .filter((s) => s.index > range.end)
    .map((s) => s.text)
    .join('')
  const followingLead = followingText.trimStart()
  if (!followingLead) return replacement.trimEnd()

  let normalized = replacement.trimEnd()
  const nextChar = followingLead[0] ?? ''
  const lastChar = normalized[normalized.length - 1] ?? ''

  if (CLAUSE_PUNCT_TEST.test(nextChar) && SENTENCE_END_PUNCT_TEST.test(lastChar)) {
    normalized = normalized.replace(new RegExp(`${SENTENCE_END_PUNCT_ONLY}+$`, 'u'), '').trimEnd()
  }

  const trimmedLast = normalized[normalized.length - 1] ?? ''
  if (CLAUSE_PUNCT_TEST.test(trimmedLast) && CLAUSE_PUNCT_TEST.test(nextChar)) {
    normalized = normalized.replace(new RegExp(`${CLAUSE_PUNCT_ONLY}+$`, 'u'), '').trimEnd()
  }

  return normalized
}

export function countWords(text: string, lang: string): number {
  if (!text.trim()) return 0
  const segments = segmentText(text, lang)
  return segments.filter((s) => s.isWord).length
}

export function splitIntoClauses(
  text: string,
  separator: AlternativesSeparator = 'comma'
): string[] {
  if (!text.trim()) return []
  const parts = text.split(clauseSplitPattern(separator))
  const clauses: string[] = []
  let current = ''
  for (const part of parts) {
    if (isClauseDelimiter(part, separator)) {
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
  const parts = text.split(SENTENCE_END_SPLIT)
  const sentences: string[] = []
  let current = ''
  for (const part of parts) {
    if (SENTENCE_END_PUNCT_RUN.test(part)) {
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
  _lang: string,
  separator: AlternativesSeparator = 'comma'
): string {
  const clauses = splitIntoClauses(text, separator)
  const trimmedWord = word.trim()
  const found = clauses.find((c) => c.includes(trimmedWord))
  return found ?? extractSentenceByWord(text, word, _lang)
}

function locateSpanInText(
  text: string,
  span: string,
  searchFrom: number
): { start: number; end: number } | null {
  const needle = span.trim()
  if (!needle) return null
  const idx = text.indexOf(needle, searchFrom)
  if (idx === -1) return null
  return { start: idx, end: idx + needle.length }
}

export function getSelectionCharOffset(
  segments: TokenSegment[],
  range: { start: number; end: number }
): number | null {
  let offset = 0
  for (const seg of segments) {
    if (seg.index === range.start) return offset
    offset += seg.text.length
  }
  return null
}

export function extractClauseAtOffset(
  text: string,
  offset: number,
  separator: AlternativesSeparator = 'comma'
): string {
  const clauses = splitIntoClauses(text, separator)
  let searchFrom = 0
  for (const clause of clauses) {
    const located = locateSpanInText(text, clause, searchFrom)
    if (!located) continue
    if (offset >= located.start && offset < located.end) return clause
    searchFrom = located.end
  }
  return extractSentenceAtOffset(text, offset)
}

export function extractSentenceAtOffset(text: string, offset: number): string {
  const sentences = splitIntoSentences(text)
  let searchFrom = 0
  for (const sentence of sentences) {
    const located = locateSpanInText(text, sentence, searchFrom)
    if (!located) continue
    if (offset >= located.start && offset < located.end) return sentence
    searchFrom = located.end
  }
  return text.trim()
}

export function extractClauseForSelection(
  text: string,
  word: string,
  lang: string,
  segments: TokenSegment[],
  range: { start: number; end: number },
  separator: AlternativesSeparator = 'comma'
): string {
  const offset = getSelectionCharOffset(segments, range)
  if (offset !== null) return extractClauseAtOffset(text, offset, separator)
  return extractClauseByWord(text, word, lang, separator)
}

export function extractSentenceForSelection(
  text: string,
  word: string,
  lang: string,
  segments: TokenSegment[],
  range: { start: number; end: number }
): string {
  const offset = getSelectionCharOffset(segments, range)
  if (offset !== null) return extractSentenceAtOffset(text, offset)
  return extractSentenceByWord(text, word, lang)
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

export function normalizeClauseText(text: string): string {
  return text
    .trim()
    .replace(new RegExp(`^${CLAUSE_PUNCT_ONLY}+\\s*|\\s*${CLAUSE_PUNCT_ONLY}+$`, 'gu'), '')
    .trim()
}

export function resolveRephraseTarget(
  word: string,
  targetText: string,
  targetLang: string,
  granularity: SelectionGranularity,
  selectionOffset?: number,
  separator: AlternativesSeparator = 'comma'
): string {
  if (granularity === 'sentence') {
    return selectionOffset !== undefined
      ? extractSentenceAtOffset(targetText, selectionOffset)
      : extractSentenceByWord(targetText, word, targetLang)
  }
  if (granularity === 'clause') {
    return normalizeClauseText(word)
  }
  const clause =
    selectionOffset !== undefined
      ? extractClauseAtOffset(targetText, selectionOffset, separator)
      : extractClauseByWord(targetText, word, targetLang, separator)
  return normalizeClauseText(clause)
}

export function detectSelectionGranularity(
  selectedText: string,
  fullText: string,
  separator: AlternativesSeparator = 'comma'
): SelectionGranularity {
  const trimmed = selectedText.trim()
  if (!trimmed) return 'word'

  const sentences = splitIntoSentences(fullText)
  if (sentences.some((s) => s.trim() === trimmed)) return 'sentence'

  const clauses = splitIntoClauses(fullText, separator)
  if (clauses.some((c) => normalizeClauseText(c) === normalizeClauseText(trimmed))) {
    return 'clause'
  }

  return 'word'
}

export function countWordsInRange(
  segments: TokenSegment[],
  range: { start: number; end: number }
): number {
  return segments.filter(
    (s) => s.isWord && s.index >= range.start && s.index <= range.end
  ).length
}

export function combineTextFromRange(
  segments: TokenSegment[],
  range: { start: number; end: number }
): string {
  return segments
    .filter((s) => s.index >= range.start && s.index <= range.end)
    .map((s) => s.text)
    .join('')
}

export function extendWordRange(
  range: { start: number; end: number },
  wordIndex: number
): { start: number; end: number } {
  return {
    start: Math.min(range.start, wordIndex),
    end: Math.max(range.end, wordIndex),
  }
}

export function isWordInRange(
  wordIndex: number,
  range: { start: number; end: number }
): boolean {
  return wordIndex >= range.start && wordIndex <= range.end
}

export function isAdjacentWordToRange(
  segments: TokenSegment[],
  wordIndex: number,
  range: { start: number; end: number }
): boolean {
  const words = segments.filter((s) => s.isWord)
  const positionByIndex = new Map(words.map((w, i) => [w.index, i]))
  const clickedPos = positionByIndex.get(wordIndex)
  if (clickedPos === undefined) return false

  const rangeWords = words.filter((w) => w.index >= range.start && w.index <= range.end)
  if (rangeWords.length === 0) return false

  const firstPos = positionByIndex.get(rangeWords[0].index)!
  const lastPos = positionByIndex.get(rangeWords[rangeWords.length - 1].index)!

  return clickedPos === firstPos - 1 || clickedPos === lastPos + 1
}

/** Word indices immediately before/after a consecutive selection (for multi-select hints). */
export function getAdjacentWordHintsOutsideRange(
  segments: TokenSegment[],
  range: { start: number; end: number }
): { before: number | null; after: number | null } {
  const words = segments.filter((s) => s.isWord)
  if (words.length === 0) return { before: null, after: null }

  const positionByIndex = new Map(words.map((w, i) => [w.index, i]))
  const rangeWords = words.filter((w) => w.index >= range.start && w.index <= range.end)
  if (rangeWords.length === 0) return { before: null, after: null }

  const firstPos = positionByIndex.get(rangeWords[0].index)!
  const lastPos = positionByIndex.get(rangeWords[rangeWords.length - 1].index)!

  return {
    before: firstPos > 0 ? words[firstPos - 1].index : null,
    after: lastPos < words.length - 1 ? words[lastPos + 1].index : null,
  }
}

/**
 * Remove one word from a consecutive word selection.
 * Returns null to clear (single word), a new range to shrink, or undefined to ignore.
 */
export function shrinkWordRange(
  segments: TokenSegment[],
  range: { start: number; end: number },
  wordIndex: number
): { start: number; end: number } | null | undefined {
  if (!isWordInRange(wordIndex, range)) return undefined

  const wordsInRange = segments.filter(
    (s) => s.isWord && s.index >= range.start && s.index <= range.end
  )
  if (wordsInRange.length === 0) return undefined

  if (wordsInRange.length === 1) {
    return wordsInRange[0].index === wordIndex ? null : undefined
  }

  const clickedPos = wordsInRange.findIndex((w) => w.index === wordIndex)
  if (clickedPos === -1) return undefined

  if (clickedPos === 0) {
    const remaining = wordsInRange.slice(1)
    return { start: remaining[0].index, end: remaining[remaining.length - 1].index }
  }

  if (clickedPos === wordsInRange.length - 1) {
    const remaining = wordsInRange.slice(0, -1)
    return { start: remaining[0].index, end: remaining[remaining.length - 1].index }
  }

  return undefined
}

export function findTokenRangeForText(
  segments: TokenSegment[],
  selectedText: string,
  nearCharOffset?: number
): { start: number; end: number } | null {
  const trimmed = selectedText.trim()
  if (!trimmed || segments.length === 0) return null

  const matches: Array<{ start: number; end: number; charOffset: number }> = []

  for (let start = 0; start < segments.length; start++) {
    let combined = ''
    for (let end = start; end < segments.length; end++) {
      combined += segments[end].text
      if (combined.trim() === trimmed) {
        const charOffset = getSelectionCharOffset(segments, {
          start: segments[start].index,
          end: segments[start].index,
        })
        matches.push({
          start: segments[start].index,
          end: segments[end].index,
          charOffset: charOffset ?? 0,
        })
      }
      if (combined.trim().length > trimmed.length + 20) break
    }
  }

  if (matches.length === 0) return null
  if (nearCharOffset === undefined || matches.length === 1) {
    return { start: matches[0].start, end: matches[0].end }
  }

  let best = matches[0]
  let bestDistance = Math.abs(best.charOffset - nearCharOffset)
  for (const match of matches.slice(1)) {
    const distance = Math.abs(match.charOffset - nearCharOffset)
    if (distance < bestDistance) {
      best = match
      bestDistance = distance
    }
  }
  return { start: best.start, end: best.end }
}

export function splitAlternatives(
  texts: string[],
  separator: 'comma' | 'period' = 'comma'
): string[] {
  const pattern =
    separator === 'comma'
      ? new RegExp(`${CLAUSE_PUNCT_ONLY}|${SENTENCE_END_PUNCT_ONLY}+`, 'gu')
      : new RegExp(`${SENTENCE_END_PUNCT_ONLY}+`, 'gu')
  const result: string[] = []
  for (const text of texts) {
    const parts = text.split(pattern).map((p) => p.trim()).filter(Boolean)
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
