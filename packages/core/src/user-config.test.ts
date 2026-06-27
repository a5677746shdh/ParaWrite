import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { AppConfig } from './types.js'
import { mergeGlossaryEntries, type GlossaryEntry } from './glossary.js'
import { mergeUserPreferences, pickAllowedSections } from './user-config.js'

const baseConfig = {
  server: { host: '0.0.0.0', port: 8787 },
  app: {
    default_provider: 'openai',
    layout: {
      pane_width_ratios: {
        default: 0.5,
        by_pair: { 'zh-en': 0.4 },
      },
    },
    alternatives_separator: { default: 'comma', by_language: { zh: 'period' } },
    phrase_word_threshold: { default: 4, by_language: { zh: 5 } },
  },
  providers: {
    openai: {
      type: 'openai_compatible' as const,
      base_url: 'https://api.openai.com/v1',
      models: [{ id: 'gpt-4o-mini', name: 'Mini', default: true }],
    },
  },
  dictionary: { free_dictionary: true, wiktionary: true, llm_fallback: true },
  theme: { primary: '#000000', accent: '#111111' },
} satisfies AppConfig

describe('pickAllowedSections', () => {
  it('strips disallowed root keys', () => {
    const prefs = pickAllowedSections({
      app: { translate_on_enter: true },
      theme: { primary: '#abcdef' },
      providers: { evil: {} },
      auth: { access_totp_secret: 'x' },
    })
    assert.deepEqual(prefs, {
      app: { translate_on_enter: true },
      theme: { primary: '#abcdef' },
    })
  })
})

describe('mergeUserPreferences', () => {
  it('deep merges theme and app layout by_pair', () => {
    const merged = mergeUserPreferences(baseConfig, {
      theme: { accent: '#ff0000' },
      app: {
        layout: {
          pane_width_ratios: {
            by_pair: { 'ja-en': 0.45 },
          },
        },
      },
    })
    assert.equal(merged.theme?.accent, '#ff0000')
    assert.equal(merged.theme?.primary, '#000000')
    assert.deepEqual(merged.app.layout?.pane_width_ratios?.by_pair, {
      'zh-en': 0.4,
      'ja-en': 0.45,
    })
  })
})

describe('mergeGlossaryEntries', () => {
  const global: GlossaryEntry[] = [
    { translations: { zh: '你好', en: 'Hello' } },
    { translations: { zh: '谢谢', en: 'Thanks' } },
  ]

  it('user entry overrides global on shared lang:term', () => {
    const user: GlossaryEntry[] = [{ translations: { zh: '你好', en: 'Hi' } }]
    const merged = mergeGlossaryEntries(global, user)
    assert.equal(merged.length, 2)
    const hi = merged.find((e) => e.translations.zh === '你好')
    assert.equal(hi?.translations.en, 'Hi')
  })

  it('appends non-conflicting user entries', () => {
    const user: GlossaryEntry[] = [{ translations: { zh: '再见', en: 'Bye' } }]
    const merged = mergeGlossaryEntries(global, user)
    assert.equal(merged.length, 3)
  })
})
