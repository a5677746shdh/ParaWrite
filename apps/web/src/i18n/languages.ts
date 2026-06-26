export const UI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
] as const

export type UiLanguageCode = (typeof UI_LANGUAGES)[number]['code']

const UI_LANGUAGE_SET = new Set<string>(UI_LANGUAGES.map((l) => l.code))

export function resolveUiLang(language: string): UiLanguageCode {
  const base = language.split('-')[0]
  return UI_LANGUAGE_SET.has(base) ? (base as UiLanguageCode) : 'en'
}

export function isUiLanguageCode(value: string): value is UiLanguageCode {
  return UI_LANGUAGE_SET.has(value)
}
