import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapPaneWidthPairRatios,
  resolvePaneWidthRatios,
} from './layout.js'

const zhEnRatios = {
  default: 0.5,
  byPair: mapPaneWidthPairRatios({ 'zho-eng': 0.4 }, 0.5),
}

describe('mapPaneWidthPairRatios', () => {
  it('maps ISO 639-2 pair keys to ISO 639-1', () => {
    assert.deepEqual(zhEnRatios.byPair, { 'zh-en': 0.4 })
  })
})

describe('resolvePaneWidthRatios', () => {
  it('applies forward pair: zh source, en target', () => {
    const result = resolvePaneWidthRatios(zhEnRatios, 'zh', 'en')
    assert.equal(result.sourceRatio, 0.4)
    assert.equal(result.targetRatio, 0.6)
  })

  it('mirrors reverse pair when forward key is missing', () => {
    const result = resolvePaneWidthRatios(zhEnRatios, 'en', 'zh')
    assert.equal(result.sourceRatio, 0.6)
    assert.equal(result.targetRatio, 0.4)
  })

  it('prefers forward key over mirror when both directions configured', () => {
    const ratios = {
      default: 0.5,
      byPair: {
        'zh-en': 0.4,
        'en-zh': 0.6,
      },
    }
    const result = resolvePaneWidthRatios(ratios, 'en', 'zh')
    assert.equal(result.sourceRatio, 0.6)
    assert.equal(result.targetRatio, 0.4)
  })

  it('returns default when source is auto or unresolved', () => {
    assert.deepEqual(resolvePaneWidthRatios(zhEnRatios, 'auto', 'en'), {
      sourceRatio: 0.5,
      targetRatio: 0.5,
    })
    assert.deepEqual(resolvePaneWidthRatios(zhEnRatios, null, 'en'), {
      sourceRatio: 0.5,
      targetRatio: 0.5,
    })
  })

  it('returns default when no pair matches', () => {
    const result = resolvePaneWidthRatios(zhEnRatios, 'fr', 'de')
    assert.equal(result.sourceRatio, 0.5)
    assert.equal(result.targetRatio, 0.5)
  })
})
