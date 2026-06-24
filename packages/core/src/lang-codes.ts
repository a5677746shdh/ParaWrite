/** ISO 639-2 (config files) ↔ ISO 639-1 (runtime) mapping for supported languages. */

const ISO6392_TO_6391: Record<string, string> = {
  eng: 'en',
  zho: 'zh',
  jpn: 'ja',
  kor: 'ko',
  fra: 'fr',
  deu: 'de',
  spa: 'es',
  por: 'pt',
  rus: 'ru',
  ita: 'it',
}

const ISO6391_TO_6392: Record<string, string> = Object.fromEntries(
  Object.entries(ISO6392_TO_6391).map(([a, b]) => [b, a])
)

export function fromConfigLang(code: string): string {
  if (code === 'auto') return 'auto'
  const mapped = ISO6392_TO_6391[code.toLowerCase()]
  if (mapped) return mapped
  if (code.length === 2) return code
  console.warn(`[parawrite] Unknown ISO 639-2 language code in config: "${code}"`)
  return code
}

export function toConfigLang(code: string): string {
  if (code === 'auto') return 'auto'
  const mapped = ISO6391_TO_6392[code.toLowerCase()]
  if (mapped) return mapped
  if (code.length === 3) return code
  return code
}

export function mapConfigLangRecord<T>(
  record: Record<string, T> | undefined
): Record<string, T> {
  if (!record) return {}
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    result[fromConfigLang(key)] = value
  }
  return result
}
