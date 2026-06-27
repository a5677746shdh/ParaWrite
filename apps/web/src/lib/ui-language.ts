import i18n from '../i18n'
import { isUiLanguageCode, resolveUiLang } from '../i18n/languages'

export function applyUiLanguage(lang: string): void {
  const resolved = isUiLanguageCode(lang) ? lang : resolveUiLang(lang)
  i18n.changeLanguage(resolved)
  localStorage.setItem('parawrite-ui-lang', resolved)
}
