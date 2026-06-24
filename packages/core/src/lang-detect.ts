import { franc } from 'franc'

const DETECTABLE_FRANC_CODES = [
  'eng',
  'cmn',
  'zho',
  'jpn',
  'kor',
  'fra',
  'deu',
  'spa',
  'por',
  'rus',
  'ita',
] as const

const FRANC_TO_LANG: Record<(typeof DETECTABLE_FRANC_CODES)[number], string> = {
  eng: 'en',
  cmn: 'zh',
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

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
}

export function detectTextLanguage(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const code = franc(trimmed, {
    minLength: hasCjk(trimmed) ? 1 : 3,
    only: [...DETECTABLE_FRANC_CODES],
  })

  if (code === 'und') return null
  return FRANC_TO_LANG[code as (typeof DETECTABLE_FRANC_CODES)[number]] ?? null
}
