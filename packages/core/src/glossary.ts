import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { GlossaryEntry, PointOutGlossaryMode } from './types.js'
import {
  GLOSSARY_FALLBACK_KEY,
  buildGlossaryPromptSection,
  findRelevantEntries,
  mergeGlossaryEntries,
  resolveSourceLangForGlossary,
} from './glossary-mark.js'

export * from './glossary-mark.js'
export type { PointOutGlossaryMode }

interface GlossaryFile {
  entries?: Array<{
    translations?: Record<string, string>
  }>
}

function isGlossaryLanguageKey(key: string): boolean {
  return key !== GLOSSARY_FALLBACK_KEY
}

function parseGlossaryFile(raw: string): GlossaryEntry[] {
  const parsed = yaml.load(raw) as GlossaryFile
  const entries: GlossaryEntry[] = []

  for (const entry of parsed.entries ?? []) {
    if (!entry.translations) {
      console.warn('[parawrite] Skipping glossary entry without translations')
      continue
    }

    const translations: Record<string, string> = {}
    for (const [lang, term] of Object.entries(entry.translations)) {
      if (typeof term === 'string' && term.trim()) {
        translations[lang.toLowerCase()] = term.trim()
      }
    }

    const languageKeys = Object.keys(translations).filter(isGlossaryLanguageKey)
    const hasFallback = GLOSSARY_FALLBACK_KEY in translations
    const isValid =
      languageKeys.length >= 2 || (languageKeys.length >= 1 && hasFallback)

    if (!isValid) {
      console.warn(
        '[parawrite] Skipping glossary entry: need at least two languages or one language plus "other"'
      )
      continue
    }

    entries.push({ translations })
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
