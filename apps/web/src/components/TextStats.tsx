import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { countWords } from '@parawrite/core/client'
import { paneOutlineAccentButtonClass, textButtonPx } from '../ui'

interface TextStatsProps {
  text: string
  lang: string
  showLookupButton?: boolean
  onLookup?: () => void
  lookupDisabled?: boolean
}

export const TextStats = memo(function TextStats({
  text,
  lang,
  showLookupButton = false,
  onLookup,
  lookupDisabled = false,
}: TextStatsProps) {
  const { t } = useTranslation()
  const stats = useMemo(
    () => ({
      chars: text.length,
      words: countWords(text, lang),
    }),
    [text, lang]
  )

  if (showLookupButton && onLookup) {
    return (
      <button
        type="button"
        onClick={onLookup}
        disabled={lookupDisabled}
        className={clsx(paneOutlineAccentButtonClass, textButtonPx)}
      >
        {t('lookupWord')}
      </button>
    )
  }

  return (
    <p className="text-xs text-deepl-blue/50">
      {t('textStats', { chars: stats.chars, words: stats.words })}
    </p>
  )
})
