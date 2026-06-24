import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { countWords } from '@parawrite/core/client'

interface TextStatsProps {
  text: string
  lang: string
}

export const TextStats = memo(function TextStats({ text, lang }: TextStatsProps) {
  const { t } = useTranslation()
  const stats = useMemo(
    () => ({
      chars: text.length,
      words: countWords(text, lang),
    }),
    [text, lang]
  )

  return (
    <p className="text-xs text-deepl-blue/50">
      {t('textStats', { chars: stats.chars, words: stats.words })}
    </p>
  )
})
