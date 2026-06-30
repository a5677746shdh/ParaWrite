import type { GlossaryEntry } from './types.js'

export type { GlossaryEntry }

/** Fallback translation key for languages not explicitly listed in an entry. */
export const GLOSSARY_FALLBACK_KEY = 'other'

export interface CharRange {
  /** Inclusive start index in text */
  start: number
  /** Exclusive end index */
  end: number
}

function isGlossaryLanguageKey(key: string): boolean {
  return key !== GLOSSARY_FALLBACK_KEY
}

export function resolveGlossaryTranslation(
  translations: Record<string, string>,
  lang: string
): string | undefined {
  return translations[lang] ?? translations[GLOSSARY_FALLBACK_KEY]
}

function entryConflictKeys(entry: GlossaryEntry): string[] {
  return Object.entries(entry.translations)
    .filter(([lang]) => isGlossaryLanguageKey(lang))
    .map(([lang, term]) => `${lang}:${term}`)
}

/** User entries override global entries that share any lang:term pair. */
export function mergeGlossaryEntries(
  base: GlossaryEntry[],
  override: GlossaryEntry[]
): GlossaryEntry[] {
  if (override.length === 0) return base

  const overrideKeys = new Set<string>()
  for (const entry of override) {
    for (const key of entryConflictKeys(entry)) {
      overrideKeys.add(key)
    }
  }

  const filtered = base.filter((entry) => {
    const keys = entryConflictKeys(entry)
    return !keys.some((key) => overrideKeys.has(key))
  })

  return [...filtered, ...override]
}

/** Collect glossary terms that appear in `text` for the given language (`auto` checks all translations). */
export function collectGlossaryTermsInText(
  entries: GlossaryEntry[],
  text: string,
  lang: string
): string[] {
  if (!text || entries.length === 0) return []

  const terms: string[] = []
  for (const entry of entries) {
    if (lang === 'auto') {
      for (const [key, term] of Object.entries(entry.translations)) {
        if (isGlossaryLanguageKey(key) && term && text.includes(term)) terms.push(term)
      }
    } else {
      const term = resolveGlossaryTranslation(entry.translations, lang)
      if (term && text.includes(term)) terms.push(term)
    }
  }
  return terms
}

/** Find non-overlapping glossary term occurrences; longer terms take priority. */
export function findGlossaryOccurrences(text: string, terms: string[]): CharRange[] {
  if (!text || terms.length === 0) return []

  const unique = [...new Set(terms.filter((t) => t.length > 0))].sort(
    (a, b) => b.length - a.length
  )
  const occupied = new Uint8Array(text.length)
  const ranges: CharRange[] = []

  for (const term of unique) {
    let from = 0
    while (from <= text.length - term.length) {
      const idx = text.indexOf(term, from)
      if (idx === -1) break
      const end = idx + term.length
      let overlaps = false
      for (let i = idx; i < end; i++) {
        if (occupied[i]) {
          overlaps = true
          break
        }
      }
      if (!overlaps) {
        for (let i = idx; i < end; i++) occupied[i] = 1
        ranges.push({ start: idx, end })
      }
      from = idx + 1
    }
  }

  return ranges.sort((a, b) => a.start - b.start)
}

export function findGlossaryMarkRanges(
  text: string,
  entries: GlossaryEntry[],
  lang: string
): CharRange[] {
  const terms = collectGlossaryTermsInText(entries, text, lang)
  return findGlossaryOccurrences(text, terms)
}

export function findRelevantEntries(
  entries: GlossaryEntry[],
  sourceText: string,
  sourceLang: string
): GlossaryEntry[] {
  const matched: Array<{ entry: GlossaryEntry; termLength: number; matchedLang: string }> = []

  for (const entry of entries) {
    if (sourceLang === 'auto') {
      for (const [lang, term] of Object.entries(entry.translations)) {
        if (isGlossaryLanguageKey(lang) && term && sourceText.includes(term)) {
          matched.push({ entry, termLength: term.length, matchedLang: lang })
          break
        }
      }
    } else {
      const sourceTerm = entry.translations[sourceLang]
      if (sourceTerm && sourceText.includes(sourceTerm)) {
        matched.push({ entry, termLength: sourceTerm.length, matchedLang: sourceLang })
      }
    }
  }

  matched.sort((a, b) => b.termLength - a.termLength)
  return matched.map((m) => m.entry)
}

export function resolveSourceLangForGlossary(
  entries: GlossaryEntry[],
  sourceText: string,
  sourceLang: string
): string | null {
  if (sourceLang !== 'auto') return sourceLang

  let best: { lang: string; length: number } | null = null
  for (const entry of entries) {
    for (const [lang, term] of Object.entries(entry.translations)) {
      if (isGlossaryLanguageKey(lang) && term && sourceText.includes(term)) {
        if (!best || term.length > best.length) {
          best = { lang, length: term.length }
        }
      }
    }
  }
  return best?.lang ?? null
}

export function buildGlossaryPromptSection(
  entries: GlossaryEntry[],
  sourceLang: string,
  targetLang: string
): string {
  if (entries.length === 0) return ''

  const lines = entries
    .map((entry) => {
      const sourceTerm = entry.translations[sourceLang]
      const targetTerm = resolveGlossaryTranslation(entry.translations, targetLang)
      if (!sourceTerm || !targetTerm) return null
      return `- "${sourceTerm}" → "${targetTerm}"`
    })
    .filter(Boolean)

  if (lines.length === 0) return ''

  return (
    'Use these mandatory translations when the source contains the listed terms:\n' +
    lines.join('\n')
  )
}
