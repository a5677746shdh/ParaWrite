import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SUPPORTED_LANGUAGES } from './types.js'
import { normalizeLanguageOrder, sortSupportedLanguages } from './languages.js'

describe('normalizeLanguageOrder', () => {
  it('filters unknown codes and dedupes', () => {
    assert.deepEqual(normalizeLanguageOrder(['zh', 'en', 'xx', 'zh', 'EN']), ['zh', 'en'])
  })
})

describe('sortSupportedLanguages', () => {
  const withoutAuto = SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto')

  it('sorts alphabetically by name when no custom order', () => {
    const sorted = sortSupportedLanguages(withoutAuto)
    const names = sorted.map((l) => l.name)
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)))
  })

  it('places custom-ordered languages first, then alphabetical', () => {
    const sorted = sortSupportedLanguages(withoutAuto, ['ja', 'zh'])
    assert.equal(sorted[0]?.code, 'ja')
    assert.equal(sorted[1]?.code, 'zh')
    const rest = sorted.slice(2).map((l) => l.name)
    assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b)))
  })

  it('includes auto when present in list and custom order', () => {
    const sorted = sortSupportedLanguages(SUPPORTED_LANGUAGES, ['auto', 'zh', 'en'])
    assert.equal(sorted[0]?.code, 'auto')
    assert.equal(sorted[1]?.code, 'zh')
    assert.equal(sorted[2]?.code, 'en')
  })
})

describe('getTargetLanguageOrder', () => {
  it('falls back to language_order when target_language_order is empty', async () => {
    const { getLanguageOrder, getTargetLanguageOrder } = await import('./config.js')
    const config = {
      app: {
        language_order: ['zh', 'en'],
        target_language_order: [],
      },
    } as unknown as import('./types.js').AppConfig
    assert.deepEqual(getTargetLanguageOrder(config), getLanguageOrder(config))
  })

  it('uses target_language_order when set', async () => {
    const { getTargetLanguageOrder } = await import('./config.js')
    const config = {
      app: {
        language_order: ['zh', 'en'],
        target_language_order: ['ja', 'en'],
      },
    } as unknown as import('./types.js').AppConfig
    assert.deepEqual(getTargetLanguageOrder(config), ['ja', 'en'])
  })
})
