import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { isUiLanguageCode } from './i18n/languages'
import { en } from './i18n/locales/en'
import { zh } from './i18n/locales/zh'
import { ru } from './i18n/locales/ru'
import { ja } from './i18n/locales/ja'
import { fr } from './i18n/locales/fr'
import { es } from './i18n/locales/es'

const resources = { en, zh, ru, ja, fr, es }

function resolveInitialLanguage(): string {
  const saved = localStorage.getItem('parawrite-ui-lang')
  if (saved && isUiLanguageCode(saved)) return saved
  return 'zh'
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
