import { useTranslation } from 'react-i18next'
import { diffHighlight } from '@parawrite/core/client'
import type {
  DictionaryEntry,
  RephraseOption,
  SynonymOption,
} from '@parawrite/core/client'

interface WordPanelProps {
  mode: 'resident' | 'modal' | 'sheet'
  visible: boolean
  selectedWord: string | null
  synonyms: SynonymOption[]
  dictionary: DictionaryEntry | null
  rephraseOptions: RephraseOption[]
  rephraseOriginalSentence: string | null
  targetLang: string
  isPhraseSelection: boolean
  isLoading: boolean
  onApplySynonym: (word: string) => void
  onApplyRephrase: (text: string) => void
  onClose: () => void
}

function HighlightedAlternative({
  original,
  alternative,
  lang,
}: {
  original: string
  alternative: string
  lang: string
}) {
  const parts = diffHighlight(original, alternative, lang)
  return (
    <>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark
            key={index}
            className="rounded bg-amber-100 px-0.5 text-deepl-blue not-italic"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  )
}

export function WordPanel({
  mode,
  visible,
  selectedWord,
  synonyms,
  dictionary,
  rephraseOptions,
  rephraseOriginalSentence,
  targetLang,
  isPhraseSelection,
  isLoading,
  onApplySynonym,
  onApplyRephrase,
  onClose,
}: WordPanelProps) {
  const { t } = useTranslation()

  if (mode !== 'resident' && !visible) return null

  const showHint = mode === 'resident' && !selectedWord && !isLoading
  const showClose = mode !== 'resident'
  const showDictionary =
    !isPhraseSelection && !!dictionary && dictionary.meanings.length > 0
  const originalSentence = rephraseOriginalSentence ?? ''

  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-deepl-blue">
          {selectedWord ? `"${selectedWord}"` : t('wordPanelTitle')}
        </h3>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-deepl-blue/60 hover:bg-deepl-light"
          >
            ✕
          </button>
        )}
      </div>

      {showHint ? (
        <p className="text-sm leading-relaxed text-deepl-blue/60">{t('panelHint')}</p>
      ) : isLoading ? (
        <p className="text-sm text-deepl-blue/60">{t('loading')}</p>
      ) : (
        <>
          {!isPhraseSelection && (
            <section>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deepl-blue/60">
                {t('synonyms')}
              </h4>
              {synonyms.length === 0 ? (
                <p className="text-sm text-deepl-blue/50">{t('noResults')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {synonyms.map((syn) => (
                    <button
                      key={syn.word}
                      type="button"
                      onClick={() => onApplySynonym(syn.word)}
                      className="rounded-lg border border-deepl-accent/30 bg-deepl-accent/10 px-3 py-1.5 text-sm hover:bg-deepl-accent/20"
                      title={syn.note}
                    >
                      {syn.word}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {showDictionary && (
            <section>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deepl-blue/60">
                {t('dictionary')}
              </h4>
              {dictionary.phonetic && (
                <p className="mb-2 text-sm text-deepl-blue/70">/{dictionary.phonetic}/</p>
              )}
              <ul className="space-y-2 text-sm">
                {dictionary.meanings.map((m, i) => (
                  <li key={i}>
                    {m.partOfSpeech && (
                      <span className="mr-2 rounded bg-deepl-light px-1.5 py-0.5 text-xs">
                        {m.partOfSpeech}
                      </span>
                    )}
                    <span>{m.definition}</span>
                    {m.example && (
                      <p className="mt-1 text-deepl-blue/60 italic">{m.example}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-deepl-blue/60">
              {t('alternatives')}
            </h4>
            {rephraseOptions.length === 0 ? (
              <p className="text-sm text-deepl-blue/50">{t('noResults')}</p>
            ) : (
              <ul className="space-y-2">
                {rephraseOptions.map((opt) => (
                  <li key={opt.text}>
                    <button
                      type="button"
                      onClick={() => onApplyRephrase(opt.text)}
                      className="w-full rounded-lg border border-deepl-border px-3 py-2 text-left text-sm hover:border-deepl-accent hover:bg-deepl-light"
                    >
                      {originalSentence ? (
                        <HighlightedAlternative
                          original={originalSentence}
                          alternative={opt.text}
                          lang={targetLang}
                        />
                      ) : (
                        opt.text
                      )}
                      {opt.style && (
                        <span className="ml-2 text-xs text-deepl-blue/50">{opt.style}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )

  if (mode === 'sheet') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end bg-black/30"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    )
  }

  if (mode === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <aside className="flex w-full min-w-0 flex-col self-start overflow-hidden rounded-2xl border border-deepl-border bg-white p-4 shadow-sm">
      {content}
    </aside>
  )
}
