import { SUPPORTED_LANGUAGES, sortSupportedLanguages } from '@parawrite/core/client'
import { useMemo } from 'react'
import { formSelectClass } from '../ui'

interface LanguageSelectProps {
  value: string
  onChange: (value: string) => void
  label: string
  allowAuto?: boolean
  languageOrder?: string[]
}

export function LanguageSelect({
  value,
  onChange,
  label,
  allowAuto = false,
  languageOrder = [],
}: LanguageSelectProps) {
  const languages = useMemo(() => {
    const base = allowAuto
      ? SUPPORTED_LANGUAGES
      : SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto')
    return sortSupportedLanguages(base, languageOrder)
  }, [allowAuto, languageOrder])

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-deepl-blue/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={formSelectClass}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </label>
  )
}
