import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectGlossaryTermsInText,
  findGlossaryOccurrences,
  findGlossaryMarkRanges,
  type GlossaryEntry,
} from './glossary.js'

const entries: GlossaryEntry[] = [
  { translations: { en: 'machine learning', zh: '机器学习' } },
  { translations: { en: 'ABC', zh: '甲' } },
]

describe('findGlossaryOccurrences', () => {
  it('prefers longer matches and skips overlapping shorter ones', () => {
    const text = 'machine learning and machine'
    const ranges = findGlossaryOccurrences(text, ['machine learning', 'machine'])
    assert.deepEqual(ranges, [
      { start: 0, end: 16 },
      { start: 21, end: 28 },
    ])
  })

  it('finds multiple disjoint terms', () => {
    const text = 'ABC and XYZ ABC'
    const ranges = findGlossaryOccurrences(text, ['ABC'])
    assert.deepEqual(ranges, [
      { start: 0, end: 3 },
      { start: 12, end: 15 },
    ])
  })
})

describe('collectGlossaryTermsInText', () => {
  it('collects terms for fixed language', () => {
    const terms = collectGlossaryTermsInText(entries, 'Use ABC today', 'en')
    assert.ok(terms.includes('ABC'))
    assert.ok(!terms.includes('机器学习'))
  })

  it('collects any matching translation when lang is auto', () => {
    const terms = collectGlossaryTermsInText(entries, '机器学习很好', 'auto')
    assert.ok(terms.includes('机器学习'))
  })
})

describe('findGlossaryMarkRanges', () => {
  it('returns ranges for matched glossary entries', () => {
    const ranges = findGlossaryMarkRanges('Hello ABC world', entries, 'en')
    assert.deepEqual(ranges, [{ start: 6, end: 9 }])
  })
})
