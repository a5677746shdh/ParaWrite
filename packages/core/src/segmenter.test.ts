import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractClauseAtOffset,
  extractSentenceForSelection,
  getSelectionCharOffset,
  normalizeRephraseReplacement,
  resolveRephraseTarget,
  segmentText,
} from './segmenter.js'
import type { TokenSegment } from './types.js'

function offsetForWord(
  segments: TokenSegment[],
  word: string,
  occurrence = 0
): number {
  let seen = 0
  for (const seg of segments) {
    if (!seg.isWord || seg.text !== word) continue
    if (seen === occurrence) {
      const offset = getSelectionCharOffset(segments, { start: seg.index, end: seg.index })
      if (offset === null) throw new Error(`offset not found for ${word}`)
      return offset
    }
    seen++
  }
  throw new Error(`word not found: ${word} #${occurrence}`)
}

function rangeFor(segments: TokenSegment[], text: string, occurrence = 0) {
  let seen = 0
  for (let start = 0; start < segments.length; start++) {
    let combined = ''
    for (let end = start; end < segments.length; end++) {
      combined += segments[end].text
      if (combined.trim() === text) {
        if (seen === occurrence) {
          return {
            start: segments[start].index,
            end: segments[end].index,
          }
        }
        seen++
      }
    }
  }
  throw new Error(`range not found for ${text} #${occurrence}`)
}

describe('normalizeRephraseReplacement', () => {
  it('strips trailing sentence punctuation before a following comma', () => {
    const text = 'Bananas are yellow, pears are green.'
    const segments = segmentText(text, 'en')
    const range = rangeFor(segments, 'Bananas are yellow')
    assert.equal(
      normalizeRephraseReplacement('Bananas have a yellow color.', segments, range),
      'Bananas have a yellow color'
    )
  })

  it('keeps trailing sentence punctuation at end of text', () => {
    const text = 'pears are green.'
    const segments = segmentText(text, 'en')
    const range = rangeFor(segments, 'pears are green.')
    assert.equal(
      normalizeRephraseReplacement('pears look green.', segments, range),
      'pears look green.'
    )
  })
})

describe('selection-aware clause extraction', () => {
  const text = 'Bananas are yellow, pears are green.'

  it('resolves the clause at the second duplicate word', () => {
    const segments = segmentText(text, 'en')
    const secondAreRange = { start: 9, end: 9 }
    const offset = getSelectionCharOffset(segments, secondAreRange)
    assert.notEqual(offset, null)
    assert.equal(extractClauseAtOffset(text, offset!), 'pears are green.')
    assert.equal(
      resolveRephraseTarget('are', text, 'en', 'word', offset!),
      'pears are green.'
    )
  })

  it('uses selection range for sentence context', () => {
    const segments = segmentText(text, 'en')
    const secondAreRange = { start: 9, end: 9 }
    assert.equal(
      extractSentenceForSelection(text, 'are', 'en', segments, secondAreRange),
      text.trim()
    )
  })

  it('stops at period when comma mode includes sentence end', () => {
    const longText =
      'Bananas are yellow, pears are green. The sky is blue, clouds are white.'
    const segments = segmentText(longText, 'en')
    const offset = getSelectionCharOffset(segments, { start: 9, end: 9 })
    assert.equal(extractClauseAtOffset(longText, offset!, 'comma'), 'pears are green.')
    assert.equal(
      resolveRephraseTarget('are', longText, 'en', 'word', offset!, 'comma'),
      'pears are green.'
    )
  })

  it('stops at question and exclamation marks in comma mode', () => {
    const text = 'Are you ready? I am fine! Next clause, continues.'
    const segments = segmentText(text, 'en')
    assert.equal(
      extractClauseAtOffset(text, offsetForWord(segments, 'ready'), 'comma'),
      'Are you ready?'
    )
    assert.equal(
      extractClauseAtOffset(text, offsetForWord(segments, 'fine'), 'comma'),
      'I am fine!'
    )
  })

  it('stops at fullwidth punctuation in period mode', () => {
    const text = '你好吗？我很好！继续。'
    const segments = segmentText(text, 'zh')
    assert.equal(
      extractClauseAtOffset(text, offsetForWord(segments, '很好'), 'period'),
      '我很好！'
    )
  })
})
