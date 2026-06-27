import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDictionaryContextPrompt } from './prompts.js'

describe('buildDictionaryContextPrompt', () => {
  const baseArgs = ['word', 'Translation sentence.', 'Source text.', 'zh', 'en', 'zh'] as const

  it('omits example from JSON schema when showExamples is false', () => {
    const { user } = buildDictionaryContextPrompt(...baseArgs, false)
    assert.match(user, /"definition":"\.\.\."}/)
    assert.doesNotMatch(user, /"example"/)
  })

  it('requires independent examples when showExamples is true', () => {
    const { user } = buildDictionaryContextPrompt(...baseArgs, true)
    assert.match(user, /"example":"\.\.\."}/)
    assert.match(user, /Do not repeat, quote, or paraphrase the Source or Translation/)
  })
})
