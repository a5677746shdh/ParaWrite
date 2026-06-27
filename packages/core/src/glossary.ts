import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

export interface GlossaryEntry {
  /** ISO 639-1 language code → term */
  translations: Record<string, string>
}

interface GlossaryFile {
  entries?: Array<{
    translations?: Record<string, string>
  }>
}

function parseGlossaryFile(raw: string): GlossaryEntry[] {
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
        translations[lang.toLowerCase()] = term.trim()
      }
    }

    if (Object.keys(translations).length >= 2) {
      entries.push({ translations })
    }
  }

  return entries
}

export function loadGlossaryFromPath(filePath: string): GlossaryEntry[] {
  if (!fs.existsSync(filePath)) {
    return []
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  return parseGlossaryFile(raw)
}

export function loadGlossary(appRoot: string, fileName: string): GlossaryEntry[] {
  const filePath = path.resolve(appRoot, fileName)
  if (!fs.existsSync(filePath)) {
    console.warn(`[parawrite] Glossary file not found: ${filePath}`)
    return []
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  return parseGlossaryFile(raw)
}

export function loadUserGlossary(filePath: string): GlossaryEntry[] {
  return loadGlossaryFromPath(filePath)
}

function entryConflictKeys(entry: GlossaryEntry): string[] {
  return Object.entries(entry.translations).map(([lang, term]) => `${lang}:${term}`)
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

export function findRelevantEntries(
  entries: GlossaryEntry[],
  sourceText: string,
  sourceLang: string
): GlossaryEntry[] {
  const matched: Array<{ entry: GlossaryEntry; termLength: number; matchedLang: string }> = []

  for (const entry of entries) {
    if (sourceLang === 'auto') {
      for (const [lang, term] of Object.entries(entry.translations)) {
        if (term && sourceText.includes(term)) {
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
  sourceLang: string,
  targetLang: string
): string {
  if (entries.length === 0) return ''

  const lines = entries
    .map((entry) => {
      const sourceTerm = entry.translations[sourceLang]
      const targetTerm = entry.translations[targetLang]
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

  getEntries(): GlossaryEntry[] {
    return this.entries
  }

  static fromConfig(appRoot: string, fileName?: string): GlossaryService {
    if (!fileName) return new GlossaryService([])
    return new GlossaryService(loadGlossary(appRoot, fileName))
  }

  static fromEntries(entries: GlossaryEntry[]): GlossaryService {
    return new GlossaryService(entries)
  }

  findRelevant(sourceText: string, sourceLang: string): GlossaryEntry[] {
    return findRelevantEntries(this.entries, sourceText, sourceLang)
  }

  buildPromptSection(
    entries: GlossaryEntry[],
    sourceText: string,
    sourceLang: string,
    targetLang: string
  ): string {
    const effectiveSourceLang = resolveSourceLangForGlossary(entries, sourceText, sourceLang)
    if (!effectiveSourceLang) return ''
    return buildGlossaryPromptSection(entries, effectiveSourceLang, targetLang)
  }
}
