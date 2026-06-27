export const UI_LOCALE_CODES = ['en', 'zh', 'ru', 'ja', 'fr', 'es'] as const
export type UiLocaleCode = (typeof UI_LOCALE_CODES)[number]

const UI_LOCALE_SET = new Set<string>(UI_LOCALE_CODES)

export function isUiLocaleCode(value: string): value is UiLocaleCode {
  return UI_LOCALE_SET.has(value)
}
