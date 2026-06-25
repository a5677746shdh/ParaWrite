import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fromConfigLang } from './lang-codes.js'

export interface GlossaryEntry {
  /** ISO 639-1 language code → term */
  translations: Record<string, string>
}

interface GlossaryFile {
  entries?: Array<{
    translations?: Record<string, string>
  }>
}

export function loadGlossary(appRoot: string, fileName: string): GlossaryEntry[] {
  const filePath = path.resolve(appRoot, fileName)
  if (!fs.existsSync(filePath)) {
    console.warn(`[parawrite] Glossary file not found: ${filePath}`)
    return []
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = yaml.load(raw) as GlossaryFile
  const entries: GlossaryEntry[] = []

  for (const entry of parsed.entries ?? []) {
    if (!entry.translations || Object.keys(entry.translations).length < 2) {
      console.warn('[parawrite] Skipping glossary entry with fewer than 2 languages')
      continue
    }

    const translations: Record<string, string> = {}
    for (const [lang, term] of Object.entries(entry.translations)) {
      if (typeof term === 'string' && term.trim()) {
        translations[fromConfigLang(lang)] = term.trim()
      }
    }

    if (Object.keys(translations).length >= 2) {
      entries.push({ translations })
    }
  }

  return entries
}

export function findRelevantEntries(
  entries: GlossaryEntry[],
  sourceText: string,
  sourceLang6391: string
): GlossaryEntry[] {
  const matched: Array<{ entry: GlossaryEntry; termLength: number; matchedLang: string }> = []

  for (const entry of entries) {
    if (sourceLang6391 === 'auto') {
      for (const [lang, term] of Object.entries(entry.translations)) {
        if (term && sourceText.includes(term)) {
          matched.push({ entry, termLength: term.length, matchedLang: lang })
          break
        }
      }
    } else {
      const sourceTerm = entry.translations[sourceLang6391]
      if (sourceTerm && sourceText.includes(sourceTerm)) {
        matched.push({ entry, termLength: sourceTerm.length, matchedLang: sourceLang6391 })
      }
    }
  }

  matched.sort((a, b) => b.termLength - a.termLength)
  return matched.map((m) => m.entry)
}

export function resolveSourceLangForGlossary(
  entries: GlossaryEntry[],
  sourceText: string,
  sourceLang6391: string
): string | null {
  if (sourceLang6391 !== 'auto') return sourceLang6391

  let best: { lang: string; length: number } | null = null
  for (const entry of entries) {
    for (const [lang, term] of Object.entries(entry.translations)) {
      if (term && sourceText.includes(term)) {
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
  sourceLang6391: string,
  targetLang6391: string
): string {
  if (entries.length === 0) return ''

  const lines = entries
    .map((entry) => {
      const sourceTerm = entry.translations[sourceLang6391]
      const targetTerm = entry.translations[targetLang6391]
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

export class GlossaryService {
  private readonly entries: GlossaryEntry[]

  constructor(entries: GlossaryEntry[]) {
    this.entries = entries
  }

  static fromConfig(appRoot: string, fileName?: string): GlossaryService {
    if (!fileName) return new GlossaryService([])
    return new GlossaryService(loadGlossary(appRoot, fileName))
  }

  findRelevant(sourceText: string, sourceLang6391: string): GlossaryEntry[] {
    return findRelevantEntries(this.entries, sourceText, sourceLang6391)
  }

  buildPromptSection(
    entries: GlossaryEntry[],
    sourceText: string,
    sourceLang6391: string,
    targetLang6391: string
  ): string {
    const effectiveSourceLang = resolveSourceLangForGlossary(
      entries,
      sourceText,
      sourceLang6391
    )
    if (!effectiveSourceLang) return ''
    return buildGlossaryPromptSection(entries, effectiveSourceLang, targetLang6391)
  }
}
