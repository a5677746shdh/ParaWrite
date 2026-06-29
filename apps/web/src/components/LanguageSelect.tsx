import { SUPPORTED_LANGUAGES } from '@parawrite/core/client'
import { formSelectClass } from '../ui'

interface LanguageSelectProps {
  value: string
  onChange: (value: string) => void
  label: string
  allowAuto?: boolean
}

export function LanguageSelect({
  value,
  onChange,
  label,
  allowAuto = false,
}: LanguageSelectProps) {
  const languages = allowAuto
    ? SUPPORTED_LANGUAGES
    : SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto')

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
