import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildGlossaryPromptSection,
  collectGlossaryTermsInText,
  findGlossaryOccurrences,
  findGlossaryMarkRanges,
  loadGlossaryFromPath,
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

describe('buildGlossaryPromptSection', () => {
  it('uses other when target language is missing', () => {
    const withOther: GlossaryEntry[] = [
      { translations: { zh: '猫猫', en: 'YellowBig', other: 'Hajime' } },
    ]
    const section = buildGlossaryPromptSection(withOther, 'zh', 'fr')
    assert.match(section, /"猫猫" → "Hajime"/)
  })

  it('prefers explicit target language over other', () => {
    const withOther: GlossaryEntry[] = [
      { translations: { zh: '猫猫', en: 'YellowBig', other: 'Hajime' } },
    ]
    const section = buildGlossaryPromptSection(withOther, 'zh', 'en')
    assert.match(section, /"猫猫" → "YellowBig"/)
    assert.doesNotMatch(section, /Hajime/)
  })
})

describe('parseGlossaryFile other fallback', () => {
  it('accepts one language plus other', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-gloss-'))
    const file = path.join(dir, 'glossary.yaml')
    fs.writeFileSync(
      file,
      `entries:
  - translations:
      zh: 奶龙
      other: NaiLong
`
    )
    const parsed = loadGlossaryFromPath(file)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0]?.translations.zh, '奶龙')
    assert.equal(parsed[0]?.translations.other, 'NaiLong')
  })
})

describe('collectGlossaryTermsInText with other', () => {
  it('matches other translation in target pane when language is missing', () => {
    const withOther: GlossaryEntry[] = [
      { translations: { zh: '猫猫', en: 'YellowBig', other: 'Hajime' } },
    ]
    const terms = collectGlossaryTermsInText(withOther, 'Say Hajime here', 'fr')
    assert.deepEqual(terms, ['Hajime'])
  })
})
