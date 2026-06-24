import { LRUCache } from 'lru-cache'
import type { AppConfig, DictionaryEntry } from './types.js'
import { buildDictionaryContextPrompt, parseJsonResponse } from './prompts.js'
import { buildMessages } from './engines/base.js'
import { getEngineForProvider } from './engines/index.js'
import { getDefaultModel } from './config.js'

const cache = new LRUCache<string, DictionaryEntry>({ max: 500, ttl: 1000 * 60 * 60 })

interface FreeDictionaryResponse {
  word: string
  phonetic?: string
  meanings?: Array<{
    partOfSpeech?: string
    definitions?: Array<{ definition?: string; example?: string }>
  }>
}

interface WiktionaryResponse {
  zh?: { definitions?: string[] }
  en?: { definitions?: string[] }
}

export class DictionaryService {
  constructor(private readonly config: AppConfig) {}

  async lookup(lang: string, word: string): Promise<DictionaryEntry | null> {
    const key = `${lang}:${word.toLowerCase()}`
    const cached = cache.get(key)
    if (cached) return cached

    let entry: DictionaryEntry | null = null

    if (this.config.dictionary.free_dictionary && lang === 'en') {
      entry = await this.fetchFreeDictionary(word)
    }

    if (!entry && this.config.dictionary.wiktionary) {
      entry = await this.fetchWiktionary(lang, word)
    }

    if (entry) {
      cache.set(key, entry)
    }

    return entry
  }

  async lookupWithContext(
    word: string,
    sentence: string,
    sourceText: string,
    sourceLang: string,
    targetLang: string,
    uiLang: string,
    provider: string,
    model?: string
  ): Promise<DictionaryEntry | null> {
    const definitionLang = uiLang === 'zh' ? 'zh' : uiLang === 'en' ? 'en' : uiLang
    const bilingual = definitionLang !== targetLang
    const cacheKey = `${targetLang}:${definitionLang}:${word.toLowerCase()}`

    if (!bilingual) {
      const cached = await this.lookup(targetLang, word)
      if (cached && cached.meanings.length > 0) {
        return cached
      }
    }

    if (!this.config.dictionary.llm_fallback) {
      if (bilingual) return null
      const cached = await this.lookup(targetLang, word)
      return cached && cached.meanings.length > 0 ? cached : null
    }

    const engine = getEngineForProvider(this.config, provider)
    const resolvedModel = model ?? getDefaultModel(this.config, provider)
    const prompt = buildDictionaryContextPrompt(
      word,
      sentence,
      sourceText,
      sourceLang,
      targetLang,
      definitionLang
    )

    const response = await engine.chat({
      model: resolvedModel,
      messages: buildMessages(prompt.system, prompt.user),
      temperature: 0.2,
    })

    const parsed = parseJsonResponse<{
      word: string
      phonetic?: string
      meanings: Array<{
        partOfSpeech?: string
        definition: string
        example?: string
      }>
    }>(response)

    const meanings = (parsed.meanings ?? []).filter((m) => m.definition?.trim())
    if (meanings.length > 0) {
      const entry: DictionaryEntry = {
        word: parsed.word ?? word,
        phonetic: parsed.phonetic,
        meanings,
        source: 'llm',
      }
      cache.set(cacheKey, entry)
      return entry
    }

    if (bilingual) {
      const fallback = await this.lookup(targetLang, word)
      if (fallback && fallback.meanings.length > 0) {
        return fallback
      }
    }

    return null
  }

  private async fetchFreeDictionary(word: string): Promise<DictionaryEntry | null> {
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      )
      if (!response.ok) return null

      const data = (await response.json()) as FreeDictionaryResponse[]
      const first = data[0]
      if (!first) return null

      const meanings =
        first.meanings?.flatMap((m) =>
          (m.definitions ?? []).slice(0, 2).map((d) => ({
            partOfSpeech: m.partOfSpeech,
            definition: d.definition ?? '',
            example: d.example,
          }))
        ) ?? []

      if (meanings.length === 0) return null

      return {
        word: first.word,
        phonetic: first.phonetic,
        meanings,
        source: 'free_dictionary',
      }
    } catch {
      return null
    }
  }

  private async fetchWiktionary(lang: string, word: string): Promise<DictionaryEntry | null> {
    try {
      const wikiLang = lang === 'zh' ? 'zh' : 'en'
      const response = await fetch(
        `https://${wikiLang}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
      )
      if (!response.ok) return null

      const data = (await response.json()) as WiktionaryResponse
      const definitions =
        (wikiLang === 'zh' ? data.zh?.definitions : data.en?.definitions) ?? []

      if (definitions.length === 0) return null

      return {
        word,
        meanings: definitions.slice(0, 5).map((def) => ({
          definition: def.replace(/<[^>]+>/g, ''),
        })),
        source: 'wiktionary',
      }
    } catch {
      return null
    }
  }
}
