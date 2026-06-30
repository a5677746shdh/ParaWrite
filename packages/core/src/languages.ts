import { SUPPORTED_LANGUAGES } from './types.js'

const SUPPORTED_LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code))

/** Normalize and dedupe a custom language order list (unknown codes dropped). */
export function normalizeLanguageOrder(order: unknown): string[] {
  if (!Array.isArray(order)) return []

  const seen = new Set<string>()
  const result: string[] = []
  for (const code of order) {
    if (typeof code !== 'string') continue
    const normalized = code.trim().toLowerCase()
    if (!normalized || !SUPPORTED_LANGUAGE_CODES.has(normalized) || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

/** Sort languages: custom order first, then remaining entries A–Z by display name. */
export function sortSupportedLanguages<T extends { code: string; name: string }>(
  languages: readonly T[],
  customOrder: readonly string[] = []
): T[] {
  const list = [...languages]

  if (customOrder.length === 0) {
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }

  const orderIndex = new Map<string, number>()
  customOrder.forEach((code, index) => {
    orderIndex.set(code, index)
  })

  const prioritized: T[] = []
  const rest: T[] = []

  for (const lang of list) {
    if (orderIndex.has(lang.code)) {
      prioritized.push(lang)
    } else {
      rest.push(lang)
    }
  }

  prioritized.sort(
    (a, b) => (orderIndex.get(a.code) ?? 0) - (orderIndex.get(b.code) ?? 0)
  )
  rest.sort((a, b) => a.name.localeCompare(b.name))

  return [...prioritized, ...rest]
}
