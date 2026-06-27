import type { DictionaryEntry, RephraseOption, SynonymOption } from '@parawrite/core/client'

export interface WordPanelCacheEntry {
  synonyms: SynonymOption[]
  dictionary: DictionaryEntry | null
  rephraseOptions: RephraseOption[]
  rephraseOriginalSentence: string | null
}

const MAX_ENTRIES = 32
const cache = new Map<string, WordPanelCacheEntry>()

export function wordPanelCacheKey(params: {
  word: string
  range: { start: number; end: number }
  rephraseTarget: string
  targetText: string
  sourceLang: string
  targetLang: string
  provider: string
  model: string
}): string {
  return [
    params.word,
    params.range.start,
    params.range.end,
    params.rephraseTarget,
    params.targetText,
    params.sourceLang,
    params.targetLang,
    params.provider,
    params.model,
  ].join('\0')
}

export function getWordPanelCache(key: string): WordPanelCacheEntry | undefined {
  return cache.get(key)
}

export function setWordPanelCache(key: string, entry: WordPanelCacheEntry): void {
  if (cache.has(key)) {
    cache.delete(key)
  }
  cache.set(key, entry)
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

export function clearWordPanelCache(): void {
  cache.clear()
}
